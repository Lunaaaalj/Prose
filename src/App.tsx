import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { StatusBar } from "./components/StatusBar";
import { htmlToMarkdown } from "./utils/markdown";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

function App() {
  const [path, setPath] = useState<string | null>(null);
  const [initialMarkdown, setInitialMarkdown] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [docId, setDocId] = useState(0);
  const [editor, setEditor] = useState<TiptapEditor | null>(null);

  const pathRef = useRef(path);
  pathRef.current = path;
  const editorRef = useRef(editor);
  editorRef.current = editor;

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
      setDocId((d) => d + 1);
    } catch (err) {
      window.alert(`Failed to open: ${errorMessage(err)}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    let target = pathRef.current;
    if (!target) {
      const picked = await saveDialog({
        defaultPath: "untitled.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (typeof picked !== "string") return;
      target = picked;
    }
    const content = htmlToMarkdown(currentEditor.getHTML());
    try {
      await invoke("write_file", { path: target, content });
      setPath(target);
      setInitialMarkdown(content);
      setIsDirty(false);
    } catch (err) {
      window.alert(`Failed to save: ${errorMessage(err)}`);
    }
  }, []);

  const handleNew = useCallback(() => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    setPath(null);
    setInitialMarkdown("");
    setIsDirty(false);
    setDocId((d) => d + 1);
  }, [isDirty]);

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
    <div className="h-screen flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex-1 flex min-h-0">
        <Sidebar path={path} onOpen={handleOpen} onNew={handleNew} />
        <main className="flex-1 flex flex-col min-w-0">
          <Toolbar editor={editor} />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[720px] px-6 py-12">
              <Editor
                key={docId}
                initialMarkdown={initialMarkdown}
                onChange={handleChange}
                onEditorReady={setEditor}
              />
            </div>
          </div>
        </main>
      </div>
      <StatusBar editor={editor} isDirty={isDirty} />
    </div>
  );
}

export default App;
