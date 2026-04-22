import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./components/Editor";
import { Sidebar, type FileEntry } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { htmlToMarkdown } from "./utils/markdown";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function App() {
  const [path, setPath] = useState<string | null>(null);
  const [initialMarkdown, setInitialMarkdown] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [docId, setDocId] = useState(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editorRef = useRef<TiptapEditor | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const recomputeCounts = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      setWordCount(0);
      setCharCount(0);
      return;
    }
    const text = editor.getText();
    setWordCount(countWords(text));
    setCharCount(text.length);
  }, []);

  const handleChange = useCallback(() => {
    setIsDirty((prev) => (prev ? prev : true));
    recomputeCounts();
  }, [recomputeCounts]);

  const loadFile = useCallback(async (target: string) => {
    try {
      const md = await invoke<string>("read_file", { path: target });
      setPath(target);
      setInitialMarkdown(md);
      setIsDirty(false);
      setDocId((d) => d + 1);
    } catch (err) {
      window.alert(`Failed to open: ${errorMessage(err)}`);
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const picked = await openDialog({ directory: true });
    if (typeof picked !== "string") return;
    try {
      const entries = await invoke<FileEntry[]>("list_markdown_files", {
        dir: picked,
      });
      setFolder(picked);
      setFiles(entries);
    } catch (err) {
      window.alert(`Failed to open folder: ${errorMessage(err)}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    let target = pathRef.current;
    if (!target) {
      const picked = await saveDialog({
        defaultPath: folder ? undefined : "untitled.md",
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
      if (folder) {
        try {
          const entries = await invoke<FileEntry[]>("list_markdown_files", {
            dir: folder,
          });
          setFiles(entries);
        } catch {
          // ignore refresh failure
        }
      }
    } catch (err) {
      window.alert(`Failed to save: ${errorMessage(err)}`);
    }
  }, [folder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        void handleOpenFolder();
      } else if (key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleOpenFolder, handleSave]);

  useEffect(() => {
    const name = path ? path.split(/[/\\]/).pop() || "untitled" : "untitled";
    const title = `${isDirty ? "• " : ""}${name} — prose`;
    void getCurrentWindow().setTitle(title);
  }, [path, isDirty]);

  useEffect(() => {
    recomputeCounts();
  }, [docId, recomputeCounts]);

  const filename = path ? path.split(/[/\\]/).pop() || "untitled" : "untitled";

  return (
    <div className="flex h-screen bg-bg text-fg">
      <Sidebar
        folder={folder}
        files={files}
        activePath={path}
        onOpenFolder={handleOpenFolder}
        onSelectFile={loadFile}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[720px] px-6 py-12">
            <Editor
              key={docId}
              initialMarkdown={initialMarkdown}
              onChange={handleChange}
              editorRef={editorRef}
            />
          </div>
        </div>
        <StatusBar
          filename={filename}
          isDirty={isDirty}
          wordCount={wordCount}
          charCount={charCount}
        />
      </div>
    </div>
  );
}

export default App;
