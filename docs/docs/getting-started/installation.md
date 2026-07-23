---
id: installation
title: Installation
sidebar_label: Installation
sidebar_position: 2
description: Install Fetchy from source or download the pre-built installer for Windows, macOS, or Linux.
---

# Installation

Fetchy can be installed by downloading a pre-built release or building from source.

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** (included with Node.js) or **yarn**

Verify your Node.js version:

```bash
node --version  # should be >= 18.0.0
```

---

## Option 1: Download the Installer (Recommended)

Download the latest pre-built release from GitHub:

👉 [**GitHub Releases**](https://github.com/AkinerAlkan94/fetchy/releases)

| Platform | File |
|----------|------|
| Windows | `Fetchy Setup x.x.x.exe` (NSIS installer) |
| macOS | `.dmg` file |
| Linux | `.AppImage` file |

---

## Option 2: Build from Source

### 1. Clone the repository

```bash
git clone https://github.com/AkinerAlkan94/fetchy.git
cd fetchy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run in development mode

```bash
npm run electron:dev
```

This starts both the Vite dev server and Electron simultaneously. Hot-reload is enabled.

### 4. Build for production

```bash
npm run electron:build
```

After building, find the installer in the `release/` folder:

```
release/
├── Fetchy Setup x.x.x.exe    # Windows installer
├── Fetchy-x.x.x.dmg          # macOS
└── Fetchy-x.x.x.AppImage     # Linux
```

---

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run Vite dev server only (browser) |
| `npm run electron:dev` | Run Electron + Vite simultaneously |
| `npm run electron:build` | Build and package the app |
| `npm run electron:preview` | Preview production build in Electron |
| `npm run build` | TypeScript compile + Vite build |
| `npm test` | Run tests with Vitest |

---

## First Launch

When Fetchy launches for the first time, you will be prompted to:

1. **Create a workspace** — provide a name, home directory (for collections/environments), and secrets directory (for secret variable values)
2. The workspace directories will be created on your filesystem
3. **Take the interactive onboarding tour** — a short, five-step walkthrough of collections, the request/response panels, environments, and the AI assistant

Your API data is stored as plain JSON files in the directories you choose.

:::tip
You can skip the tour at any time (`Esc`, the close button, or **Skip tour**), and replay it later from **Settings → General → Replay Tour**.
:::

---

## Next Steps

- [Your First Request →](./first-request) — Send your first API request in 60 seconds
