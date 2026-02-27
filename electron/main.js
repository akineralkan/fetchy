const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

/**
 * Atomic file write: writes content to a temporary file in the same directory,
 * then renames it to the target path. `fs.renameSync` is atomic on NTFS, ext4,
 * and APFS as long as source and destination are on the same filesystem (same
 * directory guarantees this). If the rename fails, the temp file is cleaned up.
 */
function safeWriteFileSync(filePath, content, encoding = 'utf-8') {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, encoding);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file if rename (or write) failed
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

let mainWindow;
let customHomeDirectory = null;
let customSecretsDirectory = null;

// ─── STORAGE FILE WATCHER ─────────────────────────────────────────────────────

let storageWatcher = null;
let lastWriteTimestamp = 0; // updated whenever we write fetchy-storage.json ourselves
let storageWatchDebounceTimer = null;

function startStorageWatcher(directory) {
  stopStorageWatcher();
  if (!directory || !fs.existsSync(directory)) return;
  try {
    storageWatcher = fs.watch(directory, { persistent: false }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      // Ignore changes that are our own writes (within 2 seconds)
      if (Date.now() - lastWriteTimestamp < 2000) return;
      // Debounce rapid file events
      if (storageWatchDebounceTimer) clearTimeout(storageWatchDebounceTimer);
      storageWatchDebounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('storage-file-changed', { filename });
        }
      }, 500);
    });
    storageWatcher.on('error', () => stopStorageWatcher());
  } catch (e) {
    console.error('Failed to start storage watcher:', e);
  }
}

function stopStorageWatcher() {
  if (storageWatcher) {
    try { storageWatcher.close(); } catch {}
    storageWatcher = null;
  }
  if (storageWatchDebounceTimer) {
    clearTimeout(storageWatchDebounceTimer);
    storageWatchDebounceTimer = null;
  }
}

// ─── PREFERENCES ─────────────────────────────────────────────────────────────

