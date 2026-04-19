# Changelog

All notable changes to Prose are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- `ARCHITECTURE.md` — deep-dive on the two-process Tauri model, IPC boundary, TipTap extensions, Tailwind setup
- `CONTRIBUTING.md` — contribution guidelines, commit conventions, branch naming, PR workflow
- `SECURITY.md` — responsible disclosure policy, supported versions, supply chain audit guidance
- `THREAT_MODELING.md` — attack surface analysis, threat tree, current risk ratings, future risk roadmap
- `CHANGELOG.md` — this file

### Known issues (tracked in `small_bugs.md`)

- Cursor renders inside heading hash symbol instead of beside it
- First inline equation briefly shows cursor inside the equation on close
- `$$…$$` mid-paragraph falls back to inline math (block detection is anchored to whole paragraphs)
- Multi-line `$$\n…\n$$` block math does not render; only single-line `$$…$$` works
- Pasting markdown with math strips the `$` delimiters
- `***bold italics***` syntax not supported
- Backspacing into a math equation moves cursor inside instead of stopping at the outer `$`

---

## [0.0.3] — 2025-01 (math render reliability)

### Added

- Conversion logger: frontend calls `log_conversion` Tauri command to append JSON lines to `$APP_LOG_DIR/conversion.log` for debugging the markdown ↔ node pipeline
- `src/utils/conversionLogger.ts` — thin IPC wrapper for the logger

### Fixed

- Math render/revert reliability: `MathEditOnTouch` and `MarkdownEditOnTouch` now correctly revert rendered nodes to markdown source when the cursor touches them, and re-render on cursor exit
- Block math (`$$…$$`) and inline math (`$…$`) detection made more robust; improved handling of block vs inline edge cases in `MathMigration`

### Notes

- This fix was reverted and re-applied across PRs #9–13 due to a regression; the final state (post-PR #13) is stable

---

## [0.0.2] — 2025-01 (math and markdown editing)

### Added

- Math support: inline math via `$…$` and block math via `$$…$$`, rendered with KaTeX
- `InlineMath` and `BlockMath` TipTap extensions (via `@tiptap/extension-mathematics`)
- `MathMigration` extension — auto-promotes `$…$` typed text to math nodes
- `MathEditOnTouch` extension — reverts math nodes to source when cursor touches the boundary
- `MarkdownEditOnTouch` extension — converts bold/italic marks to `**text**`/`*text*` markdown when cursor enters
- `HeadingHashHint` extension — shows faint `#` prefix beside headings when cursor is inside
- `@tailwindcss/typography` prose classes for editor typography

---

## [0.0.1] — 2025-01 (initial scaffold)

### Added

- Tauri 2 project scaffold with React 19, TypeScript, Vite, and Tailwind CSS v3
- TipTap rich text editor with `StarterKit` (paragraphs, headings, bold, italic, code, lists, blockquote)
- `Placeholder` extension ("Start writing…")
- Dark mode support via `darkMode: "class"` Tailwind strategy
- `CLAUDE.md` with developer guidance, build commands, and architecture overview
- `tauri-plugin-opener` for opening external URLs

---

[Unreleased]: https://github.com/Lunaaaalj/Prose/compare/0.0.3...HEAD
