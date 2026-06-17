## GH-65:
**Title** - Add AGENTS.md documentation for AI coding agent onboarding
**ProjectName:** Fetchy
**Status:** REVIEWED
**Link:** https://github.com/akineralkan/fetchy/issues/65
**Description:** Create a comprehensive `AGENTS.md` documentation file in the Fetchy project root to serve as a central onboarding and reference guide for AI coding agents, and update `CONTRIBUTING.md` and `README.md` to link to it. The file covers: Project Overview, Technology Stack, Directory Structure, Architecture Overview (Electron multi-process model), Key Concepts (variable substitution, auth inheritance, entity index, script sandbox), Development Workflow, Code Conventions, Testing Guidelines, Common Tasks, Important Files Reference, Agent Tips, and Quick Reference Card.
**Timestamp:** 2026-06-17T00:00:00Z

## GH-86:
**Title** - Keyboard Shortcuts should be reconfigurable
**ProjectName:** Fetchy
**Status:** REVIEWED
**Branch:** feat/gh-86-reconfigurable-keyboard-shortcuts
**Commit:** 4d53c1c
**PR Ready At:** https://github.com/AkinerAlkan94/fetchy/pull/new/feat/gh-86-reconfigurable-keyboard-shortcuts
**Link:** https://github.com/akineralkan/fetchy/issues/86
**Description:** Enable users to define, reconfigure, and persist custom keyboard shortcut bindings within the Keyboard Shortcuts view, replacing the current static predefined shortcuts with a fully user-driven configuration system. Implementation includes: UI Changes (replace static view with interactive editable list showing action name, current binding, and edit control; provide "Restore Defaults" option); Shortcut Editing (allow keyboard capture for new key combinations, validate bindings for conflicts, support clearing bindings); Persistence & Storage (store in user preference store scoped per user, load on startup with fallback to defaults); Data Model (structured JSON schema mapping action IDs to key binding strings, maintain separate default configuration); Edge Cases & Constraints (handle reserved key combinations gracefully, ensure immediate effect without restart, consider accessibility); Testing Considerations (unit test conflict detection, integration test persistence/retrieval, end-to-end test edit→save→reload cycle).
**Timestamp:** 2026-06-17T10:30:45Z
