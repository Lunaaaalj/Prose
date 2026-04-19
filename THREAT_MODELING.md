# Threat Modeling

A security analysis of Prose's architecture, attack surface, and mitigations.

## Architecture recap

Prose has two processes communicating over Tauri IPC:

```
WebView (React/TS)  ←IPC→  Tauri (Rust)
  Editor state               File I/O
  Markdown input             Command handlers
  Math rendering (KaTeX)     Capability-gated
```

The frontend runs in an isolated Chromium WebView; it cannot access the filesystem directly. All I/O goes through registered Tauri commands, which are capability-checked before execution.

---

## Threat analysis

### 1. Code injection via markdown

**Threat:** User input in the markdown editor could execute code.

**Vectors:**
- **XSS via markdown parsing**: TipTap/ProseMirror parses user text into a DOM tree following a schema that only allows safe node types (paragraph, heading, bold, italic, code, lists, blockquote, math). Raw HTML in the markdown is **not** parsed — it is rendered as literal text. React escapes strings by default. **Risk: Low.**
  
- **XSS via KaTeX math rendering**: LaTeX in `$...$` is passed to KaTeX. KaTeX is a pure renderer; it does not execute arbitrary code. It renders mathematical notation to SVG/DOM. Adversarial LaTeX can cause **DoS** (expensive rendering, exponential expansion) but not code execution. **Risk: Medium** (DoS).
  
  Mitigations:
  - KaTeX is actively maintained and security-conscious.
  - Render complex math in a timeout or with a complexity limit (not yet implemented).
  - Users control their own input; they're not exposed to untrusted LaTeX by default.

- **Injection via `conversion.log` format**: The log line is JSON-serialized before writing to disk. User input is not shell-expanded or eval'd. **Risk: Low.**

**Conclusion:** Prose is **not vulnerable to code injection** under current design. The editing pipeline is single-process (React/ProseMirror); there is no `eval()`, no shell commands, and no template interpolation of user input.

---

### 2. Tauri IPC hijacking

**Threat:** Compromise of the IPC boundary could allow the frontend to call unauthorized backend commands.

**Mitigations:**
- **Capability system**: `capabilities/default.json` declares which APIs the `main` window can invoke. Calls outside this allowlist are rejected at the Tauri layer.
- **WebView isolation**: The frontend runs in a sandboxed Chromium instance. Breaking out would require a Chromium vulnerability (possible but not trivial).
- **Limited backend surface**: Only two commands are registered: `greet` (unused) and `log_conversion` (append-only log). Even if the capability system were bypassed, the damage is limited to appending a line to a log file.

**Risk:** Low (requires Chromium exploit).

---

### 3. Local file system access

**Threat:** If the application is compromised, what files are at risk?

**Current scope:**
- The backend only writes to `$APP_LOG_DIR/conversion.log` (or equivalent platform log directory).
- No read access to the user's home directory.
- The log file is append-only; no delete or modify semantics.

**If cloud sync is added** (future feature):
- Reading arbitrary files from the user's filesystem.
- Uploading to cloud storage.
- **Mitigation needed**: Restrict file access to a single project folder; ask user permission before reading.

**Risk:** Low (current). Medium (when file I/O is expanded).

---

### 4. Third-party dependency vulnerabilities

**Dependencies with security surface:**

| Package | Risk | Mitigation |
|---------|------|-----------|
| **KaTeX 0.16.45** | Math rendering; DoS via complex LaTeX | Actively maintained; constrain render time if needed |
| **TipTap 3.22.3** | Markdown parsing; node schema is restrictive | Schema limits allowed node types; XSS-safe |
| **React 19** | Core framework; rare but possible bugs | Stays current with security patches |
| **Tauri 2** | System APIs; window/plugin system | Maintained by Tauri core team; capabilities limit surface |
| **Node dependencies** (vite, tailwind, etc.) | Build-time only; not in runtime bundle | Run `npm audit` before releases |

**Mitigations:**
- Run `npm audit` and `cargo audit` before releases.
- Subscribe to security advisories for key packages (Tauri, KaTeX, React).
- Keep dependencies current (use Dependabot or similar if in the future).

**Risk:** Medium. Mitigatable via routine audits.

---

### 5. Build and distribution

**Threat:** Unsigned or tampered bundle.

**Current state:**
- The macOS app is built via `npm run tauri build` and notarized (likely, if following Tauri defaults).
- Source code is on GitHub; users can clone and build locally to verify contents.
- No code signing or integrity checking of the packaged `.app` at runtime.

**If Prose is distributed via an app store** (future):
- The store verifies signatures; lower risk.
- Direct .dmg distribution: users should build from source or verify checksums.

**Mitigations:**
- Document the build process in `CONTRIBUTING.md` (already done).
- Consider publishing SHA-256 checksums of releases.
- Sign and notarize the macOS bundle (Tauri does this by default).

