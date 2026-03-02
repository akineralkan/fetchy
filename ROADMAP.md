# Fetchy — Remediation Roadmap

> **Created:** February 28, 2026
> **Source:** [Architecture Review](ARCHITECTURE_REVIEW.md)
> **Tracking:** Check items off as they are completed

---

## P0 — Must fix before any release

> Security + Reliability blockers

- [x] **#1 · Sandbox script execution** `Security` `Medium`
  > `new Function()` in renderer gives full access to `window.electronAPI`, filesystem, secrets
  >
  > **Action:** Run user scripts in a Web Worker or `isolated-vm` with a strict API allowlist; no access to `window`, `document`, or `electronAPI`

- [x] **#2 · Sanitize file paths in IPC** `Security` `Low`
  > `read-data`/`write-data` accept unsanitized filenames, enabling `../../` traversal
  >
  > **Action:** `path.resolve()` + verify result starts with the expected data directory; reject anything else

- [x] **#3 · Enable TLS verification by default** `Security` `Low`
  > `rejectUnauthorized: false` hardcoded on all outbound connections including AI calls carrying API keys
  >
  > **Action:** Default to `true`; add a per-request "Disable SSL verification" toggle for user HTTP requests only; never disable for AI API calls

- [x] **#4 · Atomic file writes** `Reliability` `Low`
  > `writeFileSync` directly to the target path; crash mid-write = corrupt workspace
  >
  > **Action:** Write to `filename.tmp`, then `fs.renameSync` to final path (atomic on NTFS/ext4/APFS)

- [x] **#5 · Add React Error Boundary** `Reliability` `Low`
  > Any unhandled exception in the component tree white-screens the entire app
  >
  > **Action:** Wrap root `<App>` in an Error Boundary with a recovery UI and "Reload" action

---

## P1 — High priority

> Functional Stability + Security hardening

- [ ] **#6 · Script execution timeout** `Func. Stability` `Low`
  > `while(true){}` in a pre-script freezes the renderer permanently
  >
  > **Action:** Wrap `new Function` (or Worker) execution in a timeout (e.g., 10s); kill and report error on expiry

- [ ] **#7 · Debounce persistence writes** `Reliability` `Low`
  > Every keystroke serializes the entire state to disk
  >
  > **Action:** Add a 1–2s debounce on the Zustand `persist` middleware's `setItem` call

- [ ] **#8 · Cap in-memory response size** `Reliability` `Medium`
  > Each tab holds the full response body; multi-MB responses cause OOM
  >
  > **Action:** Truncate in-memory display at a configurable limit (e.g., 5 MB); offer "Save full response to file" for larger payloads

