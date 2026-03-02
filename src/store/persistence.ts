import { StateStorage } from 'zustand/middleware';
import { RequestHistoryItem, Collection, Environment, SecretsStorage } from '../types';

// Full storage export interface (legacy / v1 \u2013 kept for backward compatibility)
export interface AppStorageExport {
  version: string;
  exportedAt: string;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history?: RequestHistoryItem[];
}

// Check if running in Electron
export const isElectron =
  typeof window !== 'undefined' && !!(window as any).electronAPI;
// ─────────────────────────────────────────────────────────────────────────────
// Git auto-sync (debounced)
// ─────────────────────────────────────────────────────────────────────────────

let gitSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trigger a debounced git auto-commit+push if the active workspace has
 * gitAutoSync enabled.  Called after every successful write to storage.
 */
function triggerGitAutoSync() {
  if (!isElectron) return;
  try {
    // Dynamically import workspacesStore to avoid circular deps
    // We read the store state lazily
    const { useWorkspacesStore } = require('./workspacesStore');
    const state = useWorkspacesStore.getState();
    const active = state.workspaces.find(
      (w: any) => w.id === state.activeWorkspaceId
    );
    if (!active?.gitAutoSync || !active.homeDirectory) return;

    // Debounce: wait 3 seconds after last write before syncing
    if (gitSyncTimer) clearTimeout(gitSyncTimer);
    gitSyncTimer = setTimeout(async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api?.gitAddCommitPush) return;
        await api.gitAddCommitPush({
          directory: active.homeDirectory,
          message: `Fetchy auto-sync ${new Date().toISOString()}`,
        });
      } catch (e) {
        console.error('Git auto-sync failed:', e);
      }
    }, 3000);
  } catch {
    // workspacesStore not ready yet – ignore
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Secrets helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract secret variable values from state and return:
 *  - `cleanState`:  state with secret .value / .currentValue cleared
 *  - `secretsMap`:  map of "env:{envId}:{varId}" | "col:{colId}:{varId}" \u2192 value
 */
function extractSecrets(stateWrapper: any): {
  cleanState: any;
  secretsMap: Record<string, string>;
} {
  const secretsMap: Record<string, string> = {};
  if (!stateWrapper?.state) return { cleanState: stateWrapper, secretsMap };

  const state = stateWrapper.state;

  // Deep clone via JSON for simplicity
  const cleanStateInner = JSON.parse(JSON.stringify(state));

  // Environments
  if (Array.isArray(cleanStateInner.environments)) {
    for (const env of cleanStateInner.environments) {
      if (Array.isArray(env.variables)) {
        for (const variable of env.variables) {
          if (variable.isSecret) {
            const key = `env:${env.id}:${variable.id}`;
            // Use || (not ??) so empty strings fall through to the next candidate
            secretsMap[key] = variable.currentValue || variable.value || variable.initialValue || '';
            variable.value = '';
            variable.currentValue = '';
            variable.initialValue = '';
          }
        }
      }
    }
  }

  // Collections
  if (Array.isArray(cleanStateInner.collections)) {
    for (const col of cleanStateInner.collections) {
      if (Array.isArray(col.variables)) {
        for (const variable of col.variables) {
          if (variable.isSecret) {
            const key = `col:${col.id}:${variable.id}`;
            // Use || (not ??) so empty strings fall through to the next candidate
            secretsMap[key] = variable.currentValue || variable.value || variable.initialValue || '';
            variable.value = '';
            variable.currentValue = '';
            variable.initialValue = '';
          }
        }
      }
    }
  }

  return {
    cleanState: { ...stateWrapper, state: cleanStateInner },
    secretsMap,
  };
}

/**
 * Strip transient (script-set) environment variable values.
 *
 * - Removes variables created entirely by scripts (`_fromScript` flag)
 * - Clears `currentValue` ONLY on variables where `_scriptOverride` is set
 *   (i.e. the value was set by a pre/post script, not by the user in the UI)
 * - User-set `currentValue` is preserved across restarts
 */
function stripTransientEnvValues(stateWrapper: any): any {
  if (!stateWrapper?.state) return stateWrapper;
  const state = stateWrapper.state;

  if (Array.isArray(state.environments)) {
    for (const env of state.environments) {
      if (!Array.isArray(env.variables)) continue;
      env.variables = env.variables
        .filter((v: any) => {
          // Remove variables created entirely by scripts
          return !v._fromScript;
        })
        .map((v: any) => {
          const { _fromScript, _scriptOverride, ...rest } = v;
          if (_scriptOverride) {
            // Script-set currentValue – clear it so it resets on restart
            const { currentValue, ...clean } = rest;
            return clean;
          }
          // User-set currentValue – keep it
          return rest;
        });
    }
  }

  return stateWrapper;
}

/**
 * Merge secrets back into state loaded from the home directory.
 */
function mergeSecrets(
  stateWrapper: any,
  secretsMap: Record<string, string>
): any {
  if (!stateWrapper?.state) return stateWrapper;

  const state = stateWrapper.state;

  if (Array.isArray(state.environments)) {
    for (const env of state.environments) {
      if (Array.isArray(env.variables)) {
        for (const variable of env.variables) {
          if (variable.isSecret) {
            const key = `env:${env.id}:${variable.id}`;
            if (secretsMap[key] !== undefined) {
              variable.value = secretsMap[key];
              variable.initialValue = secretsMap[key];
              variable.currentValue = secretsMap[key];
            }
          }
        }
      }
    }
  }

  if (Array.isArray(state.collections)) {
    for (const col of state.collections) {
      if (Array.isArray(col.variables)) {
        for (const variable of col.variables) {
          if (variable.isSecret) {
            const key = `col:${col.id}:${variable.id}`;
            if (secretsMap[key] !== undefined) {
              variable.value = secretsMap[key];
              variable.initialValue = secretsMap[key];
              variable.currentValue = secretsMap[key];
            }
          }
        }
      }
    }
  }

  return stateWrapper;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom storage factory
// ─────────────────────────────────────────────────────────────────────────────

export const createCustomStorage = (): StateStorage => {
  if (isElectron) {
    return {
      getItem: async (name: string): Promise<string | null> => {
        try {
          // 1. Read public data from home directory
          const raw = await (window as any).electronAPI.readData(`${name}.json`);
          if (!raw) return null;

          let stateWrapper = JSON.parse(raw);

          // 2. Read secrets from secrets directory
          try {
            const secretsRaw = await (window as any).electronAPI.readSecrets();
            if (secretsRaw) {
              const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
              if (secretsStorage?.secrets) {
                stateWrapper = mergeSecrets(stateWrapper, secretsStorage.secrets);
              }
            }
          } catch {
            // secrets file missing or corrupt \u2013 not fatal
          }
          // 3. Strip transient (script-set) env var values
          stateWrapper = stripTransientEnvValues(stateWrapper);
          return JSON.stringify(stateWrapper);
        } catch (error) {
          console.error('Error reading from file storage:', error);
          return null;
        }
      },

      setItem: async (name: string, value: string): Promise<void> => {
        try {
          const stateWrapper = JSON.parse(value);

          // Trim large response bodies from history to prevent oversized storage
          if (stateWrapper?.state?.history) {
            const MAX_BODY_SIZE = 5_000;
            stateWrapper.state.history = stateWrapper.state.history.map(
              (item: any) => {
                if (item?.response?.body && item.response.body.length > MAX_BODY_SIZE) {
                  return {
                    ...item,
                    response: {
                      ...item.response,
                      body: item.response.body.slice(0, MAX_BODY_SIZE) + '\n... [truncated for storage]',
                    },
                  };
                }
                return item;
              }
            );
          }

          // 1. Strip transient values before writing
          stripTransientEnvValues(stateWrapper);

          // 2. Extract secrets
          const { cleanState, secretsMap } = extractSecrets(stateWrapper);

          // 2. Write public data (no secret values) to home directory
          await (window as any).electronAPI.writeData({
            filename: `${name}.json`,
            content: JSON.stringify(cleanState),
          });

          // 3. Write secrets to secrets directory
          const secretsStorage: SecretsStorage = {
            version: '1.0',
            secrets: secretsMap,
          };
          await (window as any).electronAPI.writeSecrets({
            content: JSON.stringify(secretsStorage, null, 2),
          });

          // 4. Trigger git auto-sync if enabled
          triggerGitAutoSync();
        } catch (error) {
          console.error('Error writing to file storage:', error);
        }
      },

      removeItem: async (name: string): Promise<void> => {
        try {
          await (window as any).electronAPI.writeData({
            filename: `${name}.json`,
            content: '{}',
          });
        } catch (error) {
          console.error('Error removing from file storage:', error);
        }
      },
    };
  }

  // ── Browser / localStorage fallback ────────────────────────────────────────
  return {
    getItem: (name: string): string | null => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      try {
        let stateWrapper = JSON.parse(raw);
        const secretsRaw = localStorage.getItem(`${name}-secrets`);
        if (secretsRaw) {
          const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
          if (secretsStorage?.secrets) {
            stateWrapper = mergeSecrets(stateWrapper, secretsStorage.secrets);
          }
        }
        // Strip transient (script-set) env var values
        stateWrapper = stripTransientEnvValues(stateWrapper);
        return JSON.stringify(stateWrapper);
      } catch {
        return raw;
      }
    },

    setItem: (name: string, value: string): void => {
      try {
        const stateWrapper = JSON.parse(value);

        // Trim large response bodies from history to prevent quota overflow
        if (stateWrapper?.state?.history) {
          const MAX_BODY_SIZE = 5_000;
          stateWrapper.state.history = stateWrapper.state.history.map(
            (item: any) => {
              if (item?.response?.body && item.response.body.length > MAX_BODY_SIZE) {
                return {
                  ...item,
                  response: {
                    ...item.response,
                    body: item.response.body.slice(0, MAX_BODY_SIZE) + '\n... [truncated for storage]',
                  },
                };
              }
              return item;
            }
          );
        }

        // Strip transient values before writing
        stripTransientEnvValues(stateWrapper);

        const { cleanState, secretsMap } = extractSecrets(stateWrapper);
        localStorage.setItem(name, JSON.stringify(cleanState));
        const secretsStorage: SecretsStorage = { version: '1.0', secrets: secretsMap };
        localStorage.setItem(`${name}-secrets`, JSON.stringify(secretsStorage));
      } catch (error) {
        console.error('Error persisting to localStorage:', error);
      }
    },

    removeItem: (name: string): void => {
      localStorage.removeItem(name);
      localStorage.removeItem(`${name}-secrets`);
    },
  };
};