**Risk:** Low (current; GitHub + source builds are trustworthy).

---

### 6. Math rendering DoS

**Threat:** A user (or attacker with edit access) provides LaTeX that is expensive to render.

**Example:**
```latex
$\underbrace{\underbrace{...}_{...}}_{...}$ × repeated
```

Complex nesting can cause exponential rendering time, freezing the UI.

**Mitigations:**
- KaTeX has built-in safeguards (max nesting depth, max function calls).
- Render math in a worker or with a timeout (not yet implemented).
- Document best practices for complex equations.

**Risk:** Medium (DoS, not code execution). Mitigatable by adding render timeouts.

---

### 7. WebView sandbox escape

**Threat:** A vulnerability in Chromium could allow breaking out of the WebView.

**Mitigations:**
- Tauri uses the system Chromium (on macOS, the WebKit engine).
- Isolation is enforced at the OS level.
- Capability system limits what the WebView can call even if escape occurs.

**Risk:** Low-to-Medium. Requires a zero-day in the rendering engine. Mitigated by staying current on OS and Tauri updates.

---

### 8. Conversion log injection / log forging

**Threat:** Could an attacker manipulate `conversion.log` to spoof events?

**Current design:**
- The frontend calls `log_conversion` with a JSON line.
- The backend appends it to the log file as-is (no additional wrapping).
- The log is local-only; no remote system reads it.

**Risk:** Low. The log is for debugging; it's not trusted by any authentication or critical system. If an attacker can write to the log file, they've already compromised the app.

---

## Attack tree

```
Compromise Prose
├── Inject code (XSS / RCE)
│   ├── Markdown → XSS        [MITIGATED: schema + React escaping]
│   ├── LaTeX → code          [MITIGATED: KaTeX is safe]
│   └── Log format → code     [MITIGATED: no eval/shell]
│
├── Exploit Tauri IPC
│   ├── Call unauthorized cmd [MITIGATED: capability system]
│   └── Chromium escape       [MITIGATED: OS sandbox + limited cmds]
│
├── Unauthorized file access
│   ├── Read home dir         [MITIGATED: no file access API yet]
│   └── Write log dir         [MITIGATED: append-only]
│
├── DoS
│   ├── Expensive math        [MITIGATED: KaTeX limits]
│   └── Render timeout        [MITIGATED: UI remains responsive]
│
└── Dependency vuln
    ├── KaTeX exploit         [MITIGATED: actively maintained]
    ├── React/Tauri exploit   [MITIGATED: routine audits]
    └── Build-time dep        [MITIGATED: not in bundle]
```

---

## Future risks

As Prose gains features, new threats emerge:

1. **Pandoc integration** (planned for PDF export)
   - Pandoc is a complex text processor; it has had security issues.
   - Mitigation: Run Pandoc in a subprocess; validate/sanitize input and output.

2. **Cloud sync / collaborative editing** (roadmap)
   - Man-in-the-middle attacks on file upload.
   - Unauthorized access to cloud storage.
   - Mitigation: TLS for all network traffic; end-to-end encryption if sensitive; authentication.

3. **Plugins / extensions**
   - User-installed plugins could do anything.
   - Mitigation: Sandboxed plugin system; capability-based permissions; code review.

4. **Macros / scripting**
   - If Prose supports embedded scripts (e.g., in frontmatter), code injection becomes possible.
   - Mitigation: No `eval()`; static analysis only.

---

## Recommendations

### Immediate (v0.1)

- [ ] Add a render timeout to KaTeX to prevent DoS.
- [ ] Run `npm audit` and `cargo audit` before each release.
- [ ] Document the vulnerability reporting process (done in `SECURITY.md`).

### Short-term (v0.2–v0.3)

- [ ] If file I/O is added, restrict to a single project folder.
- [ ] Add checksums to releases on GitHub.
- [ ] Set up Dependabot or similar for automated dependency updates.

### Medium-term (v0.4+)

- [ ] If Pandoc is integrated, validate all input; run in a subprocess.
- [ ] If cloud sync is added, use TLS + authentication + integrity checks.
- [ ] Consider a plugin system with explicit capabilities.

---

## Conclusion

**Prose is not vulnerable to code injection or RCE in its current form.** The architecture—single-process React app → capability-gated Tauri commands—naturally prevents most attack vectors.

The main risks are:

1. **Third-party dependencies** (KaTeX, React, Tauri) — mitigated by routine audits.
2. **Chromium vulnerabilities** (rare) — mitigated by OS sandbox + limited Tauri surface.
3. **Future features** (Pandoc, cloud sync, plugins) — will require careful design.

Users are safe to edit markdown and math locally. As features expand, expand threat modeling to match.
