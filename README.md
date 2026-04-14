<p align="center">
  <img src="public/fetchy_readme_logo.jpg" alt="Fetchy Readme Logo" width="512" height="512" style="border-radius: 20px;">
</p>

<h1 align="center">Fetchy</h1>

<p align="center">
  <strong>Local by design. Reliable by nature.</strong>
</p>

<p align="center">
  A powerful, privacy-focused, self-hosted REST API client for developers who value data ownership and offline capabilities.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.5.65-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/electron-powered-9feaf9.svg" alt="Electron">
</p>

---

## 🔒 Privacy First - Self-Hosted & Offline

**Fetchy is designed with privacy at its core.** Unlike cloud-based alternatives, Fetchy:

- ✅ **100% Self-Hosted** - All your data stays on your machine
- ✅ **No Cloud Sync** - No data ever leaves your computer
- ✅ **No Account Required** - Start using immediately without registration
- ✅ **No Telemetry** - Zero tracking, zero analytics
- ✅ **Works Offline** - Full functionality without internet connection
- ✅ **Local File Storage** - All collections, environments, and history stored locally
- ✅ **Portable** - Move your data wherever you want

**Your API keys, credentials, and request data are YOUR data.** Fetchy ensures complete control over sensitive information

---

## ✨ Features

### 📡 HTTP Request Management

- **All HTTP Methods** - Support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS
- **Query Parameters** - Easy-to-use parameter builder with enable/disable toggles
- **Custom Headers** - Add, modify, and toggle request headers
- **Batch Edit** - Edit headers and parameters in bulk as raw text
- **Request Body Types**:
  - JSON (with syntax highlighting)
  - Form Data (multipart/form-data)
  - URL Encoded (x-www-form-urlencoded)
  - Raw text
  - Binary file support

### 🔐 Authentication

- **Bearer Token** - JWT and token-based authentication
- **Basic Auth** - Username/password authentication
- **API Key** - Header or query parameter API keys
- **Inheritance** - Collections and folders can define auth that inherits to child requests (`inherit` mode)
- **No Auth** - Explicitly disable authentication for specific requests

### 📁 Collection Management

- **Organized Collections** - Group related requests into collections
- **Nested Folders** - Create hierarchical folder structures
- **Drag & Drop** - Reorder collections, folders, and requests with drag-and-drop
- **Collection Variables** - Define variables scoped to specific collections, with separate initial (shareable) and current (local) values
- **Collection-Level Auth** - Set authentication at collection or folder level that child requests can inherit
- **Collection Runner** - Run all requests in a collection sequentially or in parallel, with configurable delay between requests, stop-on-error option, and multiple iterations

### 🌍 Environment Variables

- **Multiple Environments** - Create separate environments (Development, Staging, Production)
- **Variable Substitution** - Use `<<variable_name>>` syntax in URLs, headers, and body
- **Secret Variables** - Mark sensitive variables for visual distinction; secrets are stored in a separate directory per workspace
- **Initial & Current Values** - Each variable has a shareable initial value and a local-only current value
- **Quick Environment Switching** - Easily switch between environments from the toolbar dropdown

### 📜 Scripts

- **Pre-Request Script** - Run JavaScript before a request is sent to dynamically modify request data or set variables
- **Post-Request Script** - Run JavaScript after a response is received to write assertions or process response data
- **Script Snippets** - Built-in snippet panel for common scripting patterns (both pre- and post-request)
- **Script Output** - View console output and errors from scripts directly in the response panel

### 📊 Response Handling

- **Response Viewer** - View response body with syntax highlighting
- **Response Headers** - Inspect all response headers
- **Request Details** - View the actual request that was sent (with resolved variables)
- **Performance Metrics** - Response time and size information
- **Status Indicators** - Color-coded status codes for quick identification
- **Copy to Clipboard** - Easily copy response data
- **Script Console** - View output and errors from pre- and post-request scripts

### 📜 Request History

- **Automatic History** - All sent requests are automatically saved
- **History Browser** - Browse and search through past requests
- **One-Click Restore** - Quickly re-send or restore previous requests in a new tab
- **Response Cache** - History includes response data for reference
- **Configurable Limit** - Set the maximum number of history items to retain

### 🔄 Import & Export

- **Postman Import** - Import collections from Postman (v2.1 format)
- **OpenAPI Import** - Import API specifications from OpenAPI/Swagger (JSON & YAML)
- **cURL Import** - Paste cURL commands to create requests instantly
- **Postman Export** - Export collections to Postman v2.1-compatible format
- **Workspace Export/Import** - Export an entire workspace (collections, environments, variables) as a single JSON file and import it on another machine

