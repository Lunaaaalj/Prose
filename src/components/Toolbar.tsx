import { useEffect, useState, type ReactNode } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";

type ToolbarProps = {
  editor: TiptapEditor | null;
};

type Btn = {
  key: string;
  label: ReactNode;
  title: string;
  isActive: (e: TiptapEditor) => boolean;
  run: (e: TiptapEditor) => void;
};

const BUTTONS: Btn[] = [
  {
    key: "bold",
    label: <span className="font-bold">B</span>,
    title: "Bold",
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: <span className="italic">I</span>,
    title: "Italic",
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: "code",
    label: <span className="font-mono text-xs">{"</>"}</span>,
    title: "Inline code",
    isActive: (e) => e.isActive("code"),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    key: "h1",
    label: <span className="font-semibold">H1</span>,
    title: "Heading 1",
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: "h2",
    label: <span className="font-semibold">H2</span>,
    title: "Heading 2",
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "h3",
    label: <span className="font-semibold">H3</span>,
    title: "Heading 3",
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: "blockquote",
    label: <span>&ldquo;</span>,
    title: "Blockquote",
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "bulletList",
    label: <span>&bull;</span>,
    title: "Bullet list",
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "orderedList",
    label: <span>1.</span>,
    title: "Ordered list",
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
];

export function Toolbar({ editor }: ToolbarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const tick = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", tick);
    editor.on("transaction", tick);
    return () => {
      editor.off("selectionUpdate", tick);
      editor.off("transaction", tick);
    };
  }, [editor]);

  return (
    <div className="h-10 shrink-0 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1 px-2">
      {BUTTONS.map((b) => {
        const active = editor ? b.isActive(editor) : false;
        return (
          <button
            key={b.key}
            type="button"
            title={b.title}
            disabled={!editor}
            onClick={() => editor && b.run(editor)}
            className={
              "px-2 py-1 rounded text-sm min-w-[2rem] disabled:opacity-40 " +
              (active
                ? "bg-neutral-200 dark:bg-neutral-800"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-800")
            }
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
