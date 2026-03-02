# Fetchy — Architecture Review

> **Date:** February 28, 2026
> **Scope:** Full codebase review against 5 Architecturally Significant Requirements
> **Status:** Initial assessment

---

## Table of Contents

- [Fetchy — Architecture Review](#fetchy--architecture-review)
  - [Table of Contents](#table-of-contents)
  - [ASR Assessment](#asr-assessment)
    - [1. Reliability — Grade: C](#1-reliability--grade-c)
    - [2. Security — Grade: D](#2-security--grade-d)
    - [3. Maintainability — Grade: D+](#3-maintainability--grade-d)
    - [4. Functional Stability — Grade: C](#4-functional-stability--grade-c)
    - [5. Compatibility — Grade: C+](#5-compatibility--grade-c)
    - [Summary Heat Map](#summary-heat-map)
  - [Prioritized Remediation Roadmap](#prioritized-remediation-roadmap)
    - [P0 — Must fix before any release (Security + Reliability blockers)](#p0--must-fix-before-any-release-security--reliability-blockers)
    - [P1 — High priority (Functional Stability + Security hardening)](#p1--high-priority-functional-stability--security-hardening)
    - [P2 — Important (Maintainability + Functional Stability)](#p2--important-maintainability--functional-stability)
    - [P3 — Planned improvements (Maintainability + Compatibility)](#p3--planned-improvements-maintainability--compatibility)
    - [Effort vs Impact Matrix](#effort-vs-impact-matrix)

---

## ASR Assessment

### 1. Reliability — Grade: C

| Weakness | Location |
|:---|:---|
| **No React Error Boundary** — any runtime error in a component crashes the entire UI to a white screen | `src/App.tsx` (missing) |
| **`window.location.reload()`** for workspace switching — discards unsaved state, creates race conditions with multiple rapid switches | `src/store/workspacesStore.ts` L137, L155, L176 |
| **Non-atomic file writes** — `fs.writeFileSync` without temp-file+rename; a crash or power loss mid-write corrupts the entire workspace JSON | `electron/main.js` L258 |
| **Full state serialized on every mutation** — a failed write loses all changes, and no backup/snapshot mechanism exists | `src/store/persistence.ts` L228 |
| **Git auto-sync failures are silently swallowed** — user has no indication their data didn't push; pull-before-push not implemented, so concurrent users can diverge | `src/store/persistence.ts` L50 |
| **No request timeout configurability** — hard-coded 30s for HTTP, 60s for AI; long-running APIs get killed arbitrarily | `electron/main.js` L540 |
| **Storage watcher race window** — the 2-second "own-write" suppression window is arbitrary; a slow disk could still trigger false reload | `electron/main.js` L27 |

---

### 2. Security — Grade: D

| Weakness | Location |
|:---|:---|
| **Arbitrary code execution** — `new Function(script)` runs user/imported scripts in the renderer with access to `window.electronAPI` (read/write files, execute git, read secrets) | `src/utils/httpClient.ts` L291, L330 |
| **Path traversal in IPC** — `read-data` / `write-data` join unsanitized filenames with the data directory; `../../` escapes to arbitrary filesystem paths | `electron/main.js` L244, L258 |
| **TLS verification unconditionally disabled** — `rejectUnauthorized: false` on all HTTP requests including AI API calls carrying API keys, enabling MITM attacks | `electron/main.js` L512, L759 |
| **Secrets stored as plaintext JSON** — `fetchy-secrets.json` and `ai-secrets.json` are unencrypted on disk; no use of Electron's `safeStorage` or OS keychain | `electron/main.js` L273 |
| **No Content-Security-Policy** — no CSP headers or meta tags configured, weakening defense-in-depth against XSS | `electron/main.js` L161 (BrowserWindow config) |
| **Browser mode: secrets in localStorage** — accessible to any JS on the page (XSS vector) | `src/store/persistence.ts` L273 |
| **No IPC input validation** — all `ipcMain.handle` callbacks trust renderer-supplied parameters without schema validation | `electron/main.js` (throughout) |
| **Gemini API key in URL query string** — API key passed as `?key=` URL parameter, visible in logs and potentially leaked via referrer headers | `electron/main.js` L654 |
| **Git credentials handled implicitly** — `git clone`, `git push` rely on ambient OS credentials with no scoped auth | `electron/main.js` L948 |

---

### 3. Maintainability — Grade: D+

| Weakness | Location |
|:---|:---|
| **Monolithic main process** — 1,169 lines mixing window management, preferences, HTTP proxy, AI routing, Git ops, secrets, and workspaces in a single file | `electron/main.js` |
| **Giant components** — Sidebar (1,708 lines), RequestPanel (1,341), AIAssistant (716), App (570); each violates SRP and is extremely difficult to review or modify safely | `src/components/Sidebar.tsx`, `src/components/RequestPanel.tsx` |
| **Main process is plain JS, rest is TypeScript** — the most security-critical layer lacks type safety, making refactoring risky | `electron/main.js` |
| **No linting configuration** — no `.eslintrc`, `.prettierrc`, or equivalent visible in the project root; code style enforcement relies on convention only | Project root |
| **Tight coupling** — components destructure 10–20+ actions directly from stores, making isolated testing or component reuse impractical | `src/components/Sidebar.tsx`, `src/components/RequestPanel.tsx` |
| **Duplicated persistence logic** — Electron vs browser storage paths duplicate the same secret extraction, history truncation, and serialization logic | `src/store/persistence.ts` L200 vs L280 |
| **Barrel re-exports** — `helpers.ts` re-exports 10+ modules, defeating tree-shaking and making dependency tracing opaque | `src/utils/helpers.ts` |
| **Minimal test coverage** — only 3 test files (all for import adapters); zero tests for stores, httpClient, persistence, or main process | `test/` |
| **No inline documentation** — main.js has section headers but no JSDoc on IPC handlers; stores/components have no doc comments | Throughout |
| **`require()` inside Zustand store** — `persistence.ts` dynamically `require('./workspacesStore')` to avoid circular deps, a code smell indicating coupling problems | `src/store/persistence.ts` L36 |

---

### 4. Functional Stability — Grade: C

| Weakness | Location |
|:---|:---|
| **Stale state in RequestPanel** — maintains a local copy of request state via `useState` + `useEffect` sync; already caused bugs (acknowledged in code comments) | `src/components/RequestPanel.tsx` L56 |
| **Auth inheritance only resolves one level** — collection runner's `getInheritedAuth` checks folder → collection, but nested folders 2+ levels deep don't walk the full ancestor chain | `src/components/RunCollectionModal.tsx` |
| **Collection runner ignores pre/post scripts** — requests executed via the runner skip `preScript`/`script` execution, producing different behavior than manual execution | `src/components/RunCollectionModal.tsx` |
| **AbortController not wired to requests** — the collection runner checks `signal.aborted` between requests, but in-flight requests cannot be cancelled; "Stop" doesn't actually stop the current request | `src/components/RunCollectionModal.tsx` |
| **`importCollection` doesn't regenerate child IDs** — new collection ID is generated, but all inner request/folder IDs are preserved; duplicating an import creates ID collisions in the store | `src/store/appStore.ts` L831 |
| **Export only sanitizes 2 nesting levels** — `exportFullStorage` sanitizes `folder.auth` and `subFolder.auth` but deeper nesting is untouched; secrets in deeply nested folders leak into exports | `src/store/appStore.ts` L862 |
| **Git log parsing uses `\|` as delimiter** — commit messages containing `\|` corrupt the parsed hash/message/author/date fields | `electron/main.js` L1094 |
| **No request cancellation for manual execution** — once "Send" is pressed, there's no way to cancel an in-flight HTTP request | `src/utils/httpClient.ts` |
| **Script execution has no timeout** — a `while(true){}` in a pre-script freezes the entire renderer permanently with no recovery | `src/utils/httpClient.ts` L291 |
| **Pause in collection runner uses CPU-burning polling** — `while(pauseRef.current) await sleep(100)` busy-waits, draining battery and CPU | `src/components/RunCollectionModal.tsx` |

---

### 5. Compatibility — Grade: C+

| Weakness | Location |
|:---|:---|
| **Browser mode is dev-only** — the CORS proxy is a Vite dev-server plugin; production builds have no browser HTTP support, making the "browser fallback" non-functional in shipped builds | `vite.config.ts` L10 |
| **FormData not supported through Electron IPC** — `httpRequest` IPC only accepts `string` body; `form-data` body type silently falls back to `undefined` in Electron mode | `src/utils/httpClient.ts` L174 |
| **No corporate proxy support** — HTTP requests go direct; users behind corporate proxies/firewalls cannot use Fetchy without manual OS-level proxy config | `electron/main.js` L505 |
| **Git assumes `git` on PATH** — no bundled git, no detection of Git install location; fails silently on systems without Git | `electron/main.js` L842 |
| **No data format migration system** — exports carry `version: "1.0"` but there is no migration handler for breaking schema changes between app versions | `src/store/persistence.ts` L238 |
| **No import schema validation** — `importWorkspaceFromJson`, `importCollection`, and Postman/Hoppscotch/Bruno importers trust input shape without validation; malformed files produce cryptic runtime errors | `src/store/workspacesStore.ts`, `src/utils/` |
| **Vite 4 + Electron 40** — Vite 4 is EOL (Vite 6 is current); Electron 40's Chromium may lack latest web API support or security patches | `package.json` |
| **No response encoding handling** — all response bodies are decoded as UTF-8; binary responses (images, protobuf) or non-UTF-8 charsets are corrupted | `electron/main.js` L524 |
| **`btoa()` for Basic auth** — doesn't handle non-ASCII characters in usernames/passwords correctly; needs `TextEncoder` + base64 approach | `src/utils/httpClient.ts` L93 |

---

### Summary Heat Map

| ASR | Grade | Top Risk |
|:---|:---:|:---|
| **Reliability** | **C** | Non-atomic writes + no error boundaries = data loss on crash |
| **Security** | **D** | `new Function()` + path traversal + TLS disabled = exploitable chain |
| **Maintainability** | **D+** | 1,100–1,700 line files with zero tests for critical paths |
| **Functional Stability** | **C** | Stale state bugs, incomplete auth inheritance, script hangs |
| **Compatibility** | **C+** | Browser mode non-functional in prod, no proxy support, binary responses broken |

---

## Prioritized Remediation Roadmap

### P0 — Must fix before any release (Security + Reliability blockers)

| # | Issue | ASR | Effort | What to do |
|:---:|:---|:---:|:---:|:---|
| 1 | **Sandbox script execution** — `new Function()` in renderer gives full access to `window.electronAPI`, filesystem, secrets | Security | Medium | Run user scripts in a Web Worker or `isolated-vm` with a strict API allowlist; no access to `window`, `document`, or `electronAPI` |
| 2 | **Sanitize file paths in IPC** — `read-data`/`write-data` accept unsanitized filenames, enabling `../../` traversal | Security | Low | `path.resolve()` + verify result starts with the expected data directory; reject anything else |
| 3 | **Enable TLS verification by default** — `rejectUnauthorized: false` hardcoded on all outbound connections including AI calls carrying API keys | Security | Low | Default to `true`; add a per-request "Disable SSL verification" toggle for user HTTP requests only; never disable for AI API calls |
| 4 | **Atomic file writes** — `writeFileSync` directly to the target path; crash mid-write = corrupt workspace | Reliability | Low | Write to `filename.tmp`, then `fs.renameSync` to final path (atomic on NTFS/ext4/APFS) |
| 5 | **Add React Error Boundary** — any unhandled exception in the component tree white-screens the entire app | Reliability | Low | Wrap root `<App>` in an Error Boundary with a recovery UI and "Reload" action |

---

### P1 — High priority (Functional Stability + Security hardening)

| # | Issue | ASR | Effort | What to do |
|:---:|:---|:---:|:---:|:---|
| 6 | **Script execution timeout** — `while(true){}` in a pre-script freezes the renderer permanently | Func. Stability | Low | Wrap `new Function` (or Worker) execution in a timeout (e.g., 10s); kill and report error on expiry |
| 7 | **Debounce persistence writes** — every keystroke serializes the entire state to disk | Reliability | Low | Add a 1–2s debounce on the Zustand `persist` middleware's `setItem` call |
| 8 | **Cap in-memory response size** — each tab holds the full response body; multi-MB responses cause OOM | Reliability | Medium | Truncate in-memory display at a configurable limit (e.g., 5 MB); offer "Save full response to file" for larger payloads |
| 9 | **Add Content-Security-Policy** — no CSP configured, weakening defense-in-depth | Security | Low | Set a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` in main process: `script-src 'self'` |
| 10 | **Encrypt secrets at rest** — `fetchy-secrets.json` and `ai-secrets.json` are plaintext | Security | Medium | Use Electron's `safeStorage.encryptString()` / `decryptString()` (OS keychain-backed) for secret values |
| 11 | **Move Gemini API key to header** — currently passed as `?key=` query parameter, leakable in logs and referrers | Security | Low | Use `x-goog-api-key` header instead of the query string |
| 12 | **Regenerate child IDs on import** — `importCollection` preserves inner request/folder IDs, causing collisions if imported twice | Func. Stability | Low | Recursively assign new UUIDs to all requests and folders during import |

---

### P2 — Important (Maintainability + Functional Stability)

| # | Issue | ASR | Effort | What to do |
|:---:|:---|:---:|:---:|:---|
| 13 | **Decompose `electron/main.js`** — 1,169 lines mixing 7+ concerns in plain JS | Maintainability | Medium | Split into `ipc/` modules (`fileHandlers`, `httpHandler`, `aiHandler`, `gitHandler`, `secretsHandler`, `workspaceHandler`); migrate to TypeScript |
| 14 | **Replace `window.location.reload()`** — workspace switching discards unsaved state and is untestable | Reliability | Medium | Implement `store.reset()` + `persist.rehydrate()` cycle; prompt user to save unsaved changes before switching |
| 15 | **Wire AbortController to requests** — "Stop" in collection runner and manual execution can't actually cancel in-flight requests | Func. Stability | Low | Pass `AbortSignal` through to the Electron IPC HTTP handler; abort the underlying `http.request` on signal |
| 16 | **Fix auth inheritance depth** — only resolves folder → collection, not deeply nested folder chains | Func. Stability | Low | Walk the full ancestor chain (child folder → parent folder → … → collection) collecting the first non-`inherit` auth |
| 17 | **Add concurrency limit to collection runner** — parallel mode fires all requests simultaneously | Func. Stability | Low | Use a concurrency pool (e.g., `p-limit(10)`) to cap simultaneous in-flight requests |
| 18 | **Fix `exportFullStorage` nesting depth** — auth sanitization only covers 2 levels; secrets leak in deeper folders | Func. Stability + Security | Low | Use a recursive sanitizer that walks the entire folder tree |
| 19 | **Fix git log delimiter** — `\|` in commit messages corrupts parsed fields | Func. Stability | Low | Use `--format=%x00%H%x00%s%x00%an%x00%ai` with null-byte delimiter (impossible in commit messages) |
| 20 | **Add IPC input validation** — all `ipcMain.handle` callbacks trust renderer-supplied parameters | Security | Medium | Validate/schema-check every IPC parameter (at minimum: type checks, path validation, string length limits) |

---

### P3 — Planned improvements (Maintainability + Compatibility)

| # | Issue | ASR | Effort | What to do |
|:---:|:---|:---:|:---:|:---|
| 21 | **Split giant components** — Sidebar (1,708), RequestPanel (1,341), AIAssistant (716), App (570) | Maintainability | High | Extract: `CollectionsPanel`, `HistoryPanel`, `ApiDocsPanel` from Sidebar; `UrlBar`, `BodyEditor`, `AuthEditor`, `ScriptsEditor` from RequestPanel; custom hooks from App |
| 22 | **Add test coverage for critical paths** — zero tests for stores, httpClient, persistence, main process | Maintainability | High | Unit tests for `requestTree.ts`, `persistence.ts`, `httpClient.ts`; integration tests for IPC handlers; component tests for RequestPanel and collection runner |
| 23 | **Handle binary/non-UTF-8 responses** — all responses forced to UTF-8, corrupting images/protobuf/other charsets | Compatibility | Medium | Detect content-type; for binary, store as Buffer/base64; for text, respect charset from `Content-Type` header |
| 24 | **Support FormData through Electron IPC** — `form-data` body type silently sends `undefined` in Electron mode | Compatibility | Medium | Serialize `FormData` entries to a structured JSON array in the renderer; reconstruct as multipart in the main process HTTP handler |
| 25 | **Add corporate proxy support** — users behind corporate proxies cannot use Fetchy | Compatibility | Medium | Respect `HTTP_PROXY`/`HTTPS_PROXY` env vars; add proxy configuration in Preferences; use Node's `agent` option or `global-agent` |
| 26 | **Normalize data model** — recursive tree traversal with full copy on every mutation is O(n) | Maintainability | High | Move to a flat `Record<id, Entity>` map with parent references; eliminates traversal and reduces allocation pressure |
| 27 | **Eliminate duplicated persistence logic** — Electron and browser storage paths duplicate secret extraction and history truncation | Maintainability | Medium | Extract a shared `prepareForWrite(state)` / `hydrateAfterRead(state)` pipeline; storage adapters only handle the actual I/O |
| 28 | **Add data format migration system** — exports carry `version: "1.0"` with no migration handler for schema changes | Compatibility | Medium | Implement a version-aware migration chain: `{ "1.0" → "1.1": migrateFn, ... }` run on load |
| 29 | **Upgrade Vite + Electron** — Vite 4 is EOL, Electron 40's Chromium lacks latest security patches | Compatibility | Medium | Upgrade to Vite 6 + latest Electron LTS; audit breaking changes |
| 30 | **Add lint/format tooling** — no ESLint/Prettier configuration; style enforced by convention only | Maintainability | Low | Add `.eslintrc` + `.prettierrc`; add `lint` and `format` scripts; enforce in CI |
| 31 | **Eliminate circular `require()`** — `persistence.ts` dynamically requires `workspacesStore` | Maintainability | Low | Break the cycle by having `persistence.ts` accept a callback or use an event emitter for git auto-sync, rather than reading another store |

---

### Effort vs Impact Matrix

```
                        Low Effort           Medium Effort          High Effort
                  ┌────────────────────┬────────────────────┬────────────────────┐
                  │                    │                    │                    │
  Critical Impact │  #2  #3  #4  #5   │  #1  #8  #10       │                    │
                  │  #6  #7  #9  #11  │                    │                    │
                  │  #12              │                    │                    │
                  │                    │                    │                    │
                  ├────────────────────┼────────────────────┼────────────────────┤
                  │                    │                    │                    │
  High Impact     │  #15 #16 #17 #18  │  #13 #14 #20       │  #21 #22 #26       │
                  │  #19              │                    │                    │
                  │                    │                    │                    │
                  ├────────────────────┼────────────────────┼────────────────────┤
                  │                    │                    │                    │
  Moderate Impact │  #30 #31          │  #23 #24 #25 #27  │                    │
                  │                    │  #28 #29           │                    │
                  │                    │                    │                    │
                  └────────────────────┴────────────────────┴────────────────────┘
```

> **Quick wins** (low effort + critical/high impact): Items **#2, #3, #4, #5, #6, #7, #9, #11, #12, #15, #16, #17, #18, #19** — these 14 items address vulnerabilities across all 5 ASRs with individually small changes. Targeting these first delivers the highest ROI.