### 💻 Code Generation

Generate ready-to-use code snippets for the current request in multiple languages:

| Language | Library |
|----------|---------|
| cURL | - |
| JavaScript | `fetch` |
| Python | `requests` |
| Java | `HttpClient` |
| C# / .NET | `HttpClient` |
| Go | `net/http` |
| Rust | `reqwest` |
| C++ | `libcurl` |

Variables in the request are resolved before generating the snippet.

### 🗂️ OpenAPI Editor

- **In-App Editor** - Edit OpenAPI specifications directly inside Fetchy with full syntax highlighting (YAML & JSON)
- **Import to Collection** - Convert an OpenAPI spec into a Fetchy collection in one click

### 🗃️ Workspaces

- **Multiple Workspaces** - Create separate workspaces for different projects or clients
- **Separate Storage Directories** - Each workspace has its own home directory (collections, environments) and secrets directory (secret variable values)
- **Switch Workspaces** - Switch between workspaces; the app reloads with the selected workspace's data
- **Export & Import Workspaces** - Back up and restore a full workspace to/from a single JSON file
- **Workspace Management** - Add, rename, remove, export, and import workspaces from the Settings panel

### 🤖 AI Assistant

- **AI-Powered Analysis** - Analyze API responses using local or remote AI providers (Ollama, OpenAI, Azure OpenAI, Google Gemini)
- **Bug Report Generation** - Automatically generate detailed bug reports from failed API responses
- **One-Click Jira Bug Creation** - Create Jira issues directly from AI-generated bug reports with a single click
- **Configurable AI Providers** - Choose between local (Ollama) and cloud-based AI providers with customizable models and endpoints

### 🐛 Jira Integration

- **Direct Bug Creation** - Create Jira bugs from AI-generated reports without leaving Fetchy
- **Secure Token Storage** - Personal Access Token stored securely via OS credential manager
- **Field Discovery** - Auto-detect required and optional fields from Jira's createmeta API
- **Custom Field Mapping** - Map any Jira custom field with support for 5 field types:
  - `text` — plain string values
  - `option` — single-select fields (`{value: "..."}`)
  - `array` — multi-value fields (comma-separated)
  - `insight` — Jira Assets/Insight object keys (`[{key: "..."}]`)
  - `raw` — arbitrary JSON for exotic field formats
- **Insight Object Search** - Search Jira Assets objects with live filtering and debounce
- **Map Required Fields** - One-click mapping of all required fields from field discovery
- **Connection Testing** - Verify Jira connectivity before creating issues
- **Clickable Issue Links** - Created issues open directly in system browser

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current request |
| `Ctrl+Enter` | Send request |
| `Ctrl+N` | New request |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+1-9` | Switch to tab 1-9 |
| `Ctrl+I` | Import collection |
| `Ctrl+E` | Open environments |
| `Ctrl+/` | Show keyboard shortcuts |

### 🎨 Themes & Customization

- **9 Built-in Themes** - Dark, Light, Ocean, Forest, Earth, Aurora, Flame, Candy, Rainbow
- **Custom Themes** - Create fully custom themes by defining your own color palette (background, sidebar, card, text, border, accent, and more)
- **Edit & Delete Custom Themes** - Manage your saved custom themes at any time
- **Panel Layout** - Switch the response panel between a side-by-side (horizontal) and top-bottom (vertical) layout
- **Resizable Panels** - Drag to resize the sidebar and request/response panels
- **Collapsible Sidebar** - Hide the sidebar to maximize the working area
- **Syntax Highlighting** - JSON and code highlighting powered by CodeMirror 6
- **Variable Highlighting** - Visual indication when variables are defined (green) or undefined (yellow)

### ⚙️ Settings

- **Auto-Save** - Automatically persist changes to collections
- **Max History Items** - Control how many request history entries are retained (10–500)
- **Panel Layout** - Configure whether the response panel appears to the right or below the request panel
- **Workspace Management** - Switch, create, export, and import workspaces

### 💾 Data Storage

- **Workspace-Based Storage** - Each workspace stores its data in a chosen directory on your filesystem
- **Separate Secrets Directory** - Secret variable values are stored in a dedicated directory, separate from the rest of the workspace data
- **JSON Storage** - All data is stored as human-readable JSON files
- **Automatic Persistence** - Changes are saved automatically (when auto-save is enabled)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AkinerAlkan94/fetchy.git
   cd fetchy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run electron:dev
   ```

