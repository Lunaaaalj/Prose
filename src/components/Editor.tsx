import { useRef } from "react";
import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  beginConversionGroup,
  endConversionGroup,
  logConversion,
} from "../utils/conversionLogger";

const BLOCK_MATH_RE = /^\$\$(?!\$)([\s\S]+?)\$\$$/;
const INLINE_MATH_RE = /(?<![\$\d])\$(?!\$)([^$\n]+?)\$(?!\d)/g;

function selectionTouchesRange(
  selectionFrom: number,
  selectionTo: number,
  rangeFrom: number,
  rangeTo: number,
) {
  return selectionFrom <= rangeTo && selectionTo >= rangeFrom;
}

function charBefore(doc: PMNode, pos: number) {
  if (pos <= 0) return "";
  return doc.textBetween(pos - 1, pos, "", "");
}

function charAfter(doc: PMNode, pos: number) {
  return doc.textBetween(pos, pos + 1, "", "");
}

function getParagraphTextMap(node: PMNode, pos: number) {
  let text = "";
  let hasNonText = false;
  const segments: Array<{ start: number; end: number; from: number }> = [];

  node.forEach((child, offset) => {
    if (!child.isText || !child.text) {
      hasNonText = true;
      return;
    }
    const start = text.length;
    text += child.text;
    const end = text.length;
    segments.push({ start, end, from: pos + 1 + offset });
  });

  if (hasNonText) return null;

  const offsetToPos = (offset: number) => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (offset <= seg.end) {
        const local = Math.max(0, Math.min(offset - seg.start, seg.end - seg.start));
        return seg.from + local;
      }
    }
    return pos + node.nodeSize - 1;
  };

  return { text, offsetToPos };
}

type TextRun = {
  text: string;
  offsetToPos: (offset: number) => number;
};

function getParagraphTextRuns(node: PMNode, pos: number): TextRun[] {
  type Segment = { start: number; end: number; from: number };
  const runs: TextRun[] = [];
  let currentText = "";
  let currentSegments: Segment[] = [];

  const flush = () => {
    if (currentText.length === 0) return;
    const text = currentText;
    const segments = currentSegments;
    runs.push({
      text,
      offsetToPos: (offset: number) => {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (offset <= seg.end) {
            const local = Math.max(0, Math.min(offset - seg.start, seg.end - seg.start));
            return seg.from + local;
          }
        }
        const last = segments[segments.length - 1];
        return last.from + (last.end - last.start);
      },
    });
    currentText = "";
    currentSegments = [];
  };

  node.forEach((child, offset) => {
    if (!child.isText || !child.text) {
      flush();
      return;
    }
    const start = currentText.length;
    currentText += child.text;
    const end = currentText.length;
    currentSegments.push({ start, end, from: pos + 1 + offset });
  });
  flush();

  return runs;
}

type MarkTouch = {
  type: "strong" | "em";
  from: number;
  to: number;
  text: string;
  side: "left" | "right" | "inside";
  insideOffset: number;
};

const HeadingHashHint = Extension.create({
  name: "headingHashHint",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingHashHint"),
        props: {
          decorations(state) {
            const { selection, doc } = state;
            if (!selection.empty) return null;
            const $from = selection.$from;
            for (let depth = $from.depth; depth >= 0; depth--) {
              const node = $from.node(depth);
              if (node.type.name !== "heading") continue;
              const pos = $from.before(depth);
              return DecorationSet.create(doc, [
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "heading-show-hash",
                }),
              ]);
            }
            return null;
          },
        },
      }),
    ];
  },
});

