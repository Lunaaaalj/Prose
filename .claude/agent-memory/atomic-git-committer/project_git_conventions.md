---
name: Prose git conventions
description: Commit style, branch naming, issue-linking, and PR workflow for the Prose repo
type: project
---

Conventional Commits prefixes in use: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:` (inferred from `chore:` for docs in history). Scopes used parenthetically, e.g., `feat(backend):`, `refactor(styles):`, `feat(ui):`.

Subject line: imperative, no trailing period, capitalize after the colon+space.

Issue references: `refs #N` when the commit contributes to but does not fully close an issue; `closes #N` only on the commit that fully resolves it. User closes issues manually — do not use `closes` preemptively.

Branch naming: `<issue-number>-<short-slug>`, e.g., `issue-5-app-layout`.

Do not push or open PRs automatically — leave to the user unless explicitly asked.

Files frequently grouped together:
- `tailwind.config.js` + `src/index.css` + `src/styles/themes.css` (theming changes)
- `src-tauri/src/lib.rs` alone for backend command additions
- New component files (`src/components/*.tsx`) + `src/App.tsx` + `ARCHITECTURE.md` (UI shell changes)

**Why:** Observed directly from git log and CLAUDE.md / CONTRIBUTING.md instructions.

**How to apply:** Follow this grouping and naming exactly. Always check whether an issue is fully closed before using `closes #N`.