4. **Build for production**
   ```bash
   npm run electron:build
   ```

### Download

#### Windows
Download the latest release for Windows:
- 📦 [**Fetchy Releases**](https://github.com/AkinerAlkan94/fetchy/releases)

### Distribution

After building, you'll find the installers in the `release` folder:
- **Windows**: `Fetchy Setup x.x.x.exe` (NSIS installer)
- **macOS**: `.dmg` file
- **Linux**: `.AppImage` file

---

## 📖 Usage Guide

### Creating Your First Request

1. Create or select a workspace when prompted on first launch
2. Click the **+** button in the sidebar or press `Ctrl+N`
3. Enter your API endpoint URL
4. Select the HTTP method
5. Add headers, parameters, or body as needed
6. Click **Send** or press `Ctrl+Enter`

### Using Environment Variables

1. Open the Environment modal (`Ctrl+E`)
2. Create a new environment
3. Add variables (e.g., `base_url`, `api_key`)
4. Use variables in your requests: `<<base_url>>/api/users`
5. Variables are highlighted in green when defined, yellow when undefined
6. Switch environments using the dropdown in the top toolbar

### Organizing with Collections

1. Create a collection for your project
2. Add folders for different API modules
3. Drag and drop to organize requests, folders, and collections
4. Set collection-level auth to apply to all child requests
5. Define collection variables for values shared across all requests

### Running a Collection

1. Right-click a collection in the sidebar and choose **Run Collection**
2. Configure the run mode (sequential or parallel), delay, iterations, and stop-on-error behaviour
3. Click **Run** to execute all requests and view per-request results

### Using Scripts

1. Open a request and select the **Pre-Script** or **Script** tab
2. Write JavaScript code; use the built-in snippet panel for common patterns
3. Script output and errors appear in the **Console** tab of the response panel after the request is sent

### Generating Code Snippets

1. Open a request
2. Click the **Code** button (or the arrow next to it to pick a language)
3. Copy the generated snippet for cURL, JavaScript, Python, Java, C#, Go, Rust, or C++

### Importing from Postman

1. Export your collection from Postman (Collection v2.1)
2. In Fetchy, click **Import** or press `Ctrl+I`
3. Select "Postman Collection" and choose your exported file
4. Your collection is now ready to use

### Managing Workspaces

1. Open **Settings** from the top toolbar
2. Click **Manage Workspaces**
3. Create a new workspace by providing a name, home directory, and secrets directory
4. Switch between workspaces; each one maintains its own collections and environments
5. Export a workspace to back it up and import it on another machine

---

## 🛠️ Technology Stack

- **Frontend**: React 19 with TypeScript
- **UI Styling**: Tailwind CSS
- **State Management**: Zustand
- **Code Editor**: CodeMirror 6
- **Desktop Framework**: Electron 40
- **Build Tool**: Vite
- **Drag & Drop**: dnd-kit

---

## 📂 Project Structure

```
fetchy/
├── electron/           # Electron main process
│   ├── main.js        # Main process entry
│   └── preload.js     # Preload scripts for IPC
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── store/         # Zustand stores
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Helper functions
│   ├── App.tsx        # Main application component
│   └── main.tsx       # React entry point
├── build/             # Build resources (icons)
└── public/            # Static assets
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📋 Roadmap

- [x] Theme customization (9 built-in themes + fully custom themes)
- [x] Pre-request and post-request scripts
- [x] Code generation (cURL, JavaScript, Python, Java, C#, Go, Rust, C++)
- [x] Collection runner (sequential & parallel)
- [x] OpenAPI editor
- [x] Workspaces with separate secrets storage
- [x] Response assertions
- [x] Request chaining
- [x] AI Assistant (Ollama, OpenAI, Azure OpenAI, Gemini)
- [x] Jira bug creation from AI reports (with Assets/Insight field support)
- [ ] Request documentation/notes

---

## 🤝 Contributing

We welcome contributions from the community! Whether you want to report a bug, request a feature, or submit a code change, please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.

For AI coding agents, see [AGENTS.md](AGENTS.md) for a comprehensive guide to the project structure, architecture, and conventions.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by Postman, Insomnia, and Bruno
- Built with love for the developer community
- Icons from Lucide React

---

<p align="center">
  <strong>Fetchy</strong> - Because your API data should stay yours.
</p>

<p align="center">
  Made with ❤️ for developers who care about privacy
</p>


