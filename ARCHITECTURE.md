# Architecture

Prose is a macOS desktop markdown editor built on **Tauri 2** — a framework that pairs a thin Rust backend process with a web-based frontend running in a system WebView. The two processes communicate over a typed IPC bridge rather than HTTP.

## Process model

```
┌─────────────────────────────────────────────┐
│  WebView (frontend)                         │
│  React 19 · TipTap · KaTeX · Tailwind       │
│                                             │
│  invoke("command_name", args)  ─────────┐  │
│  ← Result<T, String>           ◄────────┘  │
└──────────────────────┬──────────────────────┘
                       │  Tauri IPC (serialized messages)
┌──────────────────────▼──────────────────────┐
│  Rust process (backend)                     │
│  src-tauri/src/lib.rs — prose_lib::run()    │
│                                             │
│  #[tauri::command] handlers                 │
│  Plugins: tauri-plugin-opener               │
└─────────────────────────────────────────────┘
```

Neither process can reach the other's internals except through this boundary. The frontend cannot access the filesystem directly — it must call a backend command.

---

## Frontend

**Entry:** `index.html` → `src/main.tsx` → `src/App.tsx`

`main.tsx` mounts the React root and pulls in global styles (Tailwind directives and KaTeX CSS). `App.tsx` is a minimal layout shell — a centered, max-width container — that renders the single `<Editor />` component.

### Editor component (`src/components/Editor.tsx`)

All editor logic lives here. It uses TipTap's `useEditor()` hook, which wraps a ProseMirror document model, and registers the following extensions:

| Extension | Role |
|---|---|
| `StarterKit` | Paragraph, headings (h1–h3), bold, italic, inline code, lists, blockquote, hard break |
| `Placeholder` | "Start writing…" hint when document is empty |
| `HeadingHashHint` | Custom — renders a faint `#` prefix beside headings when the cursor is inside them |
| `MarkdownEditOnTouch` | Custom — when the cursor moves onto a **bold** or *italic* mark boundary, converts the rendered node back to its raw `**text**` / `*text*` markdown syntax for editing |
| `InlineMath` | TipTap mathematics extension — renders `$…$` spans with KaTeX |
| `BlockMath` | TipTap mathematics extension — renders `$$…$$` blocks with KaTeX, centered |
| `MathEditOnTouch` | Custom — when the cursor touches a math node edge, reverts it to its `$…$` / `$$…$$` source |
| `MathMigration` | Custom — watches typed text for `$…$` / `$$…$$` patterns and auto-promotes them to math nodes |

The `MarkdownEditOnTouch` and `MathEditOnTouch` extensions implement a **render-on-blur / edit-on-touch** pattern: content is displayed as a rendered node until the cursor enters, at which point it converts back to raw syntax. This avoids a separate preview pane.

### Conversion logger (`src/utils/conversionLogger.ts`)

A thin utility that calls `invoke("log_conversion", { line })` to append JSON lines to a `conversion.log` file on disk. Used for debugging the markdown↔node conversion pipeline. All disk access goes through the backend command — the frontend has no direct file API.

---

## Backend

**Entry:** `src-tauri/src/main.rs` → `prose_lib::run()`

`main.rs` is a four-line bin that delegates everything to the library crate. All real setup is in `src-tauri/src/lib.rs`.

### `lib.rs` structure

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())   // register plugins
        .invoke_handler(tauri::generate_handler![greet, log_conversion])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Every `#[tauri::command]` function must appear in `generate_handler![]` or calls from the frontend will silently return an error.

### Registered commands

| Command | Signature | Purpose |
|---|---|---|
| `greet` | `(name: &str) -> String` | Boilerplate example; not wired to the UI |
| `log_conversion` | `(app: AppHandle, line: String) -> Result<(), String>` | Appends a line to `$APP_LOG_DIR/conversion.log`; thread-safe via a `static Mutex` |

### Adding a new command

1. Write a `#[tauri::command]` function in `lib.rs`.
2. Add it to `generate_handler![..., your_fn]`.
3. If it needs a new plugin, add `.plugin(...)` in `run()` and a permission entry in `capabilities/default.json`.

---

## Capability / permission system

`src-tauri/capabilities/default.json` declares what the `main` window is allowed to call:

```json
{
  "windows": ["main"],
  "permissions": [
    "core:default",      // core Tauri window/event/menu APIs
    "opener:default"     // tauri-plugin-opener (open URLs / files externally)
  ]
}
```

Calls to APIs not listed here are rejected at the IPC layer regardless of what the frontend code attempts.

---

## Styling

Tailwind v3, configured via PostCSS (`postcss.config.js` + `tailwind.config.js`). Key points:

- **Dark mode:** `darkMode: "class"` — adding `class="dark"` to `<html>` activates dark variants; there is no media-query fallback.
- **Content scan:** `["index.html", "src/**/*.{ts,tsx}"]` — only these files are scanned for utility classes. Classes used in files outside this glob will not be generated.
- **Typography:** `@tailwindcss/typography` provides the `prose` classes applied to the editor container.
- **Custom styles:** ProseMirror-specific overrides and KaTeX display math centering live in `src/index.css` below the Tailwind directives.

---

## Build pipeline

```
Vite (dev: localhost:1420 / prod: dist/)
   └── React + TypeScript → bundled JS/CSS
Tauri CLI
   └── compiles Rust crate → embeds Vite output into native .app / .dmg
```

`npm run tauri dev` runs both processes concurrently and hot-reloads the WebView on frontend changes. `npm run tauri build` produces a macOS app bundle; signing and notarization require additional developer configuration (certificates and Tauri signing setup). The Vite dev port **1420** is hardcoded in `src-tauri/tauri.conf.json`; changing it without updating that file breaks the dev build.

---

## Key files at a glance

| Path | What it does |
|---|---|
| `src/main.tsx` | React entry — mounts root, imports global CSS |
| `src/App.tsx` | Layout shell |
| `src/components/Editor.tsx` | All editor logic — TipTap config, custom extensions, math handling |
| `src/utils/conversionLogger.ts` | IPC wrapper for the disk logger |
| `src-tauri/src/lib.rs` | Tauri builder, plugin registration, command handlers |
| `src-tauri/src/main.rs` | Binary entry — calls `prose_lib::run()` |
| `src-tauri/tauri.conf.json` | Window size/title, bundle identity, dev server URL |
| `src-tauri/capabilities/default.json` | Frontend API permission allowlist |
| `tailwind.config.js` | Tailwind content globs and dark mode strategy |
| `src/index.css` | Tailwind directives + ProseMirror / KaTeX overrides |