function touchedMarkedSpan(
  state: EditorState,
  markName: "strong" | "em",
): MarkTouch | null {
  if (!state.selection.empty) return null;
  const markType = state.schema.marks[markName];
  if (!markType) return null;

  const $from = state.selection.$from;
  const parent = $from.parent;
  if (!parent.isTextblock) return null;

  const cursor = $from.parentOffset;
  const parentStart = $from.start();
  const spans: Array<{ from: number; to: number; text: string }> = [];
  let current: { from: number; to: number; text: string } | null = null;

  parent.forEach((child, offset) => {
    if (!child.isText || !child.text) {
      current = null;
      return;
    }
    const hasMark = Boolean(markType.isInSet(child.marks));
    if (!hasMark) {
      current = null;
      return;
    }

    const from = offset;
    const to = offset + child.text.length;
    if (current && current.to === from) {
      current.to = to;
      current.text += child.text;
    } else {
      current = { from, to, text: child.text };
      spans.push(current);
    }
  });

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (cursor < span.from || cursor > span.to) continue;
    const side: "left" | "right" | "inside" =
      cursor === span.from ? "left" : cursor === span.to ? "right" : "inside";
    return {
      type: markName,
      from: parentStart + span.from,
      to: parentStart + span.to,
      text: span.text,
      side,
      insideOffset: Math.max(0, cursor - span.from),
    };
  }

  return null;
}

const MarkdownEditOnTouch = Extension.create({
  name: "markdownEditOnTouch",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownEditOnTouch"),
        appendTransaction: (transactions, _oldState, newState) => {
          const hasSelectionSet = transactions.some((tr) => tr.selectionSet);
          if (!hasSelectionSet) return null;
          const hasDocChanged = transactions.some((tr) => tr.docChanged);

          beginConversionGroup("markdownEditOnTouch");
          try {
            logConversion({
              kind: "trigger",
              plugin: "markdownEditOnTouch",
              selectionSet: hasSelectionSet,
              docChanged: hasDocChanged,
              selection: {
                from: newState.selection.from,
                to: newState.selection.to,
                empty: newState.selection.empty,
              },
            });

            if (hasDocChanged) {
              logConversion({
                kind: "skip",
                plugin: "markdownEditOnTouch",
                reason: "typing (docChanged) — not a touch",
              });
              return null;
            }

            const cursorBefore = newState.selection.from;

            const strong = touchedMarkedSpan(newState, "strong");
            if (strong) {
              logConversion({
                kind: "detect",
                plugin: "markdownEditOnTouch",
                nodeType: "strong",
                range: { from: strong.from, to: strong.to },
                details: { side: strong.side, insideOffset: strong.insideOffset },
              });
              const text = `**${strong.text}**`;
              const tr = newState.tr.replaceWith(strong.from, strong.to, newState.schema.text(text));
              const cursor =
                strong.side === "left"
                  ? strong.from
                  : strong.side === "right"
                    ? strong.from + text.length
                    : strong.from + 2 + strong.insideOffset;
              tr.setSelection(TextSelection.create(tr.doc, cursor));
              tr.setMeta("addToHistory", false);
              logConversion({
                kind: "convert",
                plugin: "markdownEditOnTouch",
                from: "strong",
                to: "text+markdown",
                range: { from: strong.from, to: strong.to },
                cursorBefore,
                cursorAfter: cursor,
                details: { side: strong.side },
              });
              return tr;
            }

            const em = touchedMarkedSpan(newState, "em");
            if (em) {
              logConversion({
                kind: "detect",
                plugin: "markdownEditOnTouch",
                nodeType: "em",
                range: { from: em.from, to: em.to },
                details: { side: em.side, insideOffset: em.insideOffset },
              });
              const text = `*${em.text}*`;
              const tr = newState.tr.replaceWith(em.from, em.to, newState.schema.text(text));
              const cursor =
                em.side === "left"
                  ? em.from
                  : em.side === "right"
                    ? em.from + text.length
                    : em.from + 1 + em.insideOffset;
              tr.setSelection(TextSelection.create(tr.doc, cursor));
              tr.setMeta("addToHistory", false);
              logConversion({
                kind: "convert",
                plugin: "markdownEditOnTouch",
                from: "em",
                to: "text+markdown",
                range: { from: em.from, to: em.to },
                cursorBefore,
                cursorAfter: cursor,
                details: { side: em.side },
              });
              return tr;
            }

            logConversion({
              kind: "skip",
              plugin: "markdownEditOnTouch",
              reason: "no heading/mark touched",
            });
            return null;
          } finally {
            endConversionGroup();
          }
        },
      }),
    ];
  },
});

type TouchedMathNode = { node: PMNode; pos: number };

type MathBoundaryTouch = TouchedMathNode & { side: "left" | "right" };

