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

## GH-88:
**Title** - Github button and Documentation button should open in Default Browser of OS not in Electron application window.
**ProjectName:** Fetchy
**Status:** TESTED
**Link:** https://github.com/akineralkan/fetchy/issues/88
**IssueNumber:** 88
**IssueState:** open
**CreatedAt:** 2026-06-17T20:32:48Z
**UpdatedAt:** 2026-06-17T20:32:48Z
**Labels:** (none)
**FullBody:** ### Goal

Ensure that the **GitHub** button and **Documentation** button open their respective URLs in the operating system's default browser, rather than within the Electron application window.

### Context

In Electron applications, links and navigation events are handled internally by default, causing external URLs to open inside the app's `BrowserWindow`. This behavior is undesirable for external resources like GitHub repositories and documentation pages, which should be viewed in the user's preferred OS browser for a better experience and standard web functionality.

### **Implementation Notes**

- Use Electron's `shell` module to open URLs externally:
  ```javascript
  const { shell } = require('electron');
  shell.openExternal('https://your-url.com');
  ```
- Attach click event listeners to both the **GitHub** and **Documentation** buttons and call `shell.openExternal()` with the appropriate URL.
- If the buttons are in the **renderer process**, use one of the following approaches:
  - Expose `shell.openExternal` via `contextBridge` in the preload script:
    ```javascript
    // preload.js
    const { contextBridge, shell } = require('electron');

    contextBridge.exposeInMainWorld('electronAPI', {
      openExternal: (url) => shell.openExternal(url),
    });
    ```
  - Then call it from the renderer:
    ```javascript
    // renderer.js
    document.getElementById('github-btn').addEventListener('click', () => {
      window.electronAPI.openExternal('https://github.com/your-repo');
    });

    document.getElementById('docs-btn').addEventListener('click', () => {
      window.electronAPI.openExternal('https://your-docs-url.com');
    });
    ```
- If using **anchor tags** (`<a href="...">`), prevent default navigation and intercept with `shell.openExternal`:
  ```javascript
  document.querySelectorAll('a[data-external]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal(link.href);
    });
  });
  ```
- Ensure `contextIsolation: true` and `nodeIntegration: false` are set in `BrowserWindow` `webPreferences` for security compliance.
- Test on **Windows**, **macOS**, and **Linux** to confirm the default browser is correctly invoked on all platforms.
**Description:** Ensure that the GitHub button and Documentation button open their respective URLs in the operating system's default browser, rather than within the Electron application window. In Electron applications, links and navigation events are handled internally by default, causing external URLs to open inside the app's BrowserWindow. This behavior is undesirable for external resources like GitHub repositories and documentation pages, which should be viewed in the user's preferred OS browser for a better experience and standard web functionality. Use Electron's shell module with shell.openExternal() to open URLs externally. Expose shell.openExternal via contextBridge in the preload script and attach click event listeners to both GitHub and Documentation buttons. Handle both anchor tags and button elements. Ensure contextIsolation: true and nodeIntegration: false are set for security compliance. Test on Windows, macOS, and Linux.
**Timestamp:** 2026-06-18T09:19:30Z
