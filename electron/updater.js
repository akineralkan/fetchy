const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Auto-updater module for Fetchy.
 *
 * Uses electron-updater with GitHub Releases as the update source.
 * The main window is used to send status events to the renderer process.
 *
 * Events sent to renderer (channel: 'updater-event'):
 *   { event: 'checking' }
 *   { event: 'available',    info }
 *   { event: 'not-available', info }
 *   { event: 'downloading',  progress }   // progress.percent, progress.bytesPerSecond, etc.
 *   { event: 'downloaded',   info }
 *   { event: 'error',        error }
 */

let win = null;
let lastUpdateInfo = null; // cache info from update-downloaded so we can persist it

function sendToRenderer(data) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater-event', data);
  }
}

/**
 * Path to a small JSON file in userData that stores update info
 * so the next launch can display the "what's new" banner.
 */
function getPostUpdateFilePath() {
  return path.join(app.getPath('userData'), 'post-update.json');
}

function savePostUpdateInfo(info) {
  try {
    const data = {
      version: info?.version ?? null,
      releaseName: info?.releaseName ?? null,
      releaseNotes: info?.releaseNotes ?? null,
      releaseDate: info?.releaseDate ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(getPostUpdateFilePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save post-update info:', e);
  }
}

// ─── Configure autoUpdater ─────────────────────────────────────────────────────

autoUpdater.autoDownload = false;       // Don't download automatically – let the user decide
autoUpdater.autoInstallOnAppQuit = true; // Install silently when the user quits

// ─── autoUpdater events ────────────────────────────────────────────────────────

autoUpdater.on('checking-for-update', () => {
  sendToRenderer({ event: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  sendToRenderer({ event: 'available', info });
});

autoUpdater.on('update-not-available', (info) => {
  sendToRenderer({ event: 'not-available', info });
});

autoUpdater.on('download-progress', (progress) => {
  sendToRenderer({
    event: 'downloading',
    progress: {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    },
  });
});

autoUpdater.on('update-downloaded', (info) => {
  lastUpdateInfo = info;
  sendToRenderer({ event: 'downloaded', info });
});

autoUpdater.on('error', (err) => {
  sendToRenderer({ event: 'error', error: err?.message || String(err) });
});

// ─── IPC handlers (renderer → main) ───────────────────────────────────────────

ipcMain.handle('updater-check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('updater-download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('updater-install', () => {
  // Persist update info so we can show the banner after restart
  if (lastUpdateInfo) {
    savePostUpdateInfo(lastUpdateInfo);
  }
  // Quit the app and install the update silently (no NSIS installer window)
  // isSilent = true  → no installer UI shown
  // isForceRunAfter = true → relaunch the app after install finishes
  autoUpdater.quitAndInstall(true, true);
});

ipcMain.handle('get-post-update-info', () => {
  try {
    const filePath = getPostUpdateFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data;
    }
  } catch (e) {
    console.error('Failed to read post-update info:', e);
  }
  return null;
});

ipcMain.handle('clear-post-update-info', () => {
  try {
    const filePath = getPostUpdateFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (e) {
    console.error('Failed to clear post-update info:', e);
    return false;
  }
});

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the updater with the main BrowserWindow.
 * Optionally performs a silent check right after launch.
 */
function initUpdater(mainWindow, { silentCheck = true } = {}) {
  win = mainWindow;

  if (silentCheck) {
    // Wait a few seconds after launch so the UI has time to settle
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => { /* silent – don't bother user */ });
    }, 5000);
  }
}

module.exports = { initUpdater };
