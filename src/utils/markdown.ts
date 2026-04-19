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
  const withMath = md
    .replace(
      BLOCK_MATH_RE,
      (_m, tex: string) =>
        `<div data-type="block-math" data-latex="${escapeAttr(tex)}"></div>`,
    )
    .replace(
      INLINE_MATH_RE,
      (_m, tex: string) =>
        `<span data-type="inline-math" data-latex="${escapeAttr(tex)}"></span>`,
    );
  return marked.parse(withMath, { async: false, gfm: true, breaks: false }) as string;
}
