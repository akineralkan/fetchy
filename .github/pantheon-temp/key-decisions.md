# Key Decisions

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Shortcut storage strategy — store only user overrides (partial config) rather than the full config. Rationale: minimizes stored data; getEffectiveBinding() falls back to DEFAULT_KEYBOARD_SHORTCUTS for unset actions, so defaults never need explicit storage.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Ctrl+1-9 tab switching kept as a non-configurable, pattern-based shortcut. Decision: Pattern-based bindings (multiple keys mapping to one action) cannot be cleanly represented in the ShortcutBinding schema; these are listed as "Fixed Shortcuts" in the UI for visibility.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Shift+Enter for "Send Request" kept as a fixed secondary alias alongside the configurable Ctrl+Enter binding. Decision: Shift+Enter is an established muscle-memory shortcut for many API tool users; removing it would be a regression. The configurable binding only controls the primary key.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Conflict resolution UX — when a new binding conflicts, show an inline warning banner with "Apply Anyway" (which clears the conflicting action's binding) or "Cancel". Decision: this prevents silent data loss while still allowing full reconfigurability.

[2026-06-17T12:00:00Z] [Fetchy] [GH-86] - DEVELOPMENT: Reserved system shortcuts (Ctrl+C, V, X, Z, A) blocked from capture. Decision: these are OS-level clipboard/undo actions that would break basic text editing inside the app if overridden.

[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: formatShortcutBinding modifier order is Ctrl ? Alt ? Shift (not alphabetical). Tests confirm this ordering is consistent and intentional.
[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: matchesBinding performs case-insensitive key comparison (e.key.toLowerCase() === binding.key.toLowerCase()). Tests confirm this works correctly for both upper and lower case letter keys.
[2026-06-17T13:10:00Z] [Fetchy] [GH-86] - TEST FINDING: getEffectiveBinding correctly distinguishes between a missing key (returns default) and an explicitly null key (returns null/disabled). This is critical for the disable-shortcut UX flow.

[2026-06-17T14:00:00Z] [Fetchy] [GH-86] - DEVOPS: GitHub CLI (gh) not available in PATH. Branch feat/gh-86-reconfigurable-keyboard-shortcuts successfully pushed to origin. PR creation requires either: (1) GitHub CLI installation, (2) GitHub authentication token for REST API, or (3) manual creation via GitHub web interface at: https://github.com/AkinerAlkan94/fetchy/pull/new/feat/gh-86-reconfigurable-keyboard-shortcuts

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MAJOR — additionalShortcuts array in App.tsx built inline on every render (not memoized with useMemo). This causes useKeyboardShortcuts useEffect to re-register and deregister the global window keydown listener on every App re-render, degrading performance. Recommend wrapping the array construction in useMemo with [customBindings, handleNewRequest, handleImport, setShowEnvironmentModal, setShowShortcutsModal] as dependencies.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — Fixed Shift+Enter alias for send-request (hardcoded in RequestPanel.tsx) is not represented in SHORTCUT_ACTIONS or RESERVED_COMBOS. The conflict detection modal cannot warn users that binding another configurable action to Shift+Enter would co-trigger send-request. Low real-world risk because Shift+Enter is unusual, but save-request check in RequestPanel returns early, preventing double-trigger for that specific case.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — KeyboardShortcutsModal lacks WAI-ARIA dialog semantics: root div missing role="dialog", aria-modal="true", and aria-labelledby. Close (X) icon button has only a title attribute, not aria-label. Focus trap is absent (though capture-phase recording listener partially compensates during shortcut capture). Recommend adding ARIA attributes and an aria-label to the close button.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — handleRestoreAllDefaults in KeyboardShortcutsModal duplicates the logic of applyConfig (setLocalConfig + updateKeyboardShortcuts + setSavedFlash + setTimeout). Recommend calling applyConfig({}) instead to reduce duplication.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: MINOR — setSavedFlash setTimeout (1200ms) in applyConfig and handleRestoreAllDefaults is not cleaned up via useEffect return. If the modal unmounts during this window a React state-update-on-unmounted-component warning will appear. Use useEffect or useRef to track the timer.

[2026-06-17T14:30:00Z] [Fetchy] [GH-86] - REVIEW: POSITIVE — KeyboardShortcutsModal.test.tsx coverage is intentionally narrow (4 smoke tests: render, action labels, close buttons). All substantive logic is exercised through the 57 utility + hook integration tests in useKeyboardShortcuts.test.ts. Acceptable split for the UI-vs-logic test boundary.