function touchedMathBoundary(state: EditorState): MathBoundaryTouch | null {
  const { inlineMath, blockMath } = state.schema.nodes;
  if (!inlineMath || !blockMath) return null;
  if (!state.selection.empty) return null;

  const cursorPos = state.selection.from;
  let hit: MathBoundaryTouch | null = null;

  state.doc.descendants((node, pos) => {
    if (node.type !== inlineMath && node.type !== blockMath) return;
    const from = pos;
    const to = pos + node.nodeSize;
    if (cursorPos !== from && cursorPos !== to) return;
    hit = { node, pos, side: cursorPos === from ? "left" : "right" };
    return false;
  });

  return hit;
}

const MathEditOnTouch = Extension.create({
  name: "mathEditOnTouch",
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection, doc, schema } = editor.state;
        if (!selection.empty) return false;
        const { inlineMath, blockMath } = schema.nodes;
        if (!inlineMath && !blockMath) return false;

        const cursorPos = selection.from;
        const $from = selection.$from;
        let target: { node: PMNode; pos: number } | null = null;

        const nodeBefore = $from.nodeBefore;
        if (nodeBefore && inlineMath && nodeBefore.type === inlineMath) {
          target = { node: nodeBefore, pos: cursorPos - nodeBefore.nodeSize };
        } else if (blockMath && $from.depth > 0 && $from.parentOffset === 0) {
          const blockStart = $from.before();
          const $block = doc.resolve(blockStart);
          const prevBlock = $block.nodeBefore;
          if (prevBlock && prevBlock.type === blockMath) {
            target = { node: prevBlock, pos: blockStart - prevBlock.nodeSize };
          }
        }
        if (!target) return false;

        beginConversionGroup("mathEditOnTouch");
        try {
          logConversion({
            kind: "detect",
            plugin: "mathEditOnTouch",
            nodeType: target.node.type.name,
            range: { from: target.pos, to: target.pos + target.node.nodeSize },
            details: { trigger: "backspace", latex: target.node.attrs.latex },
          });
          if (target.node.type === inlineMath) {
            revertInlineMath(editor, target.node, target.pos);
          } else {
            revertBlockMath(editor, target.node, target.pos);
          }
          logConversion({
            kind: "convert",
            plugin: "mathEditOnTouch",
            from: target.node.type.name,
            to: target.node.type === inlineMath ? "text+markdown" : "paragraph+markdown",
            range: { from: target.pos, to: target.pos + target.node.nodeSize },
            cursorBefore: cursorPos,
            cursorAfter: editor.state.selection.from,
            details: { trigger: "backspace" },
          });
        } finally {
          endConversionGroup();
        }
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("mathEditOnTouch"),
        appendTransaction: (transactions, _oldState, newState) => {
          const hasSelectionSet = transactions.some((tr) => tr.selectionSet);
          if (!hasSelectionSet) return null;
          const hasDocChanged = transactions.some((tr) => tr.docChanged);

          beginConversionGroup("mathEditOnTouch");
          try {
            logConversion({
              kind: "trigger",
              plugin: "mathEditOnTouch",
              selectionSet: hasSelectionSet,
              docChanged: hasDocChanged,
              selection: {
                from: newState.selection.from,
                to: newState.selection.to,
                empty: newState.selection.empty,
              },
            });

            if (hasDocChanged) {
              logConversion({
                kind: "skip",
                plugin: "mathEditOnTouch",
                reason: "typing (docChanged) — not a touch",
              });
              return null;
            }

            if (!newState.selection.empty) {
              const { inlineMath, blockMath } = newState.schema.nodes;
              const selFrom = newState.selection.from;
              const selTo = newState.selection.to;
              const overlaps: Array<{ node: PMNode; pos: number }> = [];
              newState.doc.nodesBetween(selFrom, selTo, (node, pos) => {
                if (node.type !== inlineMath && node.type !== blockMath) return;
                overlaps.push({ node, pos });
              });
              if (overlaps.length > 0) {
                const tr = newState.tr;
                for (let i = overlaps.length - 1; i >= 0; i--) {
                  const { node, pos } = overlaps[i];
                  logConversion({
                    kind: "detect",
                    plugin: "mathEditOnTouch",
                    nodeType: node.type.name,
                    range: { from: pos, to: pos + node.nodeSize },
                    details: { trigger: "selection-overlap", latex: node.attrs.latex },
                  });
                  if (node.type === blockMath) {
                    const text = `$$${node.attrs.latex}$$`;
                    const para = newState.schema.nodes.paragraph.create(
                      null,
                      newState.schema.text(text),
                    );
                    tr.replaceWith(pos, pos + node.nodeSize, para);
                  } else {
                    const text = `$${node.attrs.latex}$`;
                    tr.replaceWith(pos, pos + node.nodeSize, newState.schema.text(text));
                  }
                }
                const mappedFrom = tr.mapping.map(selFrom, -1);
                const mappedTo = tr.mapping.map(selTo, 1);
                const $from = tr.doc.resolve(mappedFrom);
                const $to = tr.doc.resolve(mappedTo);
                tr.setSelection(TextSelection.between($from, $to));
                tr.setMeta("addToHistory", false);
                logConversion({
                  kind: "convert",
                  plugin: "mathEditOnTouch",
                  from: "math(overlap)",
                  to: "text+markdown",
                  range: { from: selFrom, to: selTo },
                  cursorBefore: selFrom,
                  cursorAfter: tr.selection.from,
                  details: { trigger: "selection-overlap", reverted: overlaps.length },
                });
                return tr;
              }
            }

            const cursorBefore = newState.selection.from;
            const hit = touchedMathBoundary(newState);
            if (!hit) {
              logConversion({
                kind: "skip",
                plugin: "mathEditOnTouch",
                reason: "no math boundary touch",
              });
              return null;
            }

            const node = hit.node;
            const pos = hit.pos;
            logConversion({
              kind: "detect",
              plugin: "mathEditOnTouch",
              nodeType: node.type.name,
              range: { from: pos, to: pos + node.nodeSize },
              details: { side: hit.side, latex: node.attrs.latex },
            });

            const tr = newState.tr;
            let cursorAfter: number;
            let targetType: string;

            if (node.type.name === "blockMath") {
              const text = `$$${node.attrs.latex}$$`;
              const para = newState.schema.nodes.paragraph.create(null, newState.schema.text(text));
              tr.replaceWith(pos, pos + node.nodeSize, para);
              cursorAfter = hit.side === "left" ? pos + 1 : pos + 1 + text.length;
              tr.setSelection(TextSelection.create(tr.doc, cursorAfter));
              targetType = "paragraph+markdown";
            } else {
              const text = `$${node.attrs.latex}$`;
              tr.replaceWith(pos, pos + node.nodeSize, newState.schema.text(text));
              cursorAfter = hit.side === "left" ? pos : pos + text.length;
              tr.setSelection(TextSelection.create(tr.doc, cursorAfter));
              targetType = "text+markdown";
            }

            tr.setMeta("addToHistory", false);
            logConversion({
              kind: "convert",
              plugin: "mathEditOnTouch",
              from: node.type.name,
              to: targetType,
              range: { from: pos, to: pos + node.nodeSize },
              cursorBefore,
              cursorAfter,
              details: { side: hit.side },
            });
            return tr;
          } finally {
            endConversionGroup();
          }
        },
      }),
    ];
  },
});

