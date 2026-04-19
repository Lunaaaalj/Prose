# Security Policy

## Reporting vulnerabilities

If you discover a security vulnerability in Prose, **do not open a public issue**. Instead, email a detailed report to:

**lunaleija@outlook.com**

Include:
- A description of the vulnerability and its impact
- Steps to reproduce (if applicable)
- Any proof-of-concept code
- Your name and affiliation (optional)

We will acknowledge receipt within 48 hours and work toward a fix. Once a fix is available, we'll coordinate a disclosure timeline with you.

## Supported versions

Prose is in pre-release (v0.1). There are no stable releases yet.

- **main branch** — development version (unreliable, for testing)
- **Releases on GitHub** — tagged versions with known state

**Security updates** are available on the main branch and in new releases. We recommend staying current or testing on main if you're reporting issues.

## Security considerations for users

### What Prose does and doesn't do

**Prose currently:**
- Edits markdown files locally on your machine
- Does not send data to external servers
- Uses Tauri (a secure framework that uses the system WebView and communicates via IPC, not HTTP)
- Logs conversion events to a local `conversion.log` file for debugging

**Prose does NOT:**
- Sync files to cloud services
- Phone home or collect analytics
- Execute untrusted code

### Third-party dependencies

Prose depends on:
- **Node packages:** React, TipTap, KaTeX, Tailwind (see `package.json`)
- **Rust crates:** Tauri, serde, plugins (see `src-tauri/Cargo.toml`)

We rely on the upstream maintainers of these projects for security. Check npm and crates.io for advisories on these packages if you have concerns.

## Supply chain security

### Dependency audits

Before a release, run:

```bash
npm audit
cargo audit
```

Both tools report known vulnerabilities in dependencies. Fix or upgrade vulnerable packages before shipping.

### Building from source

To verify you're running code from a trusted source:

```bash
git clone https://github.com/Lunaaaalj/Prose.git
cd Prose
npm install
npm run tauri build
```

This produces a macOS app bundle. Signing and notarization require additional configuration (developer certificates and Tauri signing setup). You can inspect the code in `src/` and `src-tauri/` before building.

## Security roadmap

As Prose matures and gains features (cloud sync, collaborative editing, file export), we will expand this policy with:
- Encryption practices
- Authentication and access controls
- Data retention and deletion policies
- Incident response procedures

For now, the primary attack surface is **third-party dependencies** and **the Tauri framework itself**.

## Questions?

If you have a question about Prose's security architecture or practices, open an issue on GitHub or email lunaleija@outlook.com.