function getPreferencesFilePath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPreferences() {
  try {
    const prefsPath = getPreferencesFilePath();
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
  return { homeDirectory: null, theme: 'dark', autoSave: true, maxHistoryItems: 100 };
}

function savePreferences(preferences) {
  try {
    const prefsPath = getPreferencesFilePath();
    safeWriteFileSync(prefsPath, JSON.stringify(preferences, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return false;
  }
}

// ─── WORKSPACES ───────────────────────────────────────────────────────────────

function getWorkspacesFilePath() {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function loadWorkspacesConfig() {
  try {
    const wPath = getWorkspacesFilePath();
    if (fs.existsSync(wPath)) {
      return JSON.parse(fs.readFileSync(wPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading workspaces config:', error);
  }
  return { workspaces: [], activeWorkspaceId: null };
}

function saveWorkspacesConfig(config) {
  try {
    safeWriteFileSync(getWorkspacesFilePath(), JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving workspaces config:', error);
    return false;
  }
}

// ─── DIRECTORIES ─────────────────────────────────────────────────────────────

function getEffectiveDataDirectory() {
  if (customHomeDirectory && fs.existsSync(customHomeDirectory)) {
    return customHomeDirectory;
  }
  return path.join(app.getPath('userData'), 'data');
}

function getEffectiveSecretsDirectory() {
  if (customSecretsDirectory) {
    return customSecretsDirectory;
  }
  // Fallback: .secrets inside the data directory
  return path.join(getEffectiveDataDirectory(), '.secrets');
}

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

function initializeWorkspace() {
  const workspacesConfig = loadWorkspacesConfig();

  if (workspacesConfig.activeWorkspaceId && workspacesConfig.workspaces.length > 0) {
    const active = workspacesConfig.workspaces.find(
      (w) => w.id === workspacesConfig.activeWorkspaceId
    );
    if (active) {
      if (active.homeDirectory) {
        customHomeDirectory = active.homeDirectory;
      }
      if (active.secretsDirectory) {
        customSecretsDirectory = active.secretsDirectory;
      }
      return;
    }
  }

  // Fallback: legacy preferences.homeDirectory
  const prefs = loadPreferences();
  if (prefs.homeDirectory && fs.existsSync(prefs.homeDirectory)) {
    customHomeDirectory = prefs.homeDirectory;
  }
}

// ─── WINDOW ──────────────────────────────────────────────────────────────────

function createWindow() {
  initializeWorkspace();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, '..', 'build', 'icons', 'win', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
    backgroundColor: '#1a1a2e',
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopStorageWatcher();
  });

  // Start watching the active workspace's home directory for external file changes
  if (customHomeDirectory) {
    startStorageWatcher(customHomeDirectory);
  }
}

Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ─── IPC: FILE OPERATIONS ─────────────────────────────────────────────────────

ipcMain.handle('open-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'YAML Files', extensions: ['yaml', 'yml'] },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('save-file', async (event, { content, defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('get-data-path', () => {
  const dataPath = getEffectiveDataDirectory();
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  return dataPath;
});

/**
 * Resolve a caller-supplied filename against a trusted base directory.
 * Returns the resolved absolute path, or throws if the result would escape
 * the base directory (e.g. via `../../` traversal or absolute paths).
 */
function safePath(baseDir, filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('Invalid filename');
  }
  const resolved = path.resolve(baseDir, filename);
  // Ensure the resolved path is strictly inside baseDir (+ path.sep to avoid
  // prefix-matching a sibling directory, e.g. "data" vs "data-backup").
  const base = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (!resolved.startsWith(base) && resolved !== baseDir) {
    throw new Error(`Path traversal blocked: ${filename}`);
  }
  return resolved;
}

ipcMain.handle('read-data', async (event, filename) => {
  try {
    const dataPath = safePath(getEffectiveDataDirectory(), filename);
    if (fs.existsSync(dataPath)) return fs.readFileSync(dataPath, 'utf-8');
    return null;
  } catch (error) {
    console.error('Error reading data:', error);
    return null;
  }
});

ipcMain.handle('write-data', async (event, { filename, content }) => {
  try {
    const dataDir = getEffectiveDataDirectory();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const filePath = safePath(dataDir, filename);
    lastWriteTimestamp = Date.now(); // track our own writes to suppress watcher events
    safeWriteFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
});

// ─── IPC: SECRETS ─────────────────────────────────────────────────────────────

ipcMain.handle('read-secrets', async () => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    const secretsPath = path.join(secretsDir, 'fetchy-secrets.json');
    if (fs.existsSync(secretsPath)) return fs.readFileSync(secretsPath, 'utf-8');
    return null;
  } catch (error) {
    console.error('Error reading secrets:', error);
    return null;
  }
});

ipcMain.handle('write-secrets', async (event, { content }) => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
    safeWriteFileSync(path.join(secretsDir, 'fetchy-secrets.json'), content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing secrets:', error);
    return false;
  }
});

// ─── IPC: AI SECRETS ──────────────────────────────────────────────────────────

ipcMain.handle('read-ai-secrets', async () => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    const aiSecretsPath = path.join(secretsDir, 'ai-secrets.json');
    if (fs.existsSync(aiSecretsPath)) return fs.readFileSync(aiSecretsPath, 'utf-8');
    return null;
  } catch (error) {
    console.error('Error reading AI secrets:', error);
    return null;
  }
});

ipcMain.handle('write-ai-secrets', async (event, { content }) => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
    safeWriteFileSync(path.join(secretsDir, 'ai-secrets.json'), content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing AI secrets:', error);
    return false;
  }
});

ipcMain.handle('delete-ai-secrets', async () => {
  try {
    const secretsDir = getEffectiveSecretsDirectory();
    const aiSecretsPath = path.join(secretsDir, 'ai-secrets.json');
    if (fs.existsSync(aiSecretsPath)) fs.unlinkSync(aiSecretsPath);
    return true;
  } catch (error) {
    console.error('Error deleting AI secrets:', error);
    return false;
  }
});

// ─── IPC: PREFERENCES ─────────────────────────────────────────────────────────

ipcMain.handle('get-preferences', () => loadPreferences());

ipcMain.handle('save-preferences', async (event, preferences) => {
  const success = savePreferences(preferences);
  if (success && preferences.homeDirectory) {
    customHomeDirectory = preferences.homeDirectory;
  }
  return success;
});

