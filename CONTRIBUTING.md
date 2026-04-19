# Contributing to Prose

Prose is open to contributions. Development is **issue-driven** — every change should relate to an open issue on GitHub. This guide covers how to work with the codebase.

## Setting up

See the `CLAUDE.md` file for dev commands:

```bash
npm run tauri dev      # Full app with hot reload
npm run tauri build    # macOS bundle
npm run build          # TypeScript type-check + Vite build
```

Inside `src-tauri/`:
```bash
cargo check            # Type-check Rust
cargo fmt              # Format (respects rustfmt.toml)
cargo clippy           # Lints
```

**Note:** Port **1420** is reserved for the Vite dev server and hardcoded in `tauri.conf.json`. If a process is using that port, `npm run tauri dev` will hang or fail.

## Code style

### Formatting

EditorConfig enforces:
- **UTF-8** charset
- **LF** line endings (not CRLF)
- 2-space indentation (default); 4 spaces in Rust files
- Final newline at end of file
- No trailing whitespace in code (markdown preserves it)

Most editors support `.editorconfig` automatically. If yours doesn't, install a plugin.

### Commits

Follow **conventional commit** style:

```
<type>: <description>

<optional body>

Closes #<issue-number>
```

**Types:**
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — tooling, dependencies, config (no feature or fix)
- `refactor:` — code reorganization without behavior change
- `docs:` — documentation only

**Example:**
```
feat: add dark mode toggle to settings

Users can now toggle dark mode on/off in the settings menu.
Respects system preference on first launch.

Closes #42
```

**Rules:**
- Always include the issue number in a `Closes #N` line (or `Fixes`, `Resolves`)
- Keep the first line under 70 characters
- Use imperative mood: "add", not "adds" or "added"
- Reference the issue — do not duplicate the issue text

### Branches

Branch names should reference the issue:

```
<issue-number>-<short-description>
```

Example: `14-docs-add-repository-documentation-files-security-architecture-contributing-etc`

## Pull requests

1. **Open an issue first** if one doesn't exist — discussion before code saves rework.
2. **Push to a feature branch** (e.g. `14-docs-add-...`).
3. **Open a PR** on GitHub with a clear summary of the change.
4. **Do not merge or close the PR yourself** — the maintainer will review and merge.
5. **Do not force-push after others have reviewed** — it rewrites history and makes feedback hard to track. Create a new commit instead.

## Language notes

- **Frontend:** React 19, TypeScript, TipTap for rich text editing
- **Backend:** Rust, Tauri 2 (IPC bridge between React and OS APIs)
- **Styling:** Tailwind CSS v3 via PostCSS; `darkMode: "class"`

See `ARCHITECTURE.md` for a deep dive on how the frontend and backend communicate.

## Known limitations

- **No linters or tests** — TypeScript type-checking and Rust `cargo clippy` catch some issues; the rest rely on manual review.
- **No CI** — builds and tests run locally. Before opening a PR, verify:
  - `npm run build` succeeds
  - `cargo clippy` has no warnings (run from `src-tauri/`)
  - `npm run tauri dev` starts without errors

## Getting help

If you're stuck, open an issue and describe what you're trying to do. The maintainer will help steer you in the right direction.
