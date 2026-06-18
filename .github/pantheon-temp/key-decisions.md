# Key Decisions

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Shortcut storage strategy — store only user overrides (partial config) rather than the full config. Rationale: minimizes stored data; getEffectiveBinding() falls back to DEFAULT_KEYBOARD_SHORTCUTS for unset actions, so defaults never need explicit storage.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Ctrl+1-9 tab switching kept as a non-configurable, pattern-based shortcut. Decision: Pattern-based bindings (multiple keys mapping to one action) cannot be cleanly represented in the ShortcutBinding schema; these are listed as "Fixed Shortcuts" in the UI for visibility.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Shift+Enter for "Send Request" kept as a fixed secondary alias alongside the configurable Ctrl+Enter binding. Decision: Shift+Enter is an established muscle-memory shortcut for many API tool users; removing it would be a regression. The configurable binding only controls the primary key.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Conflict resolution UX — when a new binding conflicts, show an inline warning banner with "Apply Anyway" (which clears the conflicting action's binding) or "Cancel". Decision: this prevents silent data loss while still allowing full reconfigurability.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Reserved system shortcuts (Ctrl+C, V, X, Z, A) blocked from capture. Decision: these are OS-level clipboard/undo actions that would break basic text editing inside the app if overridden.

[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: formatShortcutBinding modifier order is Ctrl ? Alt ? Shift (not alphabetical). Tests confirm this ordering is consistent and intentional.
[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: matchesBinding performs case-insensitive key comparison (e.key.toLowerCase() === binding.key.toLowerCase()). Tests confirm this works correctly for both upper and lower case letter keys.
[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: getEffectiveBinding correctly distinguishes between a missing key (returns default) and an explicitly null key (returns null/disabled). This is critical for the disable-shortcut UX flow.

[2026-06-18T09:36:47Z] [Fetchy] [GH-88] - TEST FINDING: 17 GH-88 tests present across App.test.tsx (6 tests) and AboutModal.test.tsx (11 tests). All cover openExternalUrl invocation, correct URLs, once-per-click count, no window.open usage, and graceful degradation when electronAPI is undefined.
[2026-06-18T09:36:47Z] [Fetchy] [GH-88] - TEST FINDING: act() warnings appear in GH-88 App.test.tsx tests due to async GitHub stars fetch on App mount. This is a pre-existing warning (present in all App tests that render the component) and does not affect test correctness — all assertions pass.
[2026-06-18T09:36:47Z] [Fetchy] [GH-88] - RISK: IPC handler for open-external-url has no try/catch around shell.openExternal(). If the OS fails to open the URL (no default browser, permission error), the promise would reject and the renderer would receive an unhandled error. Mitigation: Add try/catch in electron/main.js IPC handler.

[2026-06-17T14:00:00Z] [Fetchy] [GH-86] - DEVOPS: GitHub CLI (gh) not available in PATH. Branch feat/gh-86-reconfigurable-keyboard-shortcuts successfully pushed to origin. PR creation requires either: (1) GitHub CLI installation, (2) GitHub authentication token for REST API, or (3) manual creation via GitHub web interface at: https://github.com/AkinerAlkan94/fetchy/pull/new/feat/gh-86-reconfigurable-keyboard-shortcuts

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MAJOR — additionalShortcuts array in App.tsx built inline on every render (not memoized with useMemo). This causes useKeyboardShortcuts useEffect to re-register and deregister the global window keydown listener on every App re-render, degrading performance. Recommend wrapping the array construction in useMemo with [customBindings, handleNewRequest, handleImport, setShowEnvironmentModal, setShowShortcutsModal] as dependencies.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — Fixed Shift+Enter alias for send-request (hardcoded in RequestPanel.tsx) is not represented in SHORTCUT_ACTIONS or RESERVED_COMBOS. The conflict detection modal cannot warn users that binding another configurable action to Shift+Enter would co-trigger send-request. Low real-world risk because Shift+Enter is unusual, but save-request check in RequestPanel returns early, preventing double-trigger for that specific case.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — KeyboardShortcutsModal lacks WAI-ARIA dialog semantics: root div missing role="dialog", aria-modal="true", and aria-labelledby. Close (X) icon button has only a title attribute, not aria-label. Focus trap is absent (though capture-phase recording listener partially compensates during shortcut capture). Recommend adding ARIA attributes and an aria-label to the close button.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — handleRestoreAllDefaults in KeyboardShortcutsModal duplicates the logic of applyConfig (setLocalConfig + updateKeyboardShortcuts + setSavedFlash + setTimeout). Recommend calling applyConfig({}) instead to reduce duplication.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — setSavedFlash setTimeout (1200ms) in applyConfig and handleRestoreAllDefaults is not cleaned up via useEffect return. If the modal unmounts during this window a React state-update-on-unmounted-component warning will appear. Use useEffect or useRef to track the timer.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: POSITIVE — KeyboardShortcutsModal.test.tsx coverage is intentionally narrow (4 smoke tests: render, action labels, close buttons). All substantive logic is exercised through the 57 utility + hook integration tests in useKeyboardShortcuts.test.ts. Acceptable split for the UI-vs-logic test boundary.

[2026-06-18T09:29:03Z] [Fetchy] [GH-88] - DEVELOPMENT: Implementation already present. Codebase inspection revealed that electron/preload.js already exposes openExternalUrl via contextBridge (line 34), electron/main.js already handles open-external-url IPC with shell validation (lines 373-378), src/App.tsx Documentation button (line 297) and GitHub button (line 306) already call window.electronAPI?.openExternalUrl(), and src/components/AboutModal.tsx all external links already use the same pattern. Decision: No source code changes required. Verified TypeScript passes clean and all GH-88-specific tests (6 tests in App.test.tsx) pass.

[2026-06-18T08:44:34Z] [Fetchy] [GH-88] - DEVELOPMENT: IPC plumbing already existed. electron/preload.js already exposed openExternalUrl via contextBridge and electron/main.js already had the open-external-url IPC handler using shell.openExternal() with http/https URL validation. No main process changes required.

[2026-06-18T08:44:34Z] [Fetchy] [GH-88] - DEVELOPMENT: AboutModal <a> tags converted to <button> elements (not onClick on anchors). Decision: Removing href and target attributes entirely eliminates any possibility of Electron's default webContents navigation intercepting the click. Using button elements is semantically appropriate as these are actions, not hyperlinks, in a desktop app context.

[2026-06-18T08:44:34Z] [Fetchy] [GH-88] - DEVELOPMENT: Used window.electronAPI?.openExternalUrl (optional chaining) to match the pattern established in AIAssistant.tsx and avoid TypeScript TS18048 errors. Consistent with existing codebase convention.

[2026-06-18T08:54:59Z] [Fetchy] [GH-88] - TEST FINDING: All 17 new unit tests pass. App.test.tsx: Documentation button correctly calls openExternalUrl('https://akineralkan.github.io/fetchy/'), GitHub button correctly calls openExternalUrl('https://github.com/akineralkan/fetchy'). window.open() is not called. Both buttons handle missing electronAPI gracefully (no throw).

[2026-06-18T08:54:59Z] [Fetchy] [GH-88] - TEST FINDING: AboutModal.test.tsx: All 4 named link buttons (GitHub Repository, Documentation, MIT License, View all contributors) and all 13 OPEN_SOURCE_DEPS dependency buttons correctly call openExternalUrl with their respective URLs. No <a href=> anchor tags present in rendered output (confirmed by anchor count assertion). Missing electronAPI is handled gracefully via optional chaining.

[2026-06-18T08:54:59Z] [Fetchy] [GH-88] - RISK: The act() warnings in App tests are pre-existing (triggered by async GitHub stars fetch in App.tsx line 69). These are warnings only and do not affect test correctness. All assertions pass. Mitigation: Pre-existing pattern, not introduced by GH-88.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: POSITIVE: IPC security layer (main.js open-external-url handler) validates URL is a string and starts with http:// or https:// before calling shell.openExternal. All hardcoded client-side URLs are safe constants � no user input flows into the URL argument, eliminating injection risk.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: IPC handler (main.js:373) has no try/catch around wait shell.openExternal(url). If the OS cannot resolve a default browser or the shell call rejects, an unhandled promise rejection surfaces in the main process. The renderer discards the promise (no .catch()), so the failure is silently swallowed. Recommend wrapping in try/catch and returning { success: false, error: err.message }.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: IPC handler does not enforce a maximum URL length. A malformed but prefix-matching URL such as https:// + 50,000 chars would pass validation and be passed to shell.openExternal. Low real-world risk (all callers use hardcoded literals), but a length cap (e.g. 2048 chars) would harden the handler for future callers.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: UpdateModal.tsx line 147 still calls window.open('https://github.com/AkinerAlkan94/fetchy/releases/latest', '_blank'). This code path is guarded by if (!isElectron) so it only executes in browser dev mode � it does NOT affect production Electron behavior. GH-88 task scope is fulfilled. Recommend a follow-up issue to unify all external URL calls through openExternalUrl for consistency.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: ExternalLink SVG icons inside link buttons in AboutModal.tsx are not marked with ria-hidden="true". As purely decorative icons, they should be hidden from the accessibility tree to avoid redundant announcements by screen readers.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: Inconsistent icon sizes in AboutModal.tsx link buttons � named links use ExternalLink size={12}, dependency buttons use ExternalLink size={11}. No functional impact, but should be unified for visual consistency.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: MINOR: URL casing inconsistency � bottom-bar GitHub URL uses lowercase https://github.com/akineralkan/fetchy, while LICENSE and contributors URLs use mixed case https://github.com/AkinerAlkan94/fetchy. GitHub redirects case-insensitively, so no functional issue, but canonical casing should be uniform.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: POSITIVE: Button selectors in App.test.tsx use Lucide CSS class names (.lucide-book-open, .lucide-github) as a practical workaround for icon-only buttons that lack aria-label. This is the best available approach given the pre-existing accessibility gap in App.tsx.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: POSITIVE: All 17 external URL call sites are correctly converted � 4 named links + 13 OPEN_SOURCE_DEPS in AboutModal.tsx, plus 2 bottom-bar buttons in App.tsx. Zero remaining window.open() calls for external URLs in Electron-active code paths.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: POSITIVE: Test coverage is comprehensive: 6 App.test.tsx GH-88 tests + 11 AboutModal.test.tsx GH-88 tests cover correct URL routing, call count, no window.open regression, graceful degradation without electronAPI, verified no <a href> anchors in DOM, and all 13 dependency URLs.

[2026-06-18T09:01:28Z] [Fetchy] [GH-88] - REVIEW: VERDICT: Approve with Minor Suggestions. 0 blocking issues. 5 minor code/security hardening suggestions. 1 out-of-scope completeness note (UpdateModal dev-mode path). All minor items are low-priority improvements, none affect GH-88 task correctness.
