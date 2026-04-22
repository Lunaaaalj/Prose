import { useEffect, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";

type StatusBarProps = {
  editor: TiptapEditor | null;
  isDirty: boolean;
};

export function StatusBar({ editor, isDirty }: StatusBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const tick = () => setTick((t) => t + 1);
    editor.on("update", tick);
    editor.on("create", tick);
    return () => {
      editor.off("update", tick);
      editor.off("create", tick);
    };
  }, [editor]);

  const text = editor ? editor.getText() : "";
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;

  return (
    <footer className="h-7 shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between px-3 text-xs text-neutral-600 dark:text-neutral-400">
      <div>
        {words} {words === 1 ? "word" : "words"} · {chars}{" "}
        {chars === 1 ? "char" : "chars"}
      </div>
      <div>{isDirty ? "Unsaved changes" : "Saved"}</div>
    </footer>
  );
}