// Legacy – still here for any existing consumers
ipcMain.handle('select-home-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Home Directory for Fetchy Data',
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

ipcMain.handle('get-home-directory', () => {
  return customHomeDirectory || path.join(app.getPath('userData'), 'data');
});

ipcMain.handle('migrate-data', async (event, { oldPath, newPath }) => {
  try {
    if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });
    if (fs.existsSync(oldPath)) {
      const files = fs.readdirSync(oldPath);
      for (const file of files) {
        const srcPath = path.join(oldPath, file);
        const destPath = path.join(newPath, file);
        if (fs.statSync(srcPath).isFile()) fs.copyFileSync(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    console.error('Error migrating data:', error);
    return false;
  }
});

// ─── IPC: WORKSPACE MANAGEMENT ───────────────────────────────────────────────

ipcMain.handle('get-workspaces', () => {
  return loadWorkspacesConfig();
});

ipcMain.handle('save-workspaces', (event, config) => {
  const success = saveWorkspacesConfig(config);
  // Hot-update active workspace dirs without reload (reload done by renderer)
  if (success && config.activeWorkspaceId) {
    const active = config.workspaces.find((w) => w.id === config.activeWorkspaceId);
    if (active) {
      customHomeDirectory = active.homeDirectory || null;
      customSecretsDirectory = active.secretsDirectory || null;
      // Restart watcher for the new active workspace directory
      if (customHomeDirectory) {
        startStorageWatcher(customHomeDirectory);
      } else {
        stopStorageWatcher();
      }
    }
  }
  return success;
});

ipcMain.handle('select-directory', async (event, { title } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: title || 'Select Directory',
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

// Export a workspace's data (home + secrets) to a single JSON file via save dialog
ipcMain.handle('export-workspace-to-json', async (event, { workspaceId }) => {
  try {
    const config = loadWorkspacesConfig();
    const workspace = config.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return { success: false, error: 'Workspace not found' };

    // Read public data
    let publicData = null;
    const homeDataPath = path.join(workspace.homeDirectory, 'fetchy-storage.json');
    if (fs.existsSync(homeDataPath)) {
      publicData = JSON.parse(fs.readFileSync(homeDataPath, 'utf-8'));
    }

    // Read secrets
    let secretsData = null;
    const secretsFilePath = path.join(workspace.secretsDirectory, 'fetchy-secrets.json');
    if (fs.existsSync(secretsFilePath)) {
      secretsData = JSON.parse(fs.readFileSync(secretsFilePath, 'utf-8'));
    }

    const exportData = {
      fetchyWorkspaceExport: true,
      version: '2.0',
      exportedAt: new Date().toISOString(),
      workspaceName: workspace.name,
      publicData,
      secretsData,
    };

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `fetchy-workspace-${workspace.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      title: 'Export Workspace',
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: 'Cancelled' };
  } catch (error) {
    console.error('Error exporting workspace:', error);
    return { success: false, error: error.message };
  }
});

// Import a workspace from a JSON export file
ipcMain.handle('import-workspace-from-json', async (event, { name, homeDirectory, secretsDirectory, exportData }) => {
  try {
    if (!fs.existsSync(homeDirectory)) fs.mkdirSync(homeDirectory, { recursive: true });
    if (!fs.existsSync(secretsDirectory)) fs.mkdirSync(secretsDirectory, { recursive: true });

    if (exportData.publicData) {
      safeWriteFileSync(
        path.join(homeDirectory, 'fetchy-storage.json'),
        JSON.stringify(exportData.publicData, null, 2),
        'utf-8'
      );
    }

    if (exportData.secretsData) {
      safeWriteFileSync(
        path.join(secretsDirectory, 'fetchy-secrets.json'),
        JSON.stringify(exportData.secretsData, null, 2),
        'utf-8'
      );
    }

    const newWorkspace = {
      id: crypto.randomUUID(),
      name,
      homeDirectory,
      secretsDirectory,
      createdAt: Date.now(),
    };

    const config = loadWorkspacesConfig();
    config.workspaces.push(newWorkspace);
    saveWorkspacesConfig(config);

    return { success: true, workspace: newWorkspace };
  } catch (error) {
    console.error('Error importing workspace:', error);
    return { success: false, error: error.message };
  }
});

// ─── IPC: HTTP REQUEST ────────────────────────────────────────────────────────

ipcMain.handle('http-request', async (event, { url, method, headers, body, sslVerification }) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: headers || {},
        // Default to true; only disable when explicitly set to false per-request
        rejectUnauthorized: sslVerification !== false,
      };

      const req = httpModule.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const endTime = Date.now();
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          const responseHeaders = {};
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: responseHeaders,
            body: responseBody,
            time: endTime - startTime,
            size: Buffer.byteLength(responseBody, 'utf-8'),
          });
        });
      });

      req.on('error', (error) => {
        const endTime = Date.now();
        let statusText = 'Network Error';
        if (error.code === 'ENOTFOUND') statusText = 'DNS Lookup Failed';
        else if (error.code === 'ECONNREFUSED') statusText = 'Connection Refused';
        else if (error.code === 'ECONNRESET') statusText = 'Connection Reset';
        else if (error.code === 'ETIMEDOUT') statusText = 'Connection Timed Out';
        else if (error.code === 'CERT_HAS_EXPIRED') statusText = 'Certificate Expired';
        else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') statusText = 'SSL Certificate Error';

        resolve({
          status: 0,
          statusText,
          headers: {},
          body: JSON.stringify({ error: error.message, code: error.code }),
          time: endTime - startTime,
          size: 0,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          statusText: 'Timeout',
          headers: {},
          body: JSON.stringify({ error: 'Request timed out' }),
          time: Date.now() - startTime,
          size: 0,
        });
      });

      req.setTimeout(30000);
      if (body) req.write(body);
      req.end();
    } catch (error) {
      resolve({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: error.message }),
        time: Date.now() - startTime,
        size: 0,
      });
    }
  });
});

// ─── IPC: AI REQUEST ──────────────────────────────────────────────────────────

/**
 * Build the HTTP request options for each AI provider.
 * Returns { url, headers, body } ready to send.
 */
function buildAIRequest(provider, apiKey, model, baseUrl, messages, temperature, maxTokens) {
  switch (provider) {
    case 'openai': {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        }),
      };
    }
    case 'claude': {
      // Anthropic uses a separate system field and x-api-key header
      const systemMsg = messages.find((m) => m.role === 'system');
      const nonSystemMsgs = messages.filter((m) => m.role !== 'system');
      const body = {
        model: model || 'claude-sonnet-4-20250514',
        messages: nonSystemMsgs,
        max_tokens: maxTokens ?? 2048,
        temperature: temperature ?? 0.7,
      };
      if (systemMsg) body.system = systemMsg.content;
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      };
    }
    case 'gemini': {
      // Google Gemini uses contents/parts structure
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      const systemInstruction = messages.find((m) => m.role === 'system');
      const geminiBody = {
        contents,
        generationConfig: {
          temperature: temperature ?? 0.7,
          maxOutputTokens: maxTokens ?? 2048,
        },
      };
      if (systemInstruction) {
        geminiBody.systemInstruction = { parts: [{ text: systemInstruction.content }] };
      }
      const geminiModel = model || 'gemini-2.0-flash';
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      };
    }
    case 'ollama': {
      // Ollama exposes an OpenAI-compatible endpoint locally
      const ollamaBase = baseUrl || 'http://localhost:11434';
      return {
        url: `${ollamaBase}/v1/chat/completions`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        }),
      };
    }
    case 'custom': {
      // Custom provider uses OpenAI-compatible format
      if (!baseUrl) throw new Error('Custom provider requires a base URL');
      const customHeaders = { 'Content-Type': 'application/json' };
      if (apiKey) customHeaders['Authorization'] = `Bearer ${apiKey}`;
      return {
        url: baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/v1/chat/completions`,
        headers: customHeaders,
        body: JSON.stringify({
          model: model || 'default',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        }),
      };
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Parse the AI provider response into a unified format.
 */
function parseAIResponse(provider, responseBody) {
  try {
    const data = JSON.parse(responseBody);

    if (provider === 'claude') {
      // Anthropic response format
      const content = data.content?.[0]?.text || '';
      return {
        success: true,
        content,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens || 0,
              completionTokens: data.usage.output_tokens || 0,
              totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
            }
          : undefined,
      };
    }
    if (provider === 'gemini') {
      // Gemini response format
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        success: true,
        content,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount || 0,
              completionTokens: data.usageMetadata.candidatesTokenCount || 0,
              totalTokens: data.usageMetadata.totalTokenCount || 0,
            }
          : undefined,
      };
    }
    // OpenAI-compatible format (openai, ollama, custom)
    const content = data.choices?.[0]?.message?.content || '';
    return {
      success: true,
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  } catch {
    return { success: false, content: '', error: 'Failed to parse AI response: ' + responseBody.slice(0, 500) };
  }
}

ipcMain.handle('ai-request', async (event, { provider, apiKey, model, baseUrl, messages, temperature, maxTokens }) => {
  return new Promise((resolve) => {
    try {
      const { url, headers, body } = buildAIRequest(provider, apiKey, model, baseUrl, messages, temperature, maxTokens);

      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers,
        // AI requests always verify TLS — they carry API keys
        rejectUnauthorized: true,
      };

      const req = httpModule.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parseAIResponse(provider, responseBody));
          } else {
            let errorMsg = `AI request failed (${res.statusCode})`;
            try {
              const errData = JSON.parse(responseBody);
              errorMsg = errData.error?.message || errData.error?.type || errData.message || errorMsg;
            } catch {}
            resolve({ success: false, content: '', error: errorMsg });
          }
        });
      });

      req.on('error', (error) => {
        let errorMsg = error.message;
        if (error.code === 'ENOTFOUND') errorMsg = 'DNS lookup failed – check your internet connection or API URL';
        else if (error.code === 'ECONNREFUSED') errorMsg = 'Connection refused – is the AI service running?';
        else if (error.code === 'ETIMEDOUT') errorMsg = 'Connection timed out';
        resolve({ success: false, content: '', error: errorMsg });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, content: '', error: 'AI request timed out after 60 seconds' });
      });

      req.setTimeout(60000); // 60s timeout for AI requests
      if (body) req.write(body);
      req.end();
    } catch (error) {
      resolve({ success: false, content: '', error: error.message });
    }
  });
});

