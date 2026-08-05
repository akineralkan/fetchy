import { StateStorage } from 'zustand/middleware';
import { RequestHistoryItem, Collection, Environment, SecretsStorage } from '../types';
import { migrateState } from './dataMigration';

// ---------------------------------------------------------------------------
// Debounced persistence (#7)
// ---------------------------------------------------------------------------
// Wraps a StateStorage so that `setItem` calls are debounced — at most one
// write occurs per DEBOUNCE_MS window.  This prevents every keystroke from
// serialising the entire state to disk.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 1_500;

// ---------------------------------------------------------------------------
// Write suppression (#workspace-safety)
// ---------------------------------------------------------------------------
// During workspace creation / switching the active workspace directory changes
// on the main process BEFORE the renderer has rehydrated from the new
// directory.  Any debounced write that fires in between would flush the old
// (or empty-default) state to the *new* directory, deleting existing data.
//
// `suppressPersistence(true)` blocks all debounced writes.  It is set before
// the IPC call that switches directories and cleared in rehydrateWorkspace()
// after the correct state has been loaded.
// ---------------------------------------------------------------------------

let _skipPersistence = false;
let _suppressTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Enable or disable persistence write suppression.
 * While suppressed, debounced writes are silently dropped.
 */
export function suppressPersistence(skip: boolean) {
  _skipPersistence = skip;
  if (_suppressTimeout) {
    clearTimeout(_suppressTimeout);
    _suppressTimeout = null;
  }
  if (skip) {
    // Safety net: auto-clear after 15 s if rehydrateWorkspace never completes
    _suppressTimeout = setTimeout(() => {
      _skipPersistence = false;
      _suppressTimeout = null;
    }, 15_000);
  }
}

let _cancelPendingDebounce: (() => void) | null = null;

/**
 * Cancel any pending debounced persistence write.
 * Called before switching the active workspace directory so that a queued
 * write from the previous workspace cannot land in the new directory.
 */
export function cancelPendingPersistence() {
  _cancelPendingDebounce?.();
}

export function createDebouncedStorage(inner: StateStorage): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestValue: string | null = null;
  let latestName: string | null = null;

  _cancelPendingDebounce = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    latestValue = null;
    latestName = null;
  };

  return {
    getItem: (name: string) => inner.getItem(name),

    setItem: (name: string, value: string) => {
      // Block writes while workspace is being created / switched
      if (_skipPersistence) return;

      latestName = name;
      latestValue = value;

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Re-check: flag may have been set while the timer was pending
        if (_skipPersistence) {
          timer = null;
          latestValue = null;
          latestName = null;
          return;
        }
        if (latestName !== null && latestValue !== null) {
          inner.setItem(latestName, latestValue);
        }
        timer = null;
        latestValue = null;
        latestName = null;
      }, DEBOUNCE_MS);
    },

    removeItem: (name: string) => inner.removeItem(name),
  };
}

// Full storage export interface (legacy / v1 - kept for backward compatibility)
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

// ---------------------------------------------------------------------------
// Active workspace ID callback (browser-mode storage isolation)
// ---------------------------------------------------------------------------
// In browser mode we use localStorage.  Without workspace-scoping every
// workspace would share the same "fetchy-storage" key.  workspacesStore
// registers a provider here so we can suffix the key with the active
// workspace ID, giving each workspace its own isolated localStorage slot.
// ---------------------------------------------------------------------------

type ActiveWorkspaceIdProvider = () => string | null;
let _activeWorkspaceIdProvider: ActiveWorkspaceIdProvider | null = null;

/**
 * Register a callback that returns the currently-active workspace ID.
 * Called by workspacesStore at module init time (same pattern as git sync).
 */
export function registerActiveWorkspaceIdProvider(provider: ActiveWorkspaceIdProvider) {
  _activeWorkspaceIdProvider = provider;
}

/** Returns the browser localStorage key scoped to the active workspace. */
function getBrowserStorageKey(baseName: string): string {
  const wsId = _activeWorkspaceIdProvider?.();
  return wsId ? `${baseName}:${wsId}` : baseName;
}

// ---------------------------------------------------------------------------
// Secrets helpers
// ---------------------------------------------------------------------------

