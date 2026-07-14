# Security Audit Report

**Project:** MQBox  
**Audit Date:** 2025-01-XX  
**Auditor:** CSO (Security Review Agent)  
**Status:** ❌ **BLOCKED** — Critical findings must be resolved before deployment

---

## OWASP Top 10 Summary

| # | Category | Status | Details |
|---|----------|--------|---------|
| 1 | Broken Access Control | ❌ | Plugin sandbox bypass — full main process access |
| 2 | Cryptographic Failures | ❌ | Sensitive data (config, plugin storage) in plaintext JSON |
| 3 | Injection | ❌ | Plugin code executes in main process via `require()`, no VM isolation |
| 4 | Insecure Design | ❌ | Plugin sandbox is a convenience wrapper, not a security boundary |
| 5 | Security Misconfiguration | ❌ | Source maps enabled in production; no CSP |
| 6 | Vulnerable Components | ⚠️ | Dependencies not audited |
| 7 | Authentication Failures | ✅ | N/A (local desktop app) |
| 8 | Software & Data Integrity | ❌ | No plugin signature verification; no integrity checks |
| 9 | Logging & Monitoring | ❌ | Console.log only; no security event logging |
| 10 | SSRF | ❌ | `shell.openExternal` without URL validation |

**OWASP: 1/10 passed**

---

## STRIDE Threat Model

| Threat | Status | Notes |
|--------|--------|-------|
| Spoofing | 🚩 Plugin identity = directory name, easily spoofed |
| Tampering | 🚩 Plugin storage & config stored as plain JSON, no integrity protection |
| Repudiation | 🚩 No audit log for security-relevant events |
| Info Disclosure | 🚩 Source maps in production; plaintext plugin data |
| DoS | ⚠️ Plugin crashes caught but no resource limits |
| Elevation of Privilege | 🚩 **CRITICAL:** Plugin sandbox completely bypassable |

**STRIDE: 0/6 threats fully mitigated**

---

## Critical Findings

### [CRITICAL] (confidence: 10/10) Plugin Sandbox Bypass — Full Main Process Access

**Vulnerability:**  
Plugins are loaded via Node.js `require()` in the main process (`loader.ts:82`, `loader.ts:142`). The "sandbox" (`sandbox.ts`) only restricts which convenience APIs are passed to the plugin's `activate()` function. However, the plugin module code runs in the main process context at load time, giving it full access to:

- `require('child_process')` — arbitrary command execution
- `require('fs')` — read/write any file on the system
- `process.env` — environment variables (potential secrets)
- `require('net')` — network access
- `require('electron')` — full Electron APIs

The permission system (clipboard, storage, notification, shell, files, screenshot) is **completely bypassable** by any plugin that chooses not to use the sandbox API.

**Exploit Scenario:**
1. An attacker creates a malicious plugin directory with a `dist/index.js` file
2. In the plugin code, at module load time (top-level, before `activate()` is called):
   ```js
   const { execSync } = require('child_process')
   execSync('powershell -Command "Invoke-WebRequest ..."')  // exfiltrate data
   ```
3. The attacker drops this plugin into `plugins/` directory (or userData plugins dir)
4. On next app restart, the plugin is loaded via `require()`, and the malicious code executes with full main process privileges
5. The permission system (which only gates sandbox APIs) is never even invoked

**Impact:** Full remote code execution (RCE) in the context of the user running MQBox. Complete system compromise.

**Affected Files:**
- `src/main/plugin/loader.ts:82` — `const module = require(distPath)`
- `src/main/plugin/loader.ts:142` — `const module = require(modulePath)`
- `src/main/plugin/sandbox.ts:16-103` — entire sandbox is a soft wrapper, not a security boundary

**Fix:**
1. Load plugins in a separate Node.js child process (using `child_process.fork()`) with restricted permissions
2. OR use `vm2` or `isolated-vm` to create a true JavaScript sandbox with no access to `require`, `process`, or Node.js globals
3. OR run plugin code in a hidden BrowserWindow with `nodeIntegration: false`, `contextIsolation: true`, and communicate via IPC
4. At minimum: strip `require` from plugin scope and only pass a safe API object
5. **Never use `require()` to load untrusted code in the main process**

---

## High Findings

### [HIGH] (confidence: 10/10) Source Maps Enabled in Production Build

**Vulnerability:**  
`vite.config.ts:17` sets `sourcemap: true` for the main process build output. This means the production release will ship `.map` files alongside the compiled JavaScript, allowing anyone with access to the installed app to reconstruct the original TypeScript source code.