const MathMigration = Extension.create({
  name: "mathMigration",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("mathMigration"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) return null;
          const { blockMath, inlineMath, paragraph } = newState.schema.nodes;
          if (!blockMath || !inlineMath || !paragraph) return null;
          const selectionFrom = newState.selection.from;
          const selectionTo = newState.selection.to;

          beginConversionGroup("mathMigration");
          try {
            logConversion({
              kind: "trigger",
              plugin: "mathMigration",
              selectionSet: transactions.some((tr) => tr.selectionSet),
              docChanged: transactions.some((tr) => tr.docChanged),
              selection: {
                from: selectionFrom,
                to: selectionTo,
                empty: newState.selection.empty,
              },
            });

            const tr = newState.tr;

            const typedNow = transactions.some((tr) => tr.docChanged);
            const blockHits: Array<{ from: number; to: number; latex: string; placeCursorAfter: boolean }> = [];
            let forcedCursorPos: number | null = null;
            newState.doc.descendants((node, pos) => {
              if (node.type !== paragraph) return;
              const paragraphMap = getParagraphTextMap(node, pos);
              if (!paragraphMap) {
                logConversion({
                  kind: "skip",
                  plugin: "mathMigration",
                  reason: "non-text paragraph",
                  details: { pos, phase: "block" },
                });
                return;
              }
              const m = paragraphMap.text.match(BLOCK_MATH_RE);
              if (!m) return;
              const matchFrom = pos + 1;
              const matchTo = pos + node.nodeSize - 1;
              const closingTypedAtEnd =
                typedNow &&
                newState.selection.empty &&
                selectionFrom === selectionTo &&
                selectionFrom === matchTo;
              if (
                selectionTouchesRange(selectionFrom, selectionTo, matchFrom, matchTo) &&
                !closingTypedAtEnd
              ) {
                logConversion({
                  kind: "skip",
                  plugin: "mathMigration",
                  reason: "selection touches range",
                  details: { phase: "block", range: { from: matchFrom, to: matchTo } },
                });
                return;
              }
              const latex = m[1].trim();
              if (!latex) {
                logConversion({
                  kind: "skip",
                  plugin: "mathMigration",
                  reason: "empty latex",
                  details: { phase: "block", range: { from: matchFrom, to: matchTo } },
                });
                return;
              }
              logConversion({
                kind: "detect",
                plugin: "mathMigration",
                nodeType: "blockMath-candidate",
                range: { from: pos, to: pos + node.nodeSize },
                details: { latex, closingTypedAtEnd },
              });
              blockHits.push({
                from: pos,
                to: pos + node.nodeSize,
                latex,
                placeCursorAfter: closingTypedAtEnd,
              });
            });
            for (let i = blockHits.length - 1; i >= 0; i--) {
              const { from, to, latex, placeCursorAfter } = blockHits[i];
              const mappedFrom = tr.mapping.map(from);
              const mappedTo = tr.mapping.map(to);
              const blockNode = blockMath.create({ latex });
              tr.replaceWith(mappedFrom, mappedTo, blockNode);
              if (placeCursorAfter) {
                const afterBlock = mappedFrom + blockNode.nodeSize;
                tr.insert(afterBlock, paragraph.create());
                forcedCursorPos = afterBlock + 1;
              }
              logConversion({
                kind: "convert",
                plugin: "mathMigration",
                from: "paragraph",
                to: "blockMath",
                range: { from: mappedFrom, to: mappedTo },
                cursorBefore: selectionFrom,
                cursorAfter: forcedCursorPos ?? selectionFrom,
                details: { latex, placeCursorAfter },
              });
            }

            const inlineHits: Array<{ from: number; to: number; latex: string }> = [];
            tr.doc.descendants((node, pos) => {
              if (node.type !== paragraph) return;
              const runs = getParagraphTextRuns(node, pos);
              for (const run of runs) {
                if (!run.text.includes("$")) continue;
                const re = new RegExp(INLINE_MATH_RE.source, "g");
                let m: RegExpExecArray | null;
                while ((m = re.exec(run.text)) !== null) {
                  const localFrom = m.index;
                  const localTo = localFrom + m[0].length;
                  const from = run.offsetToPos(localFrom);
                  const to = run.offsetToPos(localTo);
                  const openPrev = localFrom > 0 ? run.text[localFrom - 1] : "";
                  const openNext = localFrom + 1 < run.text.length ? run.text[localFrom + 1] : "";
                  const closePrev = localTo - 2 >= 0 ? run.text[localTo - 2] : "";
                  const closeNext = localTo < run.text.length ? run.text[localTo] : "";
                  if (openPrev === "$" || openNext === "$" || closePrev === "$" || closeNext === "$") {
                    logConversion({
                      kind: "skip",
                      plugin: "mathMigration",
                      reason: "adjacent $ around inline delimiter",
                      details: {
                        phase: "inline",
                        range: { from, to },
                        openPrev,
                        openNext,
                        closePrev,
                        closeNext,
                      },
                    });
                    continue;
                  }
                  const before = charBefore(tr.doc, from);
                  const after = charAfter(tr.doc, to);
                  if (before === "$" || after === "$") {
                    logConversion({
                      kind: "skip",
                      plugin: "mathMigration",
                      reason: "adjacent $ (block-math overlap)",
                      details: { phase: "inline", range: { from, to }, before, after },
                    });
                    continue;
                  }
                  if (before && /\d/.test(before)) {
                    logConversion({
                      kind: "skip",
                      plugin: "mathMigration",
                      reason: "digit before",
                      details: { phase: "inline", range: { from, to }, before },
                    });
                    continue;
                  }
                  if (after && /\d/.test(after)) {
                    logConversion({
                      kind: "skip",
                      plugin: "mathMigration",
                      reason: "digit after",
                      details: { phase: "inline", range: { from, to }, after },
                    });
                    continue;
                  }
                  if (selectionTouchesRange(selectionFrom, selectionTo, from, to)) {
                    logConversion({
                      kind: "skip",
                      plugin: "mathMigration",
                      reason: "selection touches range",
                      details: { phase: "inline", range: { from, to } },
                    });
                    continue;
                  }
                  logConversion({
                    kind: "detect",
                    plugin: "mathMigration",
                    nodeType: "inlineMath-candidate",
                    range: { from, to },
                    details: { latex: m[1] },
                  });
                  inlineHits.push({ from, to, latex: m[1] });
                }
              }
            });
            for (let i = inlineHits.length - 1; i >= 0; i--) {
              const { from, to, latex } = inlineHits[i];
              const $from = tr.doc.resolve(from);
              if (!$from.parent.canReplaceWith($from.index(), $from.index() + 1, inlineMath)) {
                logConversion({
                  kind: "skip",
                  plugin: "mathMigration",
                  reason: "canReplaceWith rejected",
                  details: { phase: "inline", range: { from, to } },
                });
                continue;
              }
              tr.replaceWith(from, to, inlineMath.create({ latex }));
              logConversion({
                kind: "convert",
                plugin: "mathMigration",
                from: "text",
                to: "inlineMath",
                range: { from, to },
                cursorBefore: selectionFrom,
                cursorAfter: selectionFrom,
                details: { latex },
              });
            }

            if (!tr.docChanged) {
              logConversion({
                kind: "skip",
                plugin: "mathMigration",
                reason: "no net doc change",
              });
              return null;
            }
            if (forcedCursorPos !== null) {
              tr.setSelection(TextSelection.create(tr.doc, forcedCursorPos));
            }
            tr.setMeta("addToHistory", false);
            return tr;
          } finally {
            endConversionGroup();
          }
        },
      }),
    ];
  },
});