// ─── IPC: GIT OPERATIONS ──────────────────────────────────────────────────────

/**
 * Run a git command in the given cwd.
 * Returns { success, stdout, stderr }.
 */
function runGit(args, cwd, timeout = 30000) {
  return new Promise((resolve) => {
    const gitBin = process.platform === 'win32' ? 'git' : 'git';
    execFile(gitBin, args, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, stdout: stdout || '', stderr: stderr || error.message });
      } else {
        resolve({ success: true, stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

// Check if git is available on the system
ipcMain.handle('git-check', async () => {
  try {
    const result = await runGit(['--version'], process.cwd(), 5000);
    return { available: result.success, version: result.stdout.trim() };
  } catch {
    return { available: false, version: '' };
  }
});

// Get full git status of the workspace directory
ipcMain.handle('git-status', async (event, { directory }) => {
  try {
    if (!directory || !fs.existsSync(directory)) {
      return { success: false, error: 'Directory does not exist' };
    }

    // Check if it's a git repo
    const gitDir = path.join(directory, '.git');
    const isRepo = fs.existsSync(gitDir);
    if (!isRepo) {
      return { success: true, isRepo: false };
    }

    // Get branch name
    const branchResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], directory);
    const branch = branchResult.success ? branchResult.stdout.trim() : 'unknown';

    // Get status (porcelain for machine-readable)
    const statusResult = await runGit(['status', '--porcelain'], directory);
    const changes = statusResult.success
      ? statusResult.stdout
          .trim()
          .split('\n')
          .filter((l) => l.trim() !== '')
      : [];

    // Get remote URL
    const remoteResult = await runGit(['remote', 'get-url', 'origin'], directory);
    const remoteUrl = remoteResult.success ? remoteResult.stdout.trim() : '';

    // Get last commit info
    const logResult = await runGit(
      ['log', '-1', '--format=%H|%s|%an|%ai'],
      directory
    );
    let lastCommit = null;
    if (logResult.success && logResult.stdout.trim()) {
      const parts = logResult.stdout.trim().split('|');
      lastCommit = {
        hash: parts[0] || '',
        message: parts[1] || '',
        author: parts[2] || '',
        date: parts[3] || '',
      };
    }

    // Check if ahead/behind remote
    let ahead = 0;
    let behind = 0;
    if (remoteUrl) {
      const aheadResult = await runGit(['rev-list', '--count', `origin/${branch}..HEAD`], directory);
      if (aheadResult.success) ahead = parseInt(aheadResult.stdout.trim()) || 0;
      const behindResult = await runGit(['rev-list', '--count', `HEAD..origin/${branch}`], directory);
      if (behindResult.success) behind = parseInt(behindResult.stdout.trim()) || 0;
    }

    return {
      success: true,
      isRepo: true,
      branch,
      changes,
      remoteUrl,
      lastCommit,
      ahead,
      behind,
      hasChanges: changes.length > 0,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Initialize a git repository
ipcMain.handle('git-init', async (event, { directory }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

    const result = await runGit(['init'], directory);
    if (!result.success) return { success: false, error: result.stderr };

    // Create a default .gitignore if it doesn't exist
    const gitignorePath = path.join(directory, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(
        gitignorePath,
        '# Fetchy secrets - never commit\n.secrets/\nai-secrets.json\nfetchy-secrets.json\n\n# OS files\n.DS_Store\nThumbs.db\n',
        'utf-8'
      );
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clone a repository into a directory
ipcMain.handle('git-clone', async (event, { url, directory }) => {
  try {
    if (!url) return { success: false, error: 'No repository URL specified' };
    if (!directory) return { success: false, error: 'No directory specified' };

    // Clone into a temp name then move contents, or clone directly
    // We clone into the directory directly. If directory exists and is not empty,
    // we clone into a subdirectory then move.
    const parentDir = path.dirname(directory);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

    // If directory already exists and has files, we need to handle it
    if (fs.existsSync(directory)) {
      const files = fs.readdirSync(directory);
      if (files.length > 0) {
        // Directory is not empty. Clone to a temp directory then merge.
        const tmpDir = directory + '_git_clone_tmp_' + Date.now();
        const cloneResult = await runGit(['clone', url, tmpDir], parentDir, 120000);
        if (!cloneResult.success) {
          return { success: false, error: cloneResult.stderr };
        }
        // Move .git folder and all files from tmpDir to directory
        const clonedFiles = fs.readdirSync(tmpDir);
        for (const f of clonedFiles) {
          const src = path.join(tmpDir, f);
          const dest = path.join(directory, f);
          if (!fs.existsSync(dest)) {
            fs.renameSync(src, dest);
          }
        }
        // Remove tmp dir
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return { success: true };
      }
    }

    // Directory is empty or doesn't exist – clone directly
    const result = await runGit(['clone', url, directory], parentDir, 120000);
    if (!result.success) {
      return { success: false, error: result.stderr };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Pull from remote
ipcMain.handle('git-pull', async (event, { directory }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    const result = await runGit(['pull'], directory, 120000);
    if (!result.success) return { success: false, error: result.stderr };
    return { success: true, output: result.stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Push to remote
ipcMain.handle('git-push', async (event, { directory }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    const result = await runGit(['push'], directory, 120000);
    if (!result.success) return { success: false, error: result.stderr };
    return { success: true, output: result.stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stage all files and commit with a message
ipcMain.handle('git-add-commit', async (event, { directory, message }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    if (!message) message = `Fetchy auto-commit ${new Date().toISOString()}`;

    // Stage all changes
    const addResult = await runGit(['add', '-A'], directory);
    if (!addResult.success) return { success: false, error: addResult.stderr };

    // Commit
    const commitResult = await runGit(['commit', '-m', message], directory);
    if (!commitResult.success) {
      // "nothing to commit" is not really an error
      if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
        return { success: true, output: 'Nothing to commit' };
      }
      return { success: false, error: commitResult.stderr || commitResult.stdout };
    }
    return { success: true, output: commitResult.stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stage all, commit, and push (for auto-sync)
ipcMain.handle('git-add-commit-push', async (event, { directory, message }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    if (!message) message = `Fetchy auto-sync ${new Date().toISOString()}`;

    // Stage all
    const addResult = await runGit(['add', '-A'], directory);
    if (!addResult.success) return { success: false, error: addResult.stderr };

    // Commit
    const commitResult = await runGit(['commit', '-m', message], directory);
    if (!commitResult.success) {
      if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
        return { success: true, output: 'Nothing to commit' };
      }
      return { success: false, error: commitResult.stderr || commitResult.stdout };
    }

    // Push
    const pushResult = await runGit(['push'], directory, 120000);
    if (!pushResult.success) return { success: false, error: pushResult.stderr };
    return { success: true, output: 'Changes committed and pushed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get recent git log
ipcMain.handle('git-log', async (event, { directory, count }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    const n = count || 20;
    const result = await runGit(
      ['log', `--max-count=${n}`, '--format=%H|%s|%an|%ai'],
      directory
    );
    if (!result.success) return { success: false, error: result.stderr };

    const commits = result.stdout
      .trim()
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((line) => {
        const parts = line.split('|');
        return {
          hash: parts[0] || '',
          message: parts[1] || '',
          author: parts[2] || '',
          date: parts[3] || '',
        };
      });
    return { success: true, commits };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get remote URL
ipcMain.handle('git-remote-get', async (event, { directory }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    const result = await runGit(['remote', 'get-url', 'origin'], directory);
    if (!result.success) return { success: false, url: '' };
    return { success: true, url: result.stdout.trim() };
  } catch (error) {
    return { success: false, url: '' };
  }
});

// Set remote URL
ipcMain.handle('git-remote-set', async (event, { directory, url }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    if (!url) return { success: false, error: 'No URL specified' };

    // Check if remote 'origin' exists
    const checkResult = await runGit(['remote'], directory);
    const remotes = checkResult.success ? checkResult.stdout.trim().split('\n') : [];

    let result;
    if (remotes.includes('origin')) {
      result = await runGit(['remote', 'set-url', 'origin', url], directory);
    } else {
      result = await runGit(['remote', 'add', 'origin', url], directory);
    }
    if (!result.success) return { success: false, error: result.stderr };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fetch from remote (without merging)
ipcMain.handle('git-fetch', async (event, { directory }) => {
  try {
    if (!directory) return { success: false, error: 'No directory specified' };
    const result = await runGit(['fetch', '--all'], directory, 60000);
    if (!result.success) return { success: false, error: result.stderr };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if there are commits available to pull (fetch + compare with upstream)
ipcMain.handle('git-check-pull-available', async (event, { directory }) => {
  try {
    if (!directory || !fs.existsSync(directory)) {
      return { isRepo: false, hasPull: false, count: 0 };
    }

    // Check if it's actually a git repo
    const gitDir = path.join(directory, '.git');
    if (!fs.existsSync(gitDir)) {
      return { isRepo: false, hasPull: false, count: 0 };
    }

    // Check if there is a remote configured
    const remoteResult = await runGit(['remote', 'get-url', 'origin'], directory);
    if (!remoteResult.success || !remoteResult.stdout.trim()) {
      return { isRepo: true, hasPull: false, count: 0, noRemote: true };
    }

    // Fetch from remote (quietly)
    await runGit(['fetch', 'origin'], directory, 60000);

    // Get current branch name
    const branchResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], directory);
    const branch = branchResult.success ? branchResult.stdout.trim() : 'main';

    // Count commits that are on remote but not local (i.e., available to pull)
    const countResult = await runGit(
      ['rev-list', '--count', `HEAD..origin/${branch}`],
      directory
    );

    const count = countResult.success ? (parseInt(countResult.stdout.trim()) || 0) : 0;
    return { isRepo: true, hasPull: count > 0, count };
  } catch (error) {
    return { isRepo: false, hasPull: false, count: 0, error: error.message };
  }
});