- [ ] **#9 · Add Content-Security-Policy** `Security` `Low`
  > No CSP configured, weakening defense-in-depth
  >
  > **Action:** Set a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` in main process: `script-src 'self'`

- [ ] **#10 · Encrypt secrets at rest** `Security` `Medium`
  > `fetchy-secrets.json` and `ai-secrets.json` are plaintext
  >
  > **Action:** Use Electron's `safeStorage.encryptString()` / `decryptString()` (OS keychain-backed) for secret values

- [ ] **#11 · Move Gemini API key to header** `Security` `Low`
  > Currently passed as `?key=` query parameter, leakable in logs and referrers
  >
  > **Action:** Use `x-goog-api-key` header instead of the query string

- [ ] **#12 · Regenerate child IDs on import** `Func. Stability` `Low`
  > `importCollection` preserves inner request/folder IDs, causing collisions if imported twice
  >
  > **Action:** Recursively assign new UUIDs to all requests and folders during import

---

## P2 — Important

> Maintainability + Functional Stability

- [ ] **#13 · Decompose `electron/main.js`** `Maintainability` `Medium`
  > 1,169 lines mixing 7+ concerns in plain JS
  >
  > **Action:** Split into `ipc/` modules (`fileHandlers`, `httpHandler`, `aiHandler`, `gitHandler`, `secretsHandler`, `workspaceHandler`); migrate to TypeScript

- [ ] **#14 · Replace `window.location.reload()`** `Reliability` `Medium`
  > Workspace switching discards unsaved state and is untestable
  >
  > **Action:** Implement `store.reset()` + `persist.rehydrate()` cycle; prompt user to save unsaved changes before switching

- [ ] **#15 · Wire AbortController to requests** `Func. Stability` `Low`
  > "Stop" in collection runner and manual execution can't actually cancel in-flight requests
  >
  > **Action:** Pass `AbortSignal` through to the Electron IPC HTTP handler; abort the underlying `http.request` on signal

- [ ] **#16 · Fix auth inheritance depth** `Func. Stability` `Low`
  > Only resolves folder → collection, not deeply nested folder chains
  >
  > **Action:** Walk the full ancestor chain (child folder → parent folder → … → collection) collecting the first non-`inherit` auth

- [ ] **#17 · Add concurrency limit to collection runner** `Func. Stability` `Low`
  > Parallel mode fires all requests simultaneously
  >
  > **Action:** Use a concurrency pool (e.g., `p-limit(10)`) to cap simultaneous in-flight requests

- [ ] **#18 · Fix `exportFullStorage` nesting depth** `Func. Stability + Security` `Low`
  > Auth sanitization only covers 2 levels; secrets leak in deeper folders
  >
  > **Action:** Use a recursive sanitizer that walks the entire folder tree

- [ ] **#19 · Fix git log delimiter** `Func. Stability` `Low`
  > `|` in commit messages corrupts parsed hash/message/author/date fields
  >
  > **Action:** Use `--format=%x00%H%x00%s%x00%an%x00%ai` with null-byte delimiter (impossible in commit messages)

- [ ] **#20 · Add IPC input validation** `Security` `Medium`
  > All `ipcMain.handle` callbacks trust renderer-supplied parameters
  >
  > **Action:** Validate/schema-check every IPC parameter (at minimum: type checks, path validation, string length limits)

---

## P3 — Planned improvements

> Maintainability + Compatibility

- [ ] **#21 · Split giant components** `Maintainability` `High`
  > Sidebar (1,708), RequestPanel (1,341), AIAssistant (716), App (570)
  >
  > **Action:** Extract: `CollectionsPanel`, `HistoryPanel`, `ApiDocsPanel` from Sidebar; `UrlBar`, `BodyEditor`, `AuthEditor`, `ScriptsEditor` from RequestPanel; custom hooks from App

- [ ] **#22 · Add test coverage for critical paths** `Maintainability` `High`
  > Zero tests for stores, httpClient, persistence, main process
  >
  > **Action:** Unit tests for `requestTree.ts`, `persistence.ts`, `httpClient.ts`; integration tests for IPC handlers; component tests for RequestPanel and collection runner

- [ ] **#23 · Handle binary/non-UTF-8 responses** `Compatibility` `Medium`
  > All responses forced to UTF-8, corrupting images/protobuf/other charsets
  >
  > **Action:** Detect content-type; for binary, store as Buffer/base64; for text, respect charset from `Content-Type` header

- [ ] **#24 · Support FormData through Electron IPC** `Compatibility` `Medium`
  > `form-data` body type silently sends `undefined` in Electron mode
  >
  > **Action:** Serialize `FormData` entries to a structured JSON array in the renderer; reconstruct as multipart in the main process HTTP handler

- [ ] **#25 · Add corporate proxy support** `Compatibility` `Medium`
  > Users behind corporate proxies cannot use Fetchy
  >
  > **Action:** Respect `HTTP_PROXY`/`HTTPS_PROXY` env vars; add proxy configuration in Preferences; use Node's `agent` option or `global-agent`

- [ ] **#26 · Normalize data model** `Maintainability` `High`
  > Recursive tree traversal with full copy on every mutation is O(n)
  >
  > **Action:** Move to a flat `Record<id, Entity>` map with parent references; eliminates traversal and reduces allocation pressure

- [ ] **#27 · Eliminate duplicated persistence logic** `Maintainability` `Medium`
  > Electron and browser storage paths duplicate secret extraction and history truncation
  >
  > **Action:** Extract a shared `prepareForWrite(state)` / `hydrateAfterRead(state)` pipeline; storage adapters only handle the actual I/O

- [ ] **#28 · Add data format migration system** `Compatibility` `Medium`
  > Exports carry `version: "1.0"` with no migration handler for schema changes
  >
  > **Action:** Implement a version-aware migration chain: `{ "1.0" → "1.1": migrateFn, ... }` run on load

- [ ] **#29 · Upgrade Vite + Electron** `Compatibility` `Medium`
  > Vite 4 is EOL, Electron 40's Chromium lacks latest security patches
  >
  > **Action:** Upgrade to Vite 6 + latest Electron LTS; audit breaking changes

- [ ] **#30 · Add lint/format tooling** `Maintainability` `Low`
  > No ESLint/Prettier configuration; style enforced by convention only
  >
  > **Action:** Add `.eslintrc` + `.prettierrc`; add `lint` and `format` scripts; enforce in CI

- [ ] **#31 · Eliminate circular `require()`** `Maintainability` `Low`
  > `persistence.ts` dynamically requires `workspacesStore`
  >
  > **Action:** Break the cycle by having `persistence.ts` accept a callback or use an event emitter for git auto-sync, rather than reading another store

---

## Effort vs Impact Matrix

```
                        Low Effort           Medium Effort          High Effort
                  ┌────────────────────┬────────────────────┬────────────────────┐
                  │                    │                    │                    │
  Critical Impact │  #2  #3  #4  #5    │  #1  #8  #10       │                    │
                  │  #6  #7  #9  #11   │                    │                    │
                  │  #12               │                    │                    │
                  │                    │                    │                    │
                  ├────────────────────┼────────────────────┼────────────────────┤
                  │                    │                    │                    │
  High Impact     │  #15 #16 #17 #18   │  #13 #14 #20       │  #21 #22 #26       │
                  │  #19               │                    │                    │
                  │                    │                    │                    │
                  ├────────────────────┼────────────────────┼────────────────────┤
                  │                    │                    │                    │
  Moderate Impact │  #30 #31           │  #23 #24 #25 #27   │                    │
                  │                    │  #28 #29           │                    │
                  │                    │                    │                    │
                  └────────────────────┴────────────────────┴────────────────────┘
```

> **Quick wins** (low effort + critical/high impact): Items **#2, #3, #4, #5, #6, #7, #9, #11, #12, #15, #16, #17, #18, #19** — these 14 items address vulnerabilities across all 5 ASRs with individually small changes. Targeting these first delivers the highest ROI.
