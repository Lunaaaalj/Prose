import { useRef } from "react";
import { Extension, type Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

const BLOCK_MATH_RE = /^(\${2,3})(?!\$)([\s\S]+?)\1$/;
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

type MarkTouch = {
  type: "strong" | "em";
  from: number;
  to: number;
  text: string;
  side: "left" | "right" | "inside";
  insideOffset: number;
};

function touchedHeadingNode(state: EditorState) {
  if (!state.selection.empty) return null;
  const $from = state.selection.$from;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "heading") continue;
    const pos = $from.before(depth);
    const level = node.attrs.level as number;
    const text = `${"#".repeat(level)} ${node.textContent}`;
    const offsetInHeading = Math.max(0, Math.min(state.selection.from - (pos + 1), node.textContent.length));
    return { pos, node, text, cursor: pos + 1 + "#".repeat(level).length + 1 + offsetInHeading };
  }
  return null;
}

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
          if (!transactions.some((tr) => tr.selectionSet)) return null;

          const heading = touchedHeadingNode(newState);
          if (heading) {
            const tr = newState.tr;
            const para = newState.schema.nodes.paragraph.create(
              null,
              newState.schema.text(heading.text),
            );
            tr.replaceWith(heading.pos, heading.pos + heading.node.nodeSize, para);
            tr.setSelection(TextSelection.create(tr.doc, heading.cursor));
            tr.setMeta("addToHistory", false);
            return tr;
          }

          const strong = touchedMarkedSpan(newState, "strong");
          if (strong) {
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
            return tr;
          }

          const em = touchedMarkedSpan(newState, "em");
          if (em) {
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
            return tr;
          }

          return null;
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
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("mathEditOnTouch"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.selectionSet)) return null;

          const hit = touchedMathBoundary(newState);
          if (!hit) return null;

          const node = hit.node;
          const pos = hit.pos;
          const tr = newState.tr;

          if (node.type.name === "blockMath") {
            const text = `$$${node.attrs.latex}$$`;
            const para = newState.schema.nodes.paragraph.create(null, newState.schema.text(text));
            tr.replaceWith(pos, pos + node.nodeSize, para);
            const cursor = hit.side === "left" ? pos + 1 : pos + 1 + text.length;
            tr.setSelection(TextSelection.create(tr.doc, cursor));
          } else {
            const text = `$${node.attrs.latex}$`;
            tr.replaceWith(pos, pos + node.nodeSize, newState.schema.text(text));
            const cursor = hit.side === "left" ? pos : pos + text.length;
            tr.setSelection(TextSelection.create(tr.doc, cursor));
          }

          tr.setMeta("addToHistory", false);
          return tr;
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

          const tr = newState.tr;

          const blockHits: Array<{ from: number; to: number; latex: string }> = [];
          newState.doc.descendants((node, pos) => {
            if (node.type !== paragraph) return;
            const paragraphMap = getParagraphTextMap(node, pos);
            if (!paragraphMap) return;
            const m = paragraphMap.text.match(BLOCK_MATH_RE);
            if (!m) return;
            const matchFrom = pos + 1;
            const matchTo = pos + node.nodeSize - 1;
            if (selectionTouchesRange(selectionFrom, selectionTo, matchFrom, matchTo)) return;
            const latex = m[2].trim();
            if (!latex) return;
            blockHits.push({ from: pos, to: pos + node.nodeSize, latex });
          });
          for (let i = blockHits.length - 1; i >= 0; i--) {
            const { from, to, latex } = blockHits[i];
            tr.replaceWith(from, to, blockMath.create({ latex }));
          }

          const inlineHits: Array<{ from: number; to: number; latex: string }> = [];
          tr.doc.descendants((node, pos) => {
            if (node.type !== paragraph) return;
            const paragraphMap = getParagraphTextMap(node, pos);
            if (!paragraphMap || !paragraphMap.text.includes("$")) return;
            const re = new RegExp(INLINE_MATH_RE.source, "g");
            let m: RegExpExecArray | null;
            while ((m = re.exec(paragraphMap.text)) !== null) {
              const localFrom = m.index;
              const localTo = localFrom + m[0].length;
              const from = paragraphMap.offsetToPos(localFrom);
              const to = paragraphMap.offsetToPos(localTo);
              const before = charBefore(tr.doc, from);
              const after = charAfter(tr.doc, to);
              // Guard against matches that are actually part of $$...$$ / $$$...$$$ across node boundaries.
              if (before === "$" || after === "$") continue;
              if (before && /\d/.test(before)) continue;
              if (after && /\d/.test(after)) continue;
              if (selectionTouchesRange(selectionFrom, selectionTo, from, to)) continue;
              inlineHits.push({ from, to, latex: m[1] });
            }
          });
          for (let i = inlineHits.length - 1; i >= 0; i--) {
            const { from, to, latex } = inlineHits[i];
            const $from = tr.doc.resolve(from);
            if (!$from.parent.canReplaceWith($from.index(), $from.index() + 1, inlineMath))
              continue;
            tr.replaceWith(from, to, inlineMath.create({ latex }));
          }

          if (!tr.docChanged) return null;
          tr.setMeta("addToHistory", false);
          return tr;
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