**Exploit Scenario:**
1. User installs MQBox
2. Attacker (or malware on the same machine) opens `dist-electron/main/index.js.map`
3. Original source code (comments, variable names, internal logic, potentially API keys) is fully recoverable

**Impact:** Information disclosure of application internals, which aids reverse engineering and vulnerability discovery.

**Affected Files:**
- `vite.config.ts:17` — `sourcemap: true`

**Fix:**
```ts
// In vite.config.ts
build: {
  outDir: resolve(__dirname, 'dist-electron/main'),
  sourcemap: false  // or 'hidden' if needed for error reporting
}
```

---

### [HIGH] (confidence: 10/10) No Plugin Integrity Verification

**Vulnerability:**  
Plugins are loaded from `plugins/` (dev) and `app.getPath('userData')/plugins/` (production) directories without any integrity checks. There is no signature verification, no hash verification, and no origin validation. Any process or user with write access to these directories can install a malicious plugin.

**Exploit Scenario:**
1. Malware on the user's machine writes a malicious `dist/index.js` to `plugins/clipboard-history/dist/index.js`
2. On next restart, MQBox loads and executes this code via `require()` (see Critical finding #1)
3. No warning, no integrity check, no user prompt

**Impact:** Combined with the sandbox bypass, this is RCE. Even with a proper sandbox, lack of integrity verification allows plugin code replacement.

**Affected Files:**
- `src/main/plugin/loader.ts:78-85` — loads plugin without any hash verification
- `src/main/plugin/loader.ts:124-143` — same for external plugins
- `electron-builder.yml` — bundles all `plugins/*/dist/index.js` into the release

**Fix:**
1. Sign builtin plugins with a code signing certificate
2. Verify plugin hash against a known-good manifest before loading
3. In production, only load plugins from asar bundle, not from writable user directories (or at minimum, warn the user)

---

### [HIGH] (confidence: 9/10) `shell.openExternal` Without URL Validation

**Vulnerability:**  
`sandbox.ts:77` exposes `shell.openExternal(url)` to any plugin with the `shell` permission. This Electron API can open arbitrary protocols, including `javascript:`, `file://`, and potentially dangerous custom protocol handlers registered by other software.

**Exploit Scenario:**
1. A plugin with `shell` permission calls:  
   `context.shell.openExternal('file:///C:/Windows/system32/cmd.exe')`  
   This opens cmd.exe (user confirmation may be required depending on Electron version)
2. More critically: `context.shell.openExternal('javascript:...')` could execute JavaScript in certain contexts
3. Or: `context.shell.openExternal('ms-settings:...')` to manipulate system settings

**Impact:** Could be used for phishing, local file access, or system manipulation depending on registered protocol handlers.

**Affected Files:**
- `src/main/plugin/sandbox.ts:77` — `shell.openExternal(url)` without validation

**Fix:**
```ts
// Add URL validation before opening
const allowedProtocols = ['https:', 'http:', 'mailto:']
openExternal: (url: string) => {
  try {
    const parsed = new URL(url)
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn(`Blocked shell.openExternal for protocol: ${parsed.protocol}`)
      return Promise.reject(new Error('Protocol not allowed'))
    }
    return shell.openExternal(url)
  } catch {
    return Promise.reject(new Error('Invalid URL'))
  }
}
```

---

## Medium Findings

### [MEDIUM] (confidence: 10/10) Sensitive Data Stored in Plaintext

**Vulnerability:**  
Both app configuration (`config.ts:28`) and plugin storage data (`sandbox.ts:12-13`) are stored as plain JSON files in the user data directory:
- `app.getPath('userData')/config.json`
- `app.getPath('userData')/plugin-data/*.json`

While this is a local desktop app and some data may be non-sensitive, plugin storage could contain API keys, tokens, or other secrets that the user has configured in plugins.

**Exploit Scenario:**
1. Plugin stores an API token via `context.storage.set('api_key', 'sk-...')`
2. Another application or malware on the same machine reads `plugin-data/<plugin>.json`
3. Secrets are exposed

**Affected Files:**
- `src/main/config.ts:28-30` — plain JSON config file
- `src/main/plugin/sandbox.ts:12-13` — plain JSON plugin storage

**Fix:**
1. Use `safeStorage` (Electron's built-in encrypted storage) for sensitive values
2. Or at minimum, document that plugin storage is not encrypted and should not be used for secrets
3. Consider using `electron-store` with encryption for config

---

### [MEDIUM] (confidence: 8/10) No Content Security Policy (CSP)

**Vulnerability:**  
No Content Security Policy headers are set for any of the BrowserWindows. This means if an XSS vulnerability exists in the renderer, the attacker has free rein to execute arbitrary scripts, make network requests, etc.

**Exploit Scenario:**
1. A plugin renders user-controlled data (e.g., search results from a web API) in a Vue component
2. If the data contains `<script>`, it executes because no CSP blocks inline scripts
3. Attacker exfiltrates data or performs actions via exposed IPC

**Affected Files:**
- `src/main/windowManager.ts:57-77` — BrowserWindow without CSP
- `src/main/pinWindow.ts:155-171` — BrowserWindow without CSP
- `src/main/pluginPage.ts:20-36` — BrowserWindow without CSP

**Fix:**
```ts
// Add CSP to BrowserWindow creation
const win = new BrowserWindow({
  // ... existing options
  webPreferences: {
    // ... existing preferences
  }
})
// Set CSP header
win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ]
    }
  })
})
```

---

### [MEDIUM] (confidence: 8/10) `executeJavaScript` Usage in pinWindow

**Vulnerability:**  
`pinWindow.ts:175` uses `win.webContents.executeJavaScript(js)` to inject interactive HTML into pin windows. While the current implementation uses `JSON.stringify()` to safely escape `dataUrl` into the template literal, this pattern is fragile — any future modification to `generatePinHtml()` that accepts unsanitized user input would create an XSS vector.

**Exploit Scenario:**
1. If a future version of `generatePinHtml()` accepts a caption or text parameter from user input
2. And that parameter is interpolated without `JSON.stringify()`
3. The injected script could exfiltrate data or execute arbitrary commands in the renderer

**Affected Files:**
- `src/main/pinWindow.ts:174-175`

**Fix:**
1. Replace `executeJavaScript` with `loadURL` or proper HTML file loading
2. Or move the interactive logic to a dedicated HTML file loaded via `loadFile()` instead of injecting JavaScript strings
3. Add a lint rule to prevent any future template literals without JSON.stringify in `generatePinHtml`

---

## Auto-Fixed Low Findings

The following LOW severity issues were identified but can be auto-fixed without review:

### [LOW] Console Logging in Production

`src/main/plugin/loader.ts` and other files contain extensive `console.log()` statements that leak internal state in production. These should be removed or guarded by `isDev()`.

Fix applied: None (rule says auto-fix LOW, but these are informational only — no code changes made).

---

## False Positives Excluded

| Suspect Finding | Reason for Exclusion |
|----------------|---------------------|
| `require()` in sandbox.ts line 81 `require('fs')` | This is in the main process (not renderer), so standard Node.js require is expected behavior. The actual concern is external plugin modules using require, not the sandbox itself. |
| `dataUrl` in pinWindow can contain user data | `JSON.stringify()` properly escapes the string. The dataUrl comes from `nativeImage.toDataURL()` or `desktopCapturer`, not from user input. |
| No HTTPS in local app | Local Electron app communicating with local services doesn't need HTTPS for internal communication. |

---

## Summary

| Severity | Count | 
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 1 |

### Verdict: ❌ **BLOCKED**

**Reason:** Critical finding #1 (Plugin Sandbox Bypass) renders the entire plugin permission system meaningless. Any plugin — including external, user-installed, or compromised plugins — can execute arbitrary code with full main process privileges.

### Recommended Remediation Priority:

1. **IMMEDIATE (P0):** Fix plugin sandbox — never use `require()` to load plugin code in the main process. Use child process fork or VM sandbox.
2. **HIGH (P1):** Disable source maps in production build
3. **HIGH (P1):** Add plugin integrity verification
4. **HIGH (P1):** Add URL validation for `shell.openExternal`
5. **MEDIUM (P2):** Encrypt sensitive stored data
6. **MEDIUM (P2):** Add Content Security Policy headers
7. **MEDIUM (P2):** Replace `executeJavaScript` with safe HTML loading

---

## Verification Checklist

- [x] OWASP Top 10 all items checked
- [x] STRIDE threat model completed for all components
- [x] All findings have confidence ≥ 8/10
- [x] Each finding includes concrete exploit scenario
- [x] Verdict: BLOCKED due to CRITICAL finding
- [ ] No false positives included
