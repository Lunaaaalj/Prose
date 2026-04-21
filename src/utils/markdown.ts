import { marked } from "marked";
import TurndownService from "turndown";

const BLOCK_MATH_RE = /\$\$(?!\$)([\s\S]+?)\$\$/g;
const INLINE_MATH_RE = /(?<![\$\d])\$(?!\$)([^$\n]+?)\$(?!\d)/g;

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

td.addRule("blockMath", {
  filter: (node) =>
    node.nodeName === "DIV" &&
    (node as HTMLElement).getAttribute("data-type") === "block-math",
  replacement: (_content, node) => {
    const latex = (node as HTMLElement).getAttribute("data-latex") ?? "";
    return `\n\n$$${latex}$$\n\n`;
  },
});

td.addRule("inlineMath", {
  filter: (node) =>
    node.nodeName === "SPAN" &&
    (node as HTMLElement).getAttribute("data-type") === "inline-math",
  replacement: (_content, node) => {
    const latex = (node as HTMLElement).getAttribute("data-latex") ?? "";
    return `$${latex}$`;
  },
});

export function htmlToMarkdown(html: string): string {
  const out = td.turndown(html).trim();
  return out.length === 0 ? "" : `${out}\n`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownToHtml(md: string): string {
  const math: { block: boolean; tex: string }[] = [];
  const tokenized = md
    .replace(BLOCK_MATH_RE, (_m, tex: string) => {
      const idx = math.length;
      math.push({ block: true, tex });
      return `\x00B${idx}\x00`;
    })
    .replace(INLINE_MATH_RE, (_m, tex: string) => {
      const idx = math.length;
      math.push({ block: false, tex });
      return `\x00I${idx}\x00`;
    });

  // Neutralize raw HTML in the source so `<script>`/`on*` attributes can't
  // reach TipTap. Only `<` is escaped — `>` is used by markdown blockquotes
  // and `&` collides with legitimate character references.
  const safe = tokenized.replace(/</g, "&lt;");

  const withMath = safe.replace(/\x00([BI])(\d+)\x00/g, (_m, kind: string, idx: string) => {
    const t = math[Number(idx)];
    return kind === "B"
      ? `<div data-type="block-math" data-latex="${escapeAttr(t.tex)}"></div>`
      : `<span data-type="inline-math" data-latex="${escapeAttr(t.tex)}"></span>`;
  });

  return marked.parse(withMath, { async: false, gfm: true, breaks: false }) as string;
}
