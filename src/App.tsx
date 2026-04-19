import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./components/Editor";
import { htmlToMarkdown } from "./utils/markdown";

function App() {
  const [path, setPath] = useState<string | null>(null);
  const [initialMarkdown, setInitialMarkdown] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const editorRef = useRef<TiptapEditor | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const handleChange = useCallback(() => {
    setIsDirty((prev) => (prev ? prev : true));
  }, []);

  const handleOpen = useCallback(async () => {
    const picked = await openDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (typeof picked !== "string") return;
    try {
      const md = await invoke<string>("read_file", { path: picked });
      setPath(picked);
      setInitialMarkdown(md);
      setIsDirty(false);
    } catch (err) {
      window.alert(`Failed to open: ${err}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    let target = pathRef.current;
    if (!target) {
      const picked = await saveDialog({
        defaultPath: "untitled.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (typeof picked !== "string") return;
      target = picked;
    }
    const content = htmlToMarkdown(editor.getHTML());
    try {
      await invoke("write_file", { path: target, content });
      setPath(target);
      setInitialMarkdown(content);
      setIsDirty(false);
    } catch (err) {
      window.alert(`Failed to save: ${err}`);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        void handleOpen();
      } else if (key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleOpen, handleSave]);

  useEffect(() => {
    const name = path ? path.split(/[/\\]/).pop() || "untitled" : "untitled";
    const title = `${isDirty ? "• " : ""}${name} — prose`;
    void getCurrentWindow().setTitle(title);
  }, [path, isDirty]);

  return (
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <Editor
          key={path ?? "untitled"}
          initialMarkdown={initialMarkdown}
          onChange={handleChange}
          editorRef={editorRef}
        />
      </div>
    </main>
  );
}

export default App;
