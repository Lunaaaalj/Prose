# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Prose is a macOS desktop markdown editor (Tauri 2 shell, React 19 + TypeScript frontend) targeting markdown with KaTeX math and Pandoc → LaTeX/PDF export. Development is issue-driven against the `v0.1 — core editor` milestone on GitHub; check `gh issue list` for the roadmap.

## Commands

```
npm run tauri dev     # full app: Rust backend + Vite frontend, opens native window
npm run tauri build   # bundle production .app / .dmg (slow first time)
npm run dev           # Vite only (browser preview, no Tauri APIs)
npm run build         # tsc type-check + vite build to dist/
```

Rust-only checks inside `src-tauri/`:
```
cargo check           # type-check without producing a binary
cargo fmt             # format (honors /rustfmt.toml)
cargo clippy          # lints
```

There are no JS/TS linters, unit tests, or CI configured yet.

## Architecture

Two processes that talk over Tauri IPC:

- **Frontend** (`src/`): React + Vite on a fixed dev port **1420** (strict — conflicts kill dev). Entry is `src/main.tsx` → `src/App.tsx`. Tailwind utilities are pulled in via `src/index.css`.
- **Backend** (`src-tauri/`): Rust crate named `prose` that exposes a library `prose_lib`. `src-tauri/src/main.rs` is a thin bin that calls `prose_lib::run()`; the real entrypoint is `src-tauri/src/lib.rs` where the `tauri::Builder` registers plugins and `#[tauri::command]` handlers via `invoke_handler(tauri::generate_handler![...])`.

Frontend invokes backend commands through `@tauri-apps/api/core`'s `invoke("name", args)`; every new command must be added to the `generate_handler![]` list or calls silently fail.

Window config (title, size, identifier) lives in `src-tauri/tauri.conf.json`, not in React. Current defaults: `1200x800`, min `800x600`, title `prose`. `productName` there drives the bundle name.

`capabilities/default.json` controls which Tauri APIs the frontend is allowed to call. New plugins usually need both a `.plugin(...)` line in `lib.rs` and a permission entry here.

## Tailwind

v3 via PostCSS (not the v4 Vite plugin). `darkMode: "class"` — toggling dark mode means adding/removing `class="dark"` on `<html>` or a parent, not media queries. Content globs are `index.html` and `src/**/*.{ts,tsx}` — files outside those paths won't get their classes generated.

## Rust toolchain gotcha

`rustup` adds `~/.cargo/bin` to shell rc files, but terminals opened before the install won't see `cargo` until you `source "$HOME/.cargo/env"` or open a new tab. `npm run tauri dev` will fail with `No such file or directory (os error 2)` from `cargo metadata` when this happens.

## Renaming the crate

If the Rust package is renamed, update three places or builds break:
1. `src-tauri/Cargo.toml` — `[package] name` and `[lib] name`
2. `src-tauri/src/main.rs` — the `<name>_lib::run()` call
3. `src-tauri/tauri.conf.json` — `productName` / `identifier` if they're meant to match

## Documentation

These files exist at the repo root — read them before making structural changes:

- `ARCHITECTURE.md` — deep-dive on the two-process Tauri model, TipTap extensions, IPC boundary, Tailwind setup
- `CONTRIBUTING.md` — commit conventions, branch naming, PR workflow, EditorConfig rules
- `CHANGELOG.md` — version history (Keep a Changelog format); update when shipping a fix or feature
- `SECURITY.md` — responsible disclosure, supported versions, dependency audit guidance
- `THREAT_MODELING.md` — attack surface analysis, risk ratings, future risks

## Git / PR workflow

Do not push or close issues automatically — leave both to the user unless they explicitly ask. Commit messages follow conventional-style (`chore:`, `feat:`, `fix:`) and reference the issue number (`closes #N`).
