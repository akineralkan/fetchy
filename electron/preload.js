const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: (options) => ipcRenderer.invoke('open-file', options),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  readData: (filename) => ipcRenderer.invoke('read-data', filename),
  writeData: (data) => ipcRenderer.invoke('write-data', data),
  listDataDir: (subDir) => ipcRenderer.invoke('list-data-dir', subDir),
  deleteDataFile: (filename) => ipcRenderer.invoke('delete-data-file', filename),

  // Secrets storage (stored in secrets directory)
  readSecrets: () => ipcRenderer.invoke('read-secrets'),
  writeSecrets: (data) => ipcRenderer.invoke('write-secrets', data),

  // AI Secrets storage (separate from variable secrets)
  readAISecrets: () => ipcRenderer.invoke('read-ai-secrets'),
  writeAISecrets: (data) => ipcRenderer.invoke('write-ai-secrets', data),
  deleteAISecrets: () => ipcRenderer.invoke('delete-ai-secrets'),

  // Preferences
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),

  // Legacy home directory (kept for backward compat)
  selectHomeDirectory: () => ipcRenderer.invoke('select-home-directory'),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  migrateData: (data) => ipcRenderer.invoke('migrate-data', data),

  // Workspace management
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  saveWorkspaces: (config) => ipcRenderer.invoke('save-workspaces', config),
  selectDirectory: (opts) => ipcRenderer.invoke('select-directory', opts),
  exportWorkspaceToJson: (data) => ipcRenderer.invoke('export-workspace-to-json', data),
  importWorkspaceFromJson: (data) => ipcRenderer.invoke('import-workspace-from-json', data),

  // HTTP request (bypasses CORS)
  httpRequest: (data) => ipcRenderer.invoke('http-request', data),

  // AI request (provider-agnostic, routed in main process)
  aiRequest: (data) => ipcRenderer.invoke('ai-request', data),

  // Git operations (uses system git)
  gitCheck: () => ipcRenderer.invoke('git-check'),
  gitStatus: (data) => ipcRenderer.invoke('git-status', data),
  gitInit: (data) => ipcRenderer.invoke('git-init', data),
  gitClone: (data) => ipcRenderer.invoke('git-clone', data),
  gitPull: (data) => ipcRenderer.invoke('git-pull', data),
  gitPush: (data) => ipcRenderer.invoke('git-push', data),
  gitAddCommit: (data) => ipcRenderer.invoke('git-add-commit', data),
  gitAddCommitPush: (data) => ipcRenderer.invoke('git-add-commit-push', data),
  gitLog: (data) => ipcRenderer.invoke('git-log', data),
  gitRemoteGet: (data) => ipcRenderer.invoke('git-remote-get', data),
  gitRemoteSet: (data) => ipcRenderer.invoke('git-remote-set', data),
  gitFetch: (data) => ipcRenderer.invoke('git-fetch', data),
  gitCheckPullAvailable: (data) => ipcRenderer.invoke('git-check-pull-available', data),
  gitMergeConflicts: (data) => ipcRenderer.invoke('git-merge-conflicts', data),
  gitIsMerging: (data) => ipcRenderer.invoke('git-is-merging', data),
  gitShowConflictVersion: (data) => ipcRenderer.invoke('git-show-conflict-version', data),
  gitResolveConflict: (data) => ipcRenderer.invoke('git-resolve-conflict', data),
  gitResolveAllConflicts: (data) => ipcRenderer.invoke('git-resolve-all-conflicts', data),
  gitMergeAbort: (data) => ipcRenderer.invoke('git-merge-abort', data),
  gitReadFileContent: (data) => ipcRenderer.invoke('git-read-file-content', data),
  gitShowBaseVersion: (data) => ipcRenderer.invoke('git-show-base-version', data),
  gitWriteResolvedContent: (data) => ipcRenderer.invoke('git-write-resolved-content', data),

  // Storage file change events (fired when file changes externally, e.g. after git pull)
  onStorageFileChanged: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('storage-file-changed', listener);
    return listener; // return so caller can remove it
  },
  offStorageFileChanged: (listener) => ipcRenderer.removeListener('storage-file-changed', listener),

  // Auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater-check'),
  updaterDownload: () => ipcRenderer.invoke('updater-download'),
  updaterInstall: () => ipcRenderer.invoke('updater-install'),
  onUpdaterEvent: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('updater-event', listener);
    return listener;
  },
  offUpdaterEvent: (listener) => ipcRenderer.removeListener('updater-event', listener),

  // Post-update info (shown after restart)
  getPostUpdateInfo: () => ipcRenderer.invoke('get-post-update-info'),
  clearPostUpdateInfo: () => ipcRenderer.invoke('clear-post-update-info'),
});
