const { app, BrowserWindow, ipcMain, dialog, Menu, screen, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initUpdater } = require('./updater');

// IPC handler modules (decomposed from this file – #13)
const { fileHandlers, secretsHandler, httpHandler, aiHandler, workspaceHandler, jiraHandler } = require('./ipc');

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
    // Use recursive: true to watch subdirectories (collections/, environments/, etc.)
    storageWatcher = fs.watch(directory, { persistent: false, recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      // Ignore changes in .secrets directory
      if (filename.startsWith('.secrets') || filename.startsWith('.secrets/') || filename.startsWith('.secrets\\')) return;
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

// ─── WINDOW STATE ────────────────────────────────────────────────────────────

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const statePath = getWindowStatePath();
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading window state:', e);
  }
  return null;
}

function saveWindowState(win) {
  try {
    if (!win || win.isMinimized() || win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    // getNormalBounds returns the pre-maximise/minimise bounds so the window
    // restores to the right size on the right screen even if currently maximised.
    const bounds = win.getNormalBounds();
    const state = {
      isMaximized,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    safeWriteFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving window state:', e);
  }
}

function isWindowStateValid(state) {
  if (typeof state.x !== 'number' || typeof state.y !== 'number') return false;
  // Require at least 100x50 pixels of the title bar area to be visible on
  // one of the currently connected displays so the user can always reach it.
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      state.x + (state.width || 0) - 100 >= x &&
      state.x + 100 <= x + width &&
      state.y >= y &&
      state.y + 50 <= y + height
    );
  });
}

// ─── WINDOW ──────────────────────────────────────────────────────────────────

function createWindow() {
  initializeWorkspace();

  const savedState = loadWindowState();
  const validSaved = savedState && isWindowStateValid(savedState);
  const windowBounds = validSaved
    ? { x: savedState.x, y: savedState.y, width: savedState.width, height: savedState.height }
    : { width: 1400, height: 900 };

  mainWindow = new BrowserWindow({
    ...windowBounds,
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

  if (validSaved && savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Persist window state whenever the user moves or resizes the window.
  let saveStateTimer = null;
  const scheduleSaveState = () => {
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => saveWindowState(mainWindow), 500);
  };
  mainWindow.on('move', scheduleSaveState);
  mainWindow.on('resize', scheduleSaveState);
  mainWindow.on('maximize', () => saveWindowState(mainWindow));
  mainWindow.on('unmaximize', () => saveWindowState(mainWindow));

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Initialise auto-updater (silent background check after launch)
  initUpdater(mainWindow, { silentCheck: app.isPackaged });

  mainWindow.on('close', () => {
    // Save final state synchronously before the window is destroyed.
    clearTimeout(saveStateTimer);
    saveWindowState(mainWindow);
  });

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
app.whenReady().then(() => {
  // ─── Content-Security-Policy (#9) ─────────────────────────────────────────
  // Strict CSP applied to all renderer responses.  `blob:` is required for
  // Web Worker scripts (sandboxed script execution).  `'unsafe-inline'` is
  // required for style tags injected by Tailwind / Vite HMR in dev mode.
  // `connect-src *` allows the renderer to talk to arbitrary API endpoints
  // through the proxy/fetch layer.
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src *",
      "worker-src 'self' blob:",
    ].join('; ');
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ─── IPC HANDLER REGISTRATION ─────────────────────────────────────────────────

// Shared dependency object for IPC modules
const ipcDeps = {
  getMainWindow: () => mainWindow,
  getEffectiveDataDirectory,
  getEffectiveSecretsDirectory,
  getCustomHomeDirectory: () => customHomeDirectory,
  setCustomHomeDirectory: (dir) => { customHomeDirectory = dir; },
  setCustomSecretsDirectory: (dir) => { customSecretsDirectory = dir; },
  getLastWriteTimestamp: () => lastWriteTimestamp,
  setLastWriteTimestamp: (ts) => { lastWriteTimestamp = ts; },
  safeWriteFileSync,
  loadPreferences,
  savePreferences,
  loadWorkspacesConfig,
  saveWorkspacesConfig,
  readEncryptedSecrets: (dir, name) =>
    secretsHandler.readEncryptedSecrets(dir, name, { safeStorage, safeWriteFileSync }),
  writeEncryptedSecrets: (dir, name, content) =>
    secretsHandler.writeEncryptedSecrets(dir, name, content, { safeStorage, safeWriteFileSync }),
  startStorageWatcher,
  stopStorageWatcher,
  dialog,
  safeStorage,
  getAppPath: (name) => app.getPath(name),
};

fileHandlers.register(ipcMain, ipcDeps);
secretsHandler.register(ipcMain, ipcDeps);
httpHandler.register(ipcMain, ipcDeps);
aiHandler.register(ipcMain, ipcDeps);
workspaceHandler.register(ipcMain, ipcDeps);
jiraHandler.register(ipcMain, ipcDeps);

// Open URL in the system's default browser
ipcMain.handle('open-external-url', async (_event, url) => {
  if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    return { success: false, error: 'Invalid URL' };
  }
  await shell.openExternal(url);
  return { success: true };
});
