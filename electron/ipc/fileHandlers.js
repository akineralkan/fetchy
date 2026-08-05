/**
 * IPC handlers for file operations.
 * Handles: open-file, save-file, get-data-path, read-data, write-data,
 *          list-data-dir, delete-data-file
 *
 * @module electron/ipc/fileHandlers
 */
'use strict';

const fs = require('fs');
const path = require('path');

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
  const base = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (!resolved.startsWith(base) && resolved !== baseDir) {
    throw new Error(`Path traversal blocked: ${filename}`);
  }
  return resolved;
}

/**
 * Register file-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} deps
 * @param {function} deps.getMainWindow   - Returns the BrowserWindow instance
 * @param {function} deps.getEffectiveDataDirectory
 * @param {function} deps.safeWriteFileSync
 * @param {function} deps.getLastWriteTimestamp
 * @param {function} deps.setLastWriteTimestamp
 * @param {Electron.Dialog} deps.dialog
 */
function register(ipcMain, deps) {
  const {
    getMainWindow,
    getEffectiveDataDirectory,
    safeWriteFileSync,
    getLastWriteTimestamp,
    setLastWriteTimestamp,
    setWriteInProgress,
    dialog,
  } = deps;

  ipcMain.handle('open-file', async (event, options) => {
    const mainWindow = getMainWindow();
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

  ipcMain.handle('save-file', async (event, { content, defaultPath, defaultName, filters, binary }) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || defaultName,
      filters: filters || [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      if (binary && Array.isArray(content)) {
        // Binary mode (#23): content is a number[] (Uint8Array serialised via IPC)
        fs.writeFileSync(result.filePath, Buffer.from(content));
      } else {
        fs.writeFileSync(result.filePath, content, 'utf-8');
      }
      return result.filePath;
    }
    return null;
  });

  ipcMain.handle('get-data-path', () => {
    const dataPath = getEffectiveDataDirectory();
    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
    return dataPath;
  });

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
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      setLastWriteTimestamp(Date.now());
      safeWriteFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing data:', error);
      return false;
    }
  });

  ipcMain.handle('list-data-dir', async (event, subDir) => {
    try {
      const baseDir = getEffectiveDataDirectory();
      const targetDir = safePath(baseDir, subDir);
      if (!fs.existsSync(targetDir)) return [];
      return fs.readdirSync(targetDir).filter(f => f.endsWith('.json'));
    } catch (error) {
      console.error('Error listing data dir:', error);
      return [];
    }
  });

  ipcMain.handle('delete-data-file', async (event, filename) => {
    try {
      const dataDir = getEffectiveDataDirectory();
      const filePath = safePath(dataDir, filename);
      setLastWriteTimestamp(Date.now());
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting data file:', error);
      return false;
    }
  });

  ipcMain.handle('set-write-in-progress', (event, value) => {
    if (typeof setWriteInProgress === 'function') setWriteInProgress(!!value);
    return true;
  });
}

module.exports = { register, safePath };
