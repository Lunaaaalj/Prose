# Prose

A macOS desktop markdown editor with first-class math support.

Prose is built on **Tauri 2** (Rust backend) and **React 19** (TypeScript frontend). It renders markdown as rich text while you type — bold, italic, headings, code blocks — and renders `$…$` / `$$…$$` math using KaTeX. Clicking into any rendered node converts it back to markdown for editing.

The goal is a minimal, distraction-free writing environment for documents that mix prose and mathematics, with Pandoc → PDF export planned.

**Status:** Pre-release. Active development toward `v0.1 — core editor`.

---

## Documentation

Read these before contributing or making changes:

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the app is structured: Tauri two-process model, IPC boundary, TipTap extensions, Tailwind setup
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to set up the dev environment, branch naming, commit conventions, PR workflow
- [CHANGELOG.md](CHANGELOG.md) — version history
- [SECURITY.md](SECURITY.md) — how to report vulnerabilities, supported versions
- [THREAT_MODELING.md](THREAT_MODELING.md) — security analysis and risk ratings
- [CLAUDE.md](CLAUDE.md) — guidance for AI-assisted development (build commands, architecture notes)

---

## Quick start

```bash
npm install
npm run tauri dev     # opens the native app window with hot reload
```

Requires Node, Rust, and the Tauri CLI. See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup.

---

## License

TBD.
