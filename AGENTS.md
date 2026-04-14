# AGENTS.md — Fetchy AI Agent Guide

> **Purpose:** Help AI coding agents understand the Fetchy project structure, conventions, and how to contribute effectively.
> **Last Updated:** April 2026

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Directory Structure](#directory-structure)
- [Architecture Overview](#architecture-overview)
- [Key Concepts](#key-concepts)
- [Development Workflow](#development-workflow)
- [Code Conventions](#code-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Common Tasks](#common-tasks)
- [Important Files Reference](#important-files-reference)

---

## Project Overview

**Fetchy** is a privacy-focused, self-hosted REST API client built with Electron and React. It's designed as an **AI-native project** — all development is expected to be done using AI coding agents (see [CONTRIBUTING.md](CONTRIBUTING.md)).

### Core Principles

- **Privacy First**: 100% local, no cloud sync, no telemetry
- **AI-Native Development**: All contributions leverage AI agents
- **Offline Capable**: Full functionality without internet
- **Trunk-Based Development**: Short-lived branches merged to `main` quickly

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 18.x |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 3.4.x |
| **State Management** | Zustand | 4.5.x |
| **Code Editor** | CodeMirror | 6.x |
| **Desktop Framework** | Electron | 40.x |
| **Build Tool** | Vite | 4.x |
| **Immutable Updates** | Immer | 10.x |
| **Drag & Drop** | dnd-kit | 6.x |
| **Testing** | Vitest | 0.34.x |
| **Linting** | ESLint | 8.x |
| **Formatting** | Prettier | 3.x |

---

## Directory Structure

```
fetchy/
├── electron/                    # Electron main process (Node.js)
│   ├── main.js                 # Main process entry point
│   ├── preload.js              # Preload scripts for IPC bridge
│   ├── updater.js              # Auto-update logic
│   └── ipc/                    # IPC handlers (modularized)
│       ├── index.js            # IPC handler registration
│       ├── aiHandler.js        # AI provider API calls
│       ├── fileHandlers.js     # File system operations
│       ├── httpHandler.js      # HTTP request proxy
│       ├── jiraHandler.js      # Jira integration
│       ├── secretsHandler.js   # Secure storage (safeStorage)
│       ├── validate.js         # IPC input validation
│       └── workspaceHandler.js # Workspace management
│
├── src/                         # React application (renderer process)
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles + Tailwind imports
│   │
│   ├── components/             # React components
│   │   ├── request/            # Request panel sub-components
│   │   │   ├── UrlBar.tsx
│   │   │   ├── BodyEditor.tsx
│   │   │   ├── AuthEditor.tsx
│   │   │   └── ScriptsEditor.tsx
│   │   ├── sidebar/            # Sidebar sub-components
│   │   │   ├── ApiDocsPanel.tsx
│   │   │   ├── HistoryPanel.tsx
│   │   │   ├── SortableCollectionItem.tsx
│   │   │   ├── SortableFolderItem.tsx
│   │   │   ├── SortableRequestItem.tsx
│   │   │   └── SidebarContextMenu.tsx
│   │   ├── openapi/            # OpenAPI editor components
│   │   ├── RequestPanel.tsx    # Main request editor
│   │   ├── ResponsePanel.tsx   # Response viewer
│   │   ├── Sidebar.tsx         # Main sidebar (collections/history/docs)
│   │   ├── AIAssistant.tsx     # AI chat assistant
│   │   ├── EnvironmentModal.tsx
│   │   ├── RunCollectionModal.tsx
│   │   └── ...                 # Other modals and components
│   │
│   ├── store/                  # Zustand state management
│   │   ├── appStore.ts         # Main application state
│   │   ├── workspacesStore.ts  # Multi-workspace management
│   │   ├── preferencesStore.ts # User preferences
│   │   ├── persistence.ts      # Storage adapters (Electron/browser)
│   │   ├── requestTree.ts      # Tree traversal utilities
│   │   ├── entityIndex.ts      # Flat entity index for O(1) lookups
│   │   └── dataMigration.ts    # Data format migrations
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── useKeyboardShortcuts.ts
│   │
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Main type exports
│   │
│   └── utils/                  # Utility functions
│       ├── httpClient.ts       # HTTP request execution
│       ├── variables.ts        # Variable substitution (<<var>>)
│       ├── authInheritance.ts  # Auth inheritance resolver
│       ├── codeGenerator.ts    # Code snippet generation
│       ├── curlParser.ts       # cURL command parser
│       ├── postman.ts          # Postman importer
│       ├── hoppscotch.ts       # Hoppscotch importer
│       ├── bruno.ts            # Bruno importer
│       ├── openapi.ts          # OpenAPI importer
│       ├── aiProvider.ts       # AI provider configurations
│       ├── jwt.ts              # JWT decoding utilities
│       └── ...                 # Other utilities
│
├── test/                        # Test files (Vitest)
│   ├── *.test.ts               # Unit tests
│   └── data/                   # Test fixtures
│
├── docs/                        # Docusaurus documentation site
│   ├── docs/                   # Documentation markdown
│   ├── blog/                   # Blog posts
│   └── src/                    # Doc site components
│
├── build/                       # Build resources
│   └── icons/                  # App icons (win/mac/png)
│
├── public/                      # Static assets
├── scripts/                     # Build scripts
│
└── Configuration Files
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    └── .eslintrc (implied)
```

---

## Architecture Overview

### Electron Architecture

Fetchy follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS                            │
│                   (electron/main.js)                         │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ File I/O   │  │ HTTP Proxy │  │ AI API     │             │
│  │ Handlers   │  │ Handler    │  │ Handler    │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Secrets    │  │ Workspace  │  │ Jira       │             │
│  │ Handler    │  │ Handler    │  │ Handler    │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                          ▲                                   │
│                          │ IPC (ipcMain.handle)              │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                          ▼                                   │
│                     PRELOAD SCRIPT                           │
│                  (electron/preload.js)                       │
│                                                              │
│          Exposes window.electronAPI to renderer              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                          │
│                       (src/)                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    React App                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │   │
│  │  │ Sidebar    │  │ RequestPanel│  │ Response   │      │   │
│  │  │ Component  │  │ Component   │  │ Panel      │      │   │
│  │  └────────────┘  └────────────┘  └────────────┘      │   │
│  │                          ▲                            │   │
│  │                          │                            │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │              Zustand Stores                   │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │    │   │
│  │  │  │ appStore │ │workspaces│ │ preferences  │  │    │   │
│  │  │  │          │ │  Store   │ │    Store     │  │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘  │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### State Management

Zustand stores with Immer for immutable updates:

| Store | Purpose | Key State |
|-------|---------|-----------|
| `appStore` | Main app state | Collections, requests, tabs, history, environments |
| `workspacesStore` | Multi-workspace | Workspace list, active workspace, paths |
| `preferencesStore` | User settings | Theme, layout, autosave, max history |

### Data Flow

1. **User Action** → Component event handler
2. **Store Action** → Zustand store mutation (via Immer)
3. **Persistence** → Debounced write to disk via IPC
4. **IPC Handler** → Main process handles file I/O
5. **Response** → IPC returns result to renderer

---

## Key Concepts

### Variable Substitution

Variables use `<<variable_name>>` syntax:

```
https://<<base_url>>/api/<<version>>/users
```

Variable resolution order:
1. **Environment Variables** (current environment)
2. **Collection Variables** (collection scope)
3. **Global Variables** (workspace scope)

### Auth Inheritance

Requests can inherit authentication from parent folders/collections:

```
Collection (auth: Bearer Token)
  └── Folder (auth: inherit)  ← inherits from collection
      └── Request (auth: inherit)  ← inherits from folder → collection
```

The `authInheritance.ts` utility walks the full ancestor chain.

### Entity Index

For O(1) lookups, `entityIndex.ts` maintains a flat map:

```typescript
type EntityIndex = {
  entities: Record<string, Entity>;  // id → entity
  parentMap: Record<string, string>; // childId → parentId
}
```

### Script Execution

Pre/post-request scripts run in a Web Worker sandbox:
- No access to `window`, `document`, `electronAPI`
- 10-second timeout to prevent infinite loops
- Access to `fetchy` API for variable manipulation

---

## Development Workflow

### Setup

```bash
git clone https://github.com/AkinerAlkan94/fetchy.git
cd fetchy
npm install
npm run electron:dev
```

### Common Commands

| Command | Description |
|---------|-------------|
| `npm run electron:dev` | Start dev mode (Vite + Electron) |
| `npm run electron:build` | Build production installer |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm run format` | Format code with Prettier |

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/add-graphql-support` |
| `bugfix/` | Bug fix | `bugfix/fix-null-response-body` |
| `improv/` | Improvement | `improv/response-panel-performance` |

---

## Code Conventions

### TypeScript

- All React components use TypeScript (`.tsx`)
- Types are defined in `src/types/index.ts`
- Use explicit types for function parameters and return values
- Prefer interfaces for object shapes

### React Components

- Functional components with hooks only
- Component files use PascalCase: `RequestPanel.tsx`
- Use `lucide-react` for icons
- Use Tailwind CSS for styling (no CSS modules)

### State Management

- Use Zustand stores for global state
- Use Immer's `produce()` for immutable updates
- Debounce persistence writes (1-2s)
- Keep store actions focused and composable

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `RequestPanel.tsx` |
| Utilities | camelCase | `httpClient.ts` |
| Tests | camelCase + `.test` | `curl-parser.test.ts` |
| Types | camelCase | `index.ts` |

### Import Order

1. React and external libraries
2. Components
3. Stores
4. Utilities
5. Types
6. Styles

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  it('should do something specific', () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toEqual(expected);
  });
});
```

### What to Test

- **Utilities**: All functions in `src/utils/`
- **Store Actions**: State mutations in Zustand stores
- **Importers**: Postman, Bruno, Hoppscotch, OpenAPI parsers
- **IPC Handlers**: Input validation and error handling

### Test Location

Tests live in `test/` directory, mirroring the source structure:
- `test/curl-parser.test.ts` → `src/utils/curlParser.ts`
- `test/postman.test.ts` → `src/utils/postman.ts`

---

## Common Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Add TypeScript types for props
3. Use Tailwind for styling
4. Export from parent module if needed
5. Add tests for complex logic

### Adding a New IPC Handler

1. Create handler in `electron/ipc/`
2. Add input validation using `validate.js` patterns
3. Register handler in `electron/ipc/index.js`
4. Expose via `preload.js` if needed
5. Add TypeScript types for IPC parameters

### Adding a New Importer

1. Create parser in `src/utils/` (e.g., `newFormat.ts`)
2. Add to `ImportModal.tsx` format options
3. Handle edge cases and malformed input
4. Add comprehensive test coverage in `test/`
5. Update documentation

### Modifying Store State

1. Define new state shape in types
2. Add data migration if breaking change
3. Update persistence logic
4. Update related components
5. Test persistence round-trip

---

## Important Files Reference

### Must-Read Files

| File | Purpose |
|------|---------|
| `CONTRIBUTING.md` | Contribution guidelines |
| `ARCHITECTURE_REVIEW.md` | Technical debt and remediation roadmap |
| `ROADMAP.md` | Prioritized remediation checklist |
| `FEATURE_DEMANDS.md` | Product backlog and feature requests |

### Core Source Files

| File | Purpose |
|------|---------|
| `src/store/appStore.ts` | Main application state |
| `src/store/persistence.ts` | Storage adapters |
| `src/utils/httpClient.ts` | HTTP request execution |
| `src/types/index.ts` | TypeScript type definitions |
| `electron/main.js` | Electron main process |
| `electron/ipc/index.js` | IPC handler registration |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS theme |

---

## Agent Tips

### Before Making Changes

1. **Read related files** — Understand existing patterns
2. **Check ARCHITECTURE_REVIEW.md** — Avoid known anti-patterns
3. **Run tests** — Ensure baseline passes: `npm test`
4. **Check for errors** — Run `npm run lint`

### When Implementing Features

1. **Follow the Feature Branch Requirements** — Code + Tests + Docs
2. **Keep PRs focused** — One concern per PR
3. **Use existing patterns** — Match current code style
4. **Update types** — Add TypeScript types for new entities

### When Fixing Bugs

1. **Write a failing test first** — Prove the bug exists
2. **Make the minimal fix** — Don't refactor unrelated code
3. **Verify with tests** — Ensure fix works and nothing breaks

### Avoid These Anti-Patterns

- ❌ Giant components (> 500 lines)
- ❌ Direct file writes without atomic rename
- ❌ Trusting IPC input without validation
- ❌ Disabling TLS verification for AI API calls
- ❌ Running user scripts with full DOM/API access

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    FETCHY QUICK REFERENCE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  START DEV:     npm run electron:dev                        │
│  RUN TESTS:     npm test                                    │
│  BUILD:         npm run electron:build                      │
│  LINT:          npm run lint:fix                            │
│  FORMAT:        npm run format                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STORES:        src/store/appStore.ts (main state)          │
│  TYPES:         src/types/index.ts                          │
│  UTILS:         src/utils/*.ts                              │
│  COMPONENTS:    src/components/*.tsx                        │
│  IPC HANDLERS:  electron/ipc/*.js                           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BRANCH:        feat/  bugfix/  improv/                     │
│  PR TARGET:     main (trunk-based development)              │
│  REQUIREMENTS:  Code + Tests + Docs                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Happy coding with AI assistance! 🤖**