/**
 * Extract secret variable values from state and return:
 *  - cleanState:  state with secret .value / .currentValue cleared
 *  - secretsMap:  map of "env:{envId}:{varId}" | "col:{colId}:{varId}" -> value
 */
function extractSecrets(stateWrapper: any): {
  cleanState: any;
  secretsMap: Record<string, string>;
} {
  const secretsMap: Record<string, string> = {};
  if (!stateWrapper?.state) return { cleanState: stateWrapper, secretsMap };

  const state = stateWrapper.state;
  const cleanStateInner = JSON.parse(JSON.stringify(state));

  // Environments
  if (Array.isArray(cleanStateInner.environments)) {
    for (const env of cleanStateInner.environments) {
      if (Array.isArray(env.variables)) {
        for (const variable of env.variables) {
          if (variable.isSecret) {
            const key = `env:${env.id}:${variable.id}`;
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
 */
function stripTransientEnvValues(stateWrapper: any): any {
  if (!stateWrapper?.state) return stateWrapper;
  const state = stateWrapper.state;

  if (Array.isArray(state.environments)) {
    for (const env of state.environments) {
      if (!Array.isArray(env.variables)) continue;
      env.variables = env.variables
        .filter((v: any) => !v._fromScript)
        .map((v: any) => {
          const { _fromScript, _scriptOverride, ...rest } = v;
          if (_scriptOverride) {
            const { currentValue: _cv, ...clean } = rest;
            return clean;
          }
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

// ---------------------------------------------------------------------------
// Write-content cache to avoid unnecessary disk I/O
// ---------------------------------------------------------------------------
const writeContentCache: Record<string, string> = {};

async function writeIfChanged(api: any, filename: string, content: string) {
  if (writeContentCache[filename] === content) return;
  writeContentCache[filename] = content;
  await api.writeData({ filename, content });
}

/**
 * Invalidate the write-content cache so the next write is always applied.
 * Called after operations like git pull where files changed externally.
 */
export function invalidateWriteCache() {
  for (const key of Object.keys(writeContentCache)) {
    delete writeContentCache[key];
  }
}

// ---------------------------------------------------------------------------
// Shared prepare / hydrate pipeline (#27)
// ---------------------------------------------------------------------------
// Both the Electron split-file adapter and the browser localStorage adapter
// perform the same sequence of pre-write and post-read transformations:
//   Write: truncateHistoryBodies → stripTransient → extractSecrets
//   Read:  mergeSecrets → stripTransient
// Rather than duplicating this in every adapter, we expose two composable
// pipeline functions that every adapter calls before doing I/O.
// ---------------------------------------------------------------------------

const MAX_HISTORY_BODY_SIZE = 5_000;

/**
 * Prepare a state wrapper for persistence.
 *
 * Steps (applied in order):
 *   1. Trim large response bodies in history.
 *   2. Strip transient (script-set) env variable values.
 *   3. Extract secret values into a separate map.
 *
 * Returns the cleaned state wrapper and the extracted secrets map.
 */
export function prepareForWrite(stateWrapper: any): {
  cleanState: any;
  secretsMap: Record<string, string>;
} {
  // 1. Trim large history bodies
  if (stateWrapper?.state?.history) {
    stateWrapper.state.history = stateWrapper.state.history.map(
      (item: any) => {
        if (item?.response?.body && item.response.body.length > MAX_HISTORY_BODY_SIZE) {
          return {
            ...item,
            response: {
              ...item.response,
              body: item.response.body.slice(0, MAX_HISTORY_BODY_SIZE) + '\n... [truncated for storage]',
            },
          };
        }
        return item;
      }
    );
  }

  // 2. Strip transient env values
  stripTransientEnvValues(stateWrapper);

  // 3. Extract secrets
  return extractSecrets(stateWrapper);
}

/**
 * Hydrate a state wrapper loaded from storage.
 *
 * Steps (applied in order):
 *   1. Merge secret values back into the state.
 *   2. Strip transient (script-set) env variable values.
 *
 * Returns the hydrated state wrapper.
 */
export function hydrateAfterRead(stateWrapper: any, secretsMap: Record<string, string>): any {
  // 1. Merge secrets
  const merged = mergeSecrets(stateWrapper, secretsMap);
  // 2. Strip transient env values
  return stripTransientEnvValues(merged);
}

// ---------------------------------------------------------------------------
// Migration: single-file -> split-file format
// ---------------------------------------------------------------------------

async function migrateToSplitStorage(api: any, oldDataRaw: string) {
  try {
    const oldData = JSON.parse(oldDataRaw);
    const state = oldData.state || oldData;

    const meta = {
      activeEnvironmentId: state.activeEnvironmentId ?? null,
      sidebarWidth: state.sidebarWidth ?? 280,
      sidebarCollapsed: state.sidebarCollapsed ?? false,
      requestPanelWidth: state.requestPanelWidth ?? 50,
      panelLayout: state.panelLayout ?? 'horizontal',
    };
    await api.writeData({ filename: 'meta.json', content: JSON.stringify(meta, null, 2) });

    if (Array.isArray(state.collections)) {
      for (const col of state.collections) {
        await api.writeData({
          filename: `collections/${col.id}.json`,
          content: JSON.stringify(col, null, 2),
        });
      }
    }

    if (Array.isArray(state.environments)) {
      for (const env of state.environments) {
        await api.writeData({
          filename: `environments/${env.id}.json`,
          content: JSON.stringify(env, null, 2),
        });
      }
    }

    if (Array.isArray(state.history)) {
      await api.writeData({
        filename: 'history.json',
        content: JSON.stringify(state.history, null, 2),
      });
    }

    if (Array.isArray(state.openApiDocuments)) {
      for (const doc of state.openApiDocuments) {
        await api.writeData({
          filename: `openapi-docs/${doc.id}.json`,
          content: JSON.stringify(doc, null, 2),
        });
      }
    }

    // Remove the old single file so migration doesn't run again
    await api.deleteDataFile('fetchy-storage.json');

    console.log('Successfully migrated from single-file to split-file storage.');
  } catch (error) {
    console.error('Migration from single file failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Given a Map of all loaded collections (keyed by id) and an ordered list of
 * ids saved in meta.json, return a correctly-ordered array of collection objects.
 *
 * - Collections in `collectionOrder` appear first, in that order.
 * - Collections NOT in `collectionOrder` (e.g. from an older workspace) are
 *   appended at the end so nothing is ever lost.
 * - IDs in `collectionOrder` that have no matching file are silently skipped.
 *
 * Exported for unit testing.
 */
export function restoreCollectionOrder(
  collectionsMap: Map<string, any>,
  collectionOrder: string[],
): any[] {
  return [
    ...collectionOrder.filter(id => collectionsMap.has(id)).map(id => collectionsMap.get(id)),
    ...[...collectionsMap.values()].filter(col => !collectionOrder.includes(col.id)),
  ];
}

// ---------------------------------------------------------------------------
// Custom storage factory (split-file for Electron, localStorage fallback)
// ---------------------------------------------------------------------------

export const createCustomStorage = (): StateStorage => {
  if (isElectron) {
    return {
      getItem: async (_name: string): Promise<string | null> => {
        try {
          const api = (window as any).electronAPI;

          // Check for old single-file format and migrate
          const oldData = await api.readData('fetchy-storage.json');
          if (oldData) {
            await migrateToSplitStorage(api, oldData);
          }

          // Read split files
          const metaRaw = await api.readData('meta.json');

          let meta: any = {};
          if (metaRaw) {
            try { meta = JSON.parse(metaRaw); } catch {}
          }

          // Collections
          const collectionFiles: string[] = await api.listDataDir('collections');
          const collectionsMap = new Map<string, any>();
          for (const file of collectionFiles) {
            const content = await api.readData(`collections/${file}`);
            if (content) {
              try {
                const col = JSON.parse(content);
                collectionsMap.set(col.id, col);
              } catch {
                console.warn(`Skipping corrupt collection file: ${file}`);
              }
            }
          }
          // Restore user-defined order from meta, append any unknown ones at the end
          const collectionOrder: string[] = Array.isArray(meta.collectionOrder) ? meta.collectionOrder : [];
          const collections: any[] = [
            ...collectionOrder.filter(id => collectionsMap.has(id)).map(id => collectionsMap.get(id)),
            ...[...collectionsMap.values()].filter(col => !collectionOrder.includes(col.id)),
          ];

          // Environments
          const envFiles: string[] = await api.listDataDir('environments');
          const environments: any[] = [];
          for (const file of envFiles) {
            const content = await api.readData(`environments/${file}`);
            if (content) {
              try { environments.push(JSON.parse(content)); } catch {
                console.warn(`Skipping corrupt environment file: ${file}`);
              }
            }
          }

          // History
          let history: any[] = [];
          const historyRaw = await api.readData('history.json');
          if (historyRaw) {
            try { history = JSON.parse(historyRaw); } catch {}
          }

          // OpenAPI documents
          const openapiFiles: string[] = await api.listDataDir('openapi-docs');

          // If the directory contains no Fetchy data at all, treat it as an
          // empty workspace (return null so zustand keeps the cleared defaults).
          const hasAnyData =
            metaRaw || oldData ||
            collectionFiles.length > 0 ||
            envFiles.length > 0 ||
            historyRaw ||
            openapiFiles.length > 0;
          if (!hasAnyData) return null;
          const openApiDocuments: any[] = [];
          for (const file of openapiFiles) {
            const content = await api.readData(`openapi-docs/${file}`);
            if (content) {
              try { openApiDocuments.push(JSON.parse(content)); } catch {
                console.warn(`Skipping corrupt OpenAPI doc file: ${file}`);
              }
            }
          }

          // Assemble state
          const state = {
            collections,
            environments,
            activeEnvironmentId: meta.activeEnvironmentId ?? null,
            history,
            sidebarWidth: meta.sidebarWidth ?? 280,
            sidebarCollapsed: meta.sidebarCollapsed ?? false,
            requestPanelWidth: meta.requestPanelWidth ?? 50,
            panelLayout: meta.panelLayout ?? 'horizontal',
            openApiDocuments,
          };

          let stateWrapper = { state, version: 0 };

          // Hydrate: merge secrets + strip transient values (#27 shared pipeline)
          try {
            const secretsRaw = await api.readSecrets();
            if (secretsRaw) {
              const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
              if (secretsStorage?.secrets) {
                stateWrapper = hydrateAfterRead(stateWrapper, secretsStorage.secrets);
              } else {
                stateWrapper = stripTransientEnvValues(stateWrapper);
              }
            } else {
              stateWrapper = stripTransientEnvValues(stateWrapper);
            }
          } catch {
            stateWrapper = stripTransientEnvValues(stateWrapper);
          }

          // Run schema migrations (#28)
          stateWrapper = migrateState(stateWrapper);

          return JSON.stringify(stateWrapper);
        } catch (error) {
          console.error('Error reading from split file storage:', error);
          return null;
        }
      },

      setItem: async (_name: string, value: string): Promise<void> => {
        const api = (window as any).electronAPI;
        // Guard the whole multi-file write (environments/collections + secrets)
        // so the fs watcher never triggers a rehydrate mid-save (#macOS secret
        // values being wiped when Keychain access makes the secrets write slow).
        try {
          await api?.setWriteInProgress?.(true);
        } catch { /* ignore */ }
        try {
          const stateWrapper = JSON.parse(value);

          // Shared write pipeline: truncate history, strip transient, extract secrets (#27)
          const { cleanState, secretsMap } = prepareForWrite(stateWrapper);
          const state = cleanState.state;

          // Write meta.json
          const meta = {
            activeEnvironmentId: state.activeEnvironmentId,
            sidebarWidth: state.sidebarWidth,
            sidebarCollapsed: state.sidebarCollapsed,
            requestPanelWidth: state.requestPanelWidth,
            panelLayout: state.panelLayout,
            collectionOrder: Array.isArray(state.collections) ? state.collections.map((c: any) => c.id) : [],
          };
          await writeIfChanged(api, 'meta.json', JSON.stringify(meta, null, 2));

          // Write individual collections
          if (Array.isArray(state.collections)) {
            const currentIds = new Set<string>();
            for (const col of state.collections) {
              currentIds.add(col.id);
              await writeIfChanged(api, `collections/${col.id}.json`, JSON.stringify(col, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('collections');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`collections/${file}`);
                  delete writeContentCache[`collections/${file}`];
                }
              }
            } catch {}
          }

          // Write individual environments
          if (Array.isArray(state.environments)) {
            const currentIds = new Set<string>();
            for (const env of state.environments) {
              currentIds.add(env.id);
              await writeIfChanged(api, `environments/${env.id}.json`, JSON.stringify(env, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('environments');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`environments/${file}`);
                  delete writeContentCache[`environments/${file}`];
                }
              }
            } catch {}
          }

          // Write history
          if (Array.isArray(state.history)) {
            await writeIfChanged(api, 'history.json', JSON.stringify(state.history, null, 2));
          }

          // Write individual OpenAPI documents
          if (Array.isArray(state.openApiDocuments)) {
            const currentIds = new Set<string>();
            for (const doc of state.openApiDocuments) {
              currentIds.add(doc.id);
              await writeIfChanged(api, `openapi-docs/${doc.id}.json`, JSON.stringify(doc, null, 2));
            }
            try {
              const existingFiles: string[] = await api.listDataDir('openapi-docs');
              for (const file of existingFiles) {
                const id = file.replace('.json', '');
                if (!currentIds.has(id)) {
                  await api.deleteDataFile(`openapi-docs/${file}`);
                  delete writeContentCache[`openapi-docs/${file}`];
                }
              }
            } catch {}
          }

          // Write secrets
          const secretsStorage: SecretsStorage = {
            version: '1.0',
            secrets: secretsMap,
          };
          await api.writeSecrets({
            content: JSON.stringify(secretsStorage, null, 2),
          });
        } catch (error) {
          console.error('Error writing to split file storage:', error);
        } finally {
          try {
            await api?.setWriteInProgress?.(false);
          } catch { /* ignore */ }
        }
      },

      removeItem: async (_name: string): Promise<void> => {
        try {
          const api = (window as any).electronAPI;
          await api.deleteDataFile('meta.json');
          await api.deleteDataFile('history.json');
          for (const dir of ['collections', 'environments', 'openapi-docs']) {
            try {
              const files: string[] = await api.listDataDir(dir);
              for (const file of files) {
                await api.deleteDataFile(`${dir}/${file}`);
              }
            } catch {}
          }
        } catch (error) {
          console.error('Error removing from file storage:', error);
        }
      },
    };
  }

  // -- Browser / localStorage fallback ----------------------------------------
  return {
    getItem: (name: string): string | null => {
      // Use a workspace-scoped key so each browser workspace has its own slot.
      const scopedName = getBrowserStorageKey(name);
      const raw = localStorage.getItem(scopedName);
      if (!raw) return null;

      try {
        let stateWrapper = JSON.parse(raw);

        // Hydrate: merge secrets + strip transient values (#27 shared pipeline)
        const secretsRaw = localStorage.getItem(`${scopedName}-secrets`);
        if (secretsRaw) {
          const secretsStorage: SecretsStorage = JSON.parse(secretsRaw);
          if (secretsStorage?.secrets) {
            stateWrapper = hydrateAfterRead(stateWrapper, secretsStorage.secrets);
          } else {
            stateWrapper = stripTransientEnvValues(stateWrapper);
          }
        } else {
          stateWrapper = stripTransientEnvValues(stateWrapper);
        }

        // Run schema migrations (#28)
        stateWrapper = migrateState(stateWrapper);

        return JSON.stringify(stateWrapper);
      } catch {
        return raw;
      }
    },

    setItem: (name: string, value: string): void => {
      try {
        const scopedName = getBrowserStorageKey(name);
        const stateWrapper = JSON.parse(value);

        // Shared write pipeline: truncate history, strip transient, extract secrets (#27)
        const { cleanState, secretsMap } = prepareForWrite(stateWrapper);
        localStorage.setItem(scopedName, JSON.stringify(cleanState));
        const secretsStorage: SecretsStorage = { version: '1.0', secrets: secretsMap };
        localStorage.setItem(`${scopedName}-secrets`, JSON.stringify(secretsStorage));
      } catch (error) {
        console.error('Error persisting to localStorage:', error);
      }
    },

    removeItem: (name: string): void => {
      const scopedName = getBrowserStorageKey(name);
      localStorage.removeItem(scopedName);
      localStorage.removeItem(`${scopedName}-secrets`);
    },
  };
};
