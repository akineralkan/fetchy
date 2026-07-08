const { autoUpdater } = require('electron-updater');
const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

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
let latestCheckInfo = null; // cache info from update-available (needed on mac to build the DMG URL)
let downloadedMacDmgPath = null; // path to the manually-downloaded DMG on macOS

const isMac = process.platform === 'darwin';

/**
 * macOS auto-update caveat
 * ------------------------
 * electron-updater's Mac auto-installer (Squirrel.Mac/ShipIt) validates the
 * downloaded app's code signature against the *currently running* app's
 * designated requirement. Fetchy is only ad-hoc signed (no paid Apple
 * Developer ID), and ad-hoc signatures produce a requirement based on the
 * exact binary hash (cdhash) of that one build — so it can never match a
 * different build. That makes the native silent-install path fail with:
 *   "Code signature ... did not pass validation: code failed to satisfy
 *   specified code requirement(s)"
 * every single time, regardless of version.
 *
 * Until Fetchy is signed with a real Developer ID (and ideally notarized),
 * macOS uses a manual fallback instead: download the DMG directly from the
 * GitHub release and open it in Finder, so the user drags the app into
 * Applications themselves — the same way a first-time install works.
 */
function getMacDmgUrl(version) {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `https://github.com/AkinerAlkan94/fetchy/releases/download/v${version}/Fetchy-${version}-${arch}.dmg`;
}

/**
 * Downloads a file over HTTPS, following redirects (GitHub release assets
 * redirect to a signed S3/CDN URL), and reports progress along the way.
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading the update'));
        return;
      }
      https
        .get(currentUrl, { headers: { 'User-Agent': 'Fetchy-Updater' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            request(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`Failed to download update (HTTP ${res.statusCode})`));
            return;
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let transferred = 0;
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            transferred += chunk.length;
            if (onProgress) {
              const elapsed = (Date.now() - startTime) / 1000;
              onProgress({
                percent: total ? (transferred / total) * 100 : 0,
                transferred,
                total,
                bytesPerSecond: elapsed > 0 ? Math.round(transferred / elapsed) : 0,
              });
            }
          });

          res.pipe(fileStream);
          fileStream.on('finish', () => fileStream.close(() => resolve(destPath)));
          fileStream.on('error', reject);
          res.on('error', reject);
        })
        .on('error', reject);
    };

    request(url);
  });
}

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

function savePostUpdateInfo(info, previousVersion) {
  try {
    const data = {
      previousVersion: previousVersion ?? null,
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
  latestCheckInfo = info;
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
  if (isMac) {
    // See the macOS auto-update caveat note above — Squirrel.Mac's silent
    // install always fails for ad-hoc signed builds, so we download the DMG
    // ourselves instead of going through autoUpdater.downloadUpdate() (which
    // would fetch the zip and hand off to the native updater).
    try {
      if (!latestCheckInfo?.version) {
        throw new Error('No update information available — please check for updates again.');
      }
      const version = latestCheckInfo.version;
      const destPath = path.join(app.getPath('temp'), `Fetchy-${version}-${process.arch}.dmg`);
      await downloadFile(getMacDmgUrl(version), destPath, (progress) => {
        sendToRenderer({ event: 'downloading', progress });
      });
      downloadedMacDmgPath = destPath;
      sendToRenderer({ event: 'downloaded', info: latestCheckInfo });
      return { success: true };
    } catch (err) {
      const message = err?.message || String(err);
      // Fall back to the releases page so the user always has a manual path
      try { shell.openExternal('https://github.com/AkinerAlkan94/fetchy/releases/latest'); } catch { /* ignore */ }
      sendToRenderer({ event: 'error', error: `${message} Opening the releases page so you can download it manually.` });
      return { success: false, error: message };
    }
  }

  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('updater-install', async () => {
  if (isMac) {
    // Manual install path: open the downloaded DMG so Finder shows the
    // drag-to-Applications window (electron-builder DMGs ship with this
    // layout by default), then quit so the app bundle isn't locked while
    // the user replaces it.
    if (!downloadedMacDmgPath || !fs.existsSync(downloadedMacDmgPath)) {
      return { success: false, error: 'Installer file not found — please download the update again.' };
    }
    if (latestCheckInfo) {
      savePostUpdateInfo(latestCheckInfo, app.getVersion());
    }
    const openError = await shell.openPath(downloadedMacDmgPath);
    if (openError) {
      return { success: false, error: `Could not open the installer: ${openError}` };
    }
    setTimeout(() => app.quit(), 1200);
    return { success: true };
  }

  // Persist update info so we can show the banner after restart
  if (lastUpdateInfo) {
    // Capture the version before quitting so the banner can show cumulative changes
    savePostUpdateInfo(lastUpdateInfo, app.getVersion());
  }
  // Quit the app and install the update silently (no NSIS installer window)
  // isSilent = true  → no installer UI shown
  // isForceRunAfter = true → relaunch the app after install finishes
  autoUpdater.quitAndInstall(true, true);
  return { success: true };
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