function revertInlineMath(editor: TiptapEditor, node: PMNode, pos: number) {
  const text = `$${node.attrs.latex}$`;
  const tr = editor.state.tr.replaceWith(
    pos,
    pos + node.nodeSize,
    editor.schema.text(text),
  );
  tr.setSelection(TextSelection.create(tr.doc, pos + text.length - 1));
  editor.view.dispatch(tr);
  editor.view.focus();
}

function revertBlockMath(editor: TiptapEditor, node: PMNode, pos: number) {
  const text = `$$${node.attrs.latex}$$`;
  const para = editor.schema.nodes.paragraph.create(null, editor.schema.text(text));
  const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, para);
  tr.setSelection(TextSelection.create(tr.doc, pos + 1 + text.length - 2));
  editor.view.dispatch(tr);
  editor.view.focus();
}

export function Editor() {
  const editorRef = useRef<TiptapEditor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      HeadingHashHint,
      MarkdownEditOnTouch,
      InlineMath.configure({
        katexOptions: { throwOnError: false, displayMode: false },
        onClick: (node, pos) => {
          if (editorRef.current) revertInlineMath(editorRef.current, node, pos);
        },
      }),
      BlockMath.configure({
        katexOptions: { throwOnError: false, displayMode: true },
        onClick: (node, pos) => {
          if (editorRef.current) revertBlockMath(editorRef.current, node, pos);
        },
      }),
      MathEditOnTouch,
      MathMigration,
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none",
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
        autocomplete: "off",
      },
    },
  });

  editorRef.current = editor;

  return <EditorContent editor={editor} />;
}
