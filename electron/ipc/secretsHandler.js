/**
 * IPC handlers for secrets management.
 * Handles: read-secrets, write-secrets, read-ai-secrets, write-ai-secrets,
 *          delete-ai-secrets
 *
 * @module electron/ipc/secretsHandler
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { requireString } = require('./validate');

// Maximum secrets content size: 1 MB
const MAX_SECRETS_SIZE = 1_000_000;

/**
 * Read a secrets file, decrypting if necessary.
 * Handles migration from plaintext .json to encrypted .enc transparently.
 */
function readEncryptedSecrets(secretsDir, baseName, { safeStorage, safeWriteFileSync }) {
  const encPath = path.join(secretsDir, baseName + '.enc');
  const jsonPath = path.join(secretsDir, baseName + '.json');

  // Prefer encrypted file
  if (fs.existsSync(encPath)) {
    if (safeStorage.isEncryptionAvailable()) {
      const encBuffer = fs.readFileSync(encPath);
      return safeStorage.decryptString(encBuffer);
    }
    // Encryption not available (e.g. missing keychain) — can't read
    console.warn(`safeStorage unavailable; cannot decrypt ${encPath}`);
    return null;
  }

  // Fallback: plaintext file exists — migrate to encrypted
  if (fs.existsSync(jsonPath)) {
    const plaintext = fs.readFileSync(jsonPath, 'utf-8');
    // Attempt to migrate
    if (safeStorage.isEncryptionAvailable()) {
      try {
        if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
        const encrypted = safeStorage.encryptString(plaintext);
        fs.writeFileSync(encPath, encrypted);
        // Remove old plaintext file after successful encryption
        fs.unlinkSync(jsonPath);
        console.log(`Migrated ${baseName}.json to encrypted storage.`);
      } catch (e) {
        console.error(`Failed to migrate ${baseName} to encrypted storage:`, e);
      }
    }
    return plaintext;
  }

  return null;
}

/**
 * Write a secrets file with encryption.
 * Falls back to plaintext if safeStorage is unavailable.
 */
function writeEncryptedSecrets(secretsDir, baseName, content, { safeStorage, safeWriteFileSync }) {
  if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(content);
    const encPath = path.join(secretsDir, baseName + '.enc');
    // Write atomically: write to tmp then rename
    const tmpPath = encPath + '.tmp';
    fs.writeFileSync(tmpPath, encrypted);
    fs.renameSync(tmpPath, encPath);
    // Remove old plaintext file if it exists
    const jsonPath = path.join(secretsDir, baseName + '.json');
    if (fs.existsSync(jsonPath)) {
      try { fs.unlinkSync(jsonPath); } catch { /* ignore */ }
    }
  } else {
    // Fallback to plaintext (same as before)
    safeWriteFileSync(path.join(secretsDir, baseName + '.json'), content, 'utf-8');
  }
}

/**
 * Register secrets-related IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {object} deps
 * @param {function} deps.getEffectiveSecretsDirectory
 * @param {Electron.SafeStorage} deps.safeStorage
 * @param {function} deps.safeWriteFileSync
 */
function register(ipcMain, deps) {
  const { getEffectiveSecretsDirectory, safeStorage, safeWriteFileSync } = deps;
  const cryptoDeps = { safeStorage, safeWriteFileSync };

  ipcMain.handle('read-secrets', async () => {
    try {
      const secretsDir = getEffectiveSecretsDirectory();
      return readEncryptedSecrets(secretsDir, 'fetchy-secrets', cryptoDeps);
    } catch (error) {
      console.error('Error reading secrets:', error);
      return null;
    }
  });

  ipcMain.handle('write-secrets', async (event, data) => {
    try {
      const content = requireString(data?.content, 'content', MAX_SECRETS_SIZE);
      const secretsDir = getEffectiveSecretsDirectory();
      writeEncryptedSecrets(secretsDir, 'fetchy-secrets', content, cryptoDeps);
      return true;
    } catch (error) {
      console.error('Error writing secrets:', error);
      return false;
    }
  });

  ipcMain.handle('read-ai-secrets', async () => {
    try {
      const secretsDir = getEffectiveSecretsDirectory();
      return readEncryptedSecrets(secretsDir, 'ai-secrets', cryptoDeps);
    } catch (error) {
      console.error('Error reading AI secrets:', error);
      return null;
    }
  });

  ipcMain.handle('write-ai-secrets', async (event, data) => {
    try {
      const content = requireString(data?.content, 'content', MAX_SECRETS_SIZE);
      const secretsDir = getEffectiveSecretsDirectory();
      writeEncryptedSecrets(secretsDir, 'ai-secrets', content, cryptoDeps);
      return true;
    } catch (error) {
      console.error('Error writing AI secrets:', error);
      return false;
    }
  });

  ipcMain.handle('delete-ai-secrets', async () => {
    try {
      const secretsDir = getEffectiveSecretsDirectory();
      // Remove both encrypted and plaintext variants
      const encPath = path.join(secretsDir, 'ai-secrets.enc');
      const jsonPath = path.join(secretsDir, 'ai-secrets.json');
      if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      return true;
    } catch (error) {
      console.error('Error deleting AI secrets:', error);
      return false;
    }
  });

  // ─── Jira Secrets ────────────────────────────────────────────────────────

  ipcMain.handle('read-jira-secrets', async () => {
    try {
      const secretsDir = getEffectiveSecretsDirectory();
      return readEncryptedSecrets(secretsDir, 'jira-secrets', cryptoDeps);
    } catch (error) {
      console.error('Error reading Jira secrets:', error);
      return null;
    }
  });

  ipcMain.handle('write-jira-secrets', async (event, data) => {
    try {
      const content = requireString(data?.content, 'content', MAX_SECRETS_SIZE);
      const secretsDir = getEffectiveSecretsDirectory();
      writeEncryptedSecrets(secretsDir, 'jira-secrets', content, cryptoDeps);
      return true;
    } catch (error) {
      console.error('Error writing Jira secrets:', error);
      return false;
    }
  });

  ipcMain.handle('delete-jira-secrets', async () => {
    try {
      const secretsDir = getEffectiveSecretsDirectory();
      const encPath = path.join(secretsDir, 'jira-secrets.enc');
      const jsonPath = path.join(secretsDir, 'jira-secrets.json');
      if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      return true;
    } catch (error) {
      console.error('Error deleting Jira secrets:', error);
      return false;
    }
  });
}

module.exports = { register, readEncryptedSecrets, writeEncryptedSecrets };
