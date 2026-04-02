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

  // Jira Secrets storage (PAT only)
  readJiraSecrets: () => ipcRenderer.invoke('read-jira-secrets'),
  writeJiraSecrets: (data) => ipcRenderer.invoke('write-jira-secrets', data),
  deleteJiraSecrets: () => ipcRenderer.invoke('delete-jira-secrets'),

  // Jira issue creation
  jiraCreateIssue: (data) => ipcRenderer.invoke('jira-create-issue', data),
  jiraTestConnection: (data) => ipcRenderer.invoke('jira-test-connection', data),
  jiraGetCreateMeta: (data) => ipcRenderer.invoke('jira-get-create-meta', data),
  jiraSearchInsightObjects: (data) => ipcRenderer.invoke('jira-search-insight-objects', data),

  // Open URL in system browser
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),

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
  abortHttpRequest: (requestId) => ipcRenderer.invoke('abort-http-request', requestId),

  // AI request (provider-agnostic, routed in main process)
  aiRequest: (data) => ipcRenderer.invoke('ai-request', data),

  // Storage file change events (fired when file changes externally)
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
