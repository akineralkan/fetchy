import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Required for immer v10 to support Map/Set in draft state (used by _entityIndex)
enableMapSet();
import { v4 as uuidv4 } from 'uuid';
import {
  Collection,
  Environment,
  ApiRequest,
  RequestFolder,
  TabState,
  RequestHistoryItem,
  OpenAPIDocument,
} from '../types';
import { AppStorageExport, createCustomStorage, createDebouncedStorage, invalidateWriteCache, suppressPersistence, cancelPendingPersistence } from './persistence';
import { migrateExport, CURRENT_SCHEMA_VERSION } from './dataMigration';
import {
  createDefaultRequest,
  findAndUpdateRequest,
  findRequest,
  findAndDeleteRequest,
  findAndUpdateFolder,
  findAndDeleteFolder,
  addRequestToFolder,
  addSubFolder,
} from './requestTree';
import {
  type EntityIndex,
  buildEntityIndex,
  reindexCollection,
  removeCollectionFromIndex,
  indexRequest,
  indexFolder,
  unindexRequest,
  unindexFolder,
  navigateToFolder,
  getRequestContainer,
  getFolderContainer,
} from './entityIndex';
// Re-export AppStorageExport so existing consumers don't need to change their imports
export type { AppStorageExport };


interface AppStore {
  // Entity index — flat O(1) lookup tables (not persisted)
  _entityIndex: EntityIndex;
  _rebuildIndex: () => void;

  // Collections
  collections: Collection[];
  addCollection: (name: string, description?: string) => Collection;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  reorderCollections: (fromIndex: number, toIndex: number) => void;

  // Folders
  addFolder: (collectionId: string, parentFolderId: string | null, name: string) => void;
  updateFolder: (collectionId: string, folderId: string, updates: Partial<RequestFolder>) => void;
  deleteFolder: (collectionId: string, folderId: string) => void;
  toggleFolderExpanded: (collectionId: string, folderId: string) => void;
  reorderFolders: (collectionId: string, parentFolderId: string | null, fromIndex: number, toIndex: number) => void;
  moveFolder: (
    sourceCollectionId: string,
    targetCollectionId: string,
    folderId: string,
    targetIndex?: number
  ) => void;

  // Requests
  addRequest: (collectionId: string, folderId: string | null, request?: Partial<ApiRequest>) => ApiRequest;
  updateRequest: (collectionId: string, requestId: string, updates: Partial<ApiRequest>) => void;
  deleteRequest: (collectionId: string, requestId: string) => void;
  getRequest: (collectionId: string, requestId: string) => ApiRequest | null;
  duplicateRequest: (collectionId: string, requestId: string) => void;
  reorderRequests: (collectionId: string, folderId: string | null, fromIndex: number, toIndex: number) => void;
  moveRequest: (
    sourceCollectionId: string,
    sourceFolderId: string | null,
    targetCollectionId: string,
    targetFolderId: string | null,
    requestId: string,
    targetIndex?: number
  ) => void;

  // Environments
  environments: Environment[];
  activeEnvironmentId: string | null;
  addEnvironment: (name: string) => Environment;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  getActiveEnvironment: () => Environment | null;
  duplicateEnvironment: (id: string) => Environment | null;
  importEnvironment: (environment: Environment) => Environment;
  reorderEnvironments: (fromIndex: number, toIndex: number) => void;
  reorderEnvironmentVariables: (environmentId: string, fromIndex: number, toIndex: number) => void;
  bulkUpdateEnvironments: (environments: Environment[], activeEnvId: string | null) => void;

  // Tabs
  tabs: TabState[];
  activeTabId: string | null;
  openTab: (tab: Omit<TabState, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TabState>) => void;

  // History
  history: RequestHistoryItem[];
  addToHistory: (item: Omit<RequestHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;

  // Active request (for the current working request)
  activeRequest: ApiRequest | null;
  setActiveRequest: (request: ApiRequest | null) => void;

  // Sidebar
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;

  // Panel widths
  requestPanelWidth: number;
  setRequestPanelWidth: (width: number) => void;

  // Panel layout
  panelLayout: 'horizontal' | 'vertical';
  setPanelLayout: (layout: 'horizontal' | 'vertical') => void;
  togglePanelLayout: () => void;

  // Import/Export
  importCollection: (collection: Collection) => void;
  exportCollection: (id: string) => Collection | null;

  // Full app storage export/import
  exportFullStorage: () => AppStorageExport;
  importFullStorage: (data: AppStorageExport) => void;

  // Toggle collection expanded
  toggleCollectionExpanded: (id: string) => void;

  // OpenAPI Documents
  openApiDocuments: OpenAPIDocument[];
  addOpenApiDocument: (name: string, content?: string, format?: 'yaml' | 'json') => OpenAPIDocument;
  updateOpenApiDocument: (id: string, updates: Partial<OpenAPIDocument>) => void;
  deleteOpenApiDocument: (id: string) => void;
  getOpenApiDocument: (id: string) => OpenAPIDocument | null;
  reorderOpenApiDocuments: (fromIndex: number, toIndex: number) => void;
}


export const useAppStore = create<AppStore>()(
  persist(
    immer((set, get) => ({
      // ── Entity index (not persisted, rebuilt on rehydrate) ─────────────
      _entityIndex: buildEntityIndex([]),

      _rebuildIndex: () => {
        set(state => {
          const fresh = buildEntityIndex(state.collections as Collection[]);
          state._entityIndex = fresh as any; // immer draft typing workaround
        });
      },

      // Collections
      collections: [],

      addCollection: (name: string, description?: string) => {
        const collection: Collection = {
          id: uuidv4(),
          name,
          description,
          folders: [],
          requests: [],
          variables: [],
          expanded: true,
        };
        set(state => {
          state.collections.push(collection);
          // Index is empty for a new collection — no entities to register
        });
        return collection;
      },

      updateCollection: (id: string, updates: Partial<Collection>) => {
        set(state => {
          const index = state.collections.findIndex(c => c.id === id);
          if (index !== -1) {
            state.collections[index] = { ...state.collections[index], ...updates };
            // If name was updated, sync open collection tabs
            if (updates.name) {
              state.tabs = state.tabs.map(tab => {
                if (tab.type === 'collection' && tab.collectionId === id) {
                  return { ...tab, title: updates.name! };
                }
                return tab;
              });
            }
          }
        });
      },

      deleteCollection: (id: string) => {
        set(state => {
          removeCollectionFromIndex(state._entityIndex as any, id);
          state.collections = state.collections.filter(c => c.id !== id);
          state.tabs = state.tabs.filter(t => t.collectionId !== id);
        });
      },

      reorderCollections: (fromIndex: number, toIndex: number) => {
        set(state => {
          const [removed] = state.collections.splice(fromIndex, 1);
          state.collections.splice(toIndex, 0, removed);
        });
      },

      toggleCollectionExpanded: (id: string) => {
        set(state => {
          const index = state.collections.findIndex(c => c.id === id);
          if (index !== -1) {
            state.collections[index].expanded = !state.collections[index].expanded;
          }
        });
      },

      // Folders
      addFolder: (collectionId: string, parentFolderId: string | null, name: string) => {
        const newFolder: RequestFolder = {
          id: uuidv4(),
          name,
          requests: [],
          folders: [],
          expanded: true,
        };

        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          if (parentFolderId === null) {
            state.collections[collectionIndex].folders.push(newFolder);
          } else {
            // O(1) index lookup + O(depth) navigation instead of O(n) recursion
            const parent = navigateToFolder(
              state.collections[collectionIndex] as Collection,
              idx,
              parentFolderId,
            );
            if (parent) {
              parent.folders.push(newFolder);
            } else {
              // Fallback to legacy recursive function
              const result = addSubFolder(
                state.collections[collectionIndex].folders,
                parentFolderId,
                newFolder
              );
              if (result.found) {
                state.collections[collectionIndex].folders = result.folders;
              }
            }
          }
          // Register in index
          indexFolder(idx, newFolder, collectionId, parentFolderId);
        });
      },

      updateFolder: (collectionId: string, folderId: string, updates: Partial<RequestFolder>) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          // O(1) index lookup + O(depth) navigation
          const folder = navigateToFolder(
            state.collections[collectionIndex] as Collection,
            idx,
            folderId,
          );
          if (folder) {
            Object.assign(folder, updates);
          } else {
            // Fallback to legacy recursive function
            const result = findAndUpdateFolder(
              state.collections[collectionIndex].folders,
              folderId,
              updates
            );
            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
            }
          }
        });
      },

      deleteFolder: (collectionId: string, folderId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          // Use index to find the container holding this folder
          const container = getFolderContainer(
            state.collections as Collection[],
            idx,
            folderId,
          );
          if (container) {
            const folderObj = container.folders.find(f => f.id === folderId);
            if (folderObj) unindexFolder(idx, folderObj as RequestFolder);
            const fi = container.folders.findIndex(f => f.id === folderId);
            if (fi !== -1) container.folders.splice(fi, 1);
          } else {
            // Fallback to legacy
            const result = findAndDeleteFolder(
              state.collections[collectionIndex].folders,
              folderId
            );
            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
            }
          }
        });
      },

      toggleFolderExpanded: (collectionId: string, folderId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          // O(1) lookup + O(depth) navigation — no full tree copy
          const folder = navigateToFolder(
            state.collections[collectionIndex] as Collection,
            idx,
            folderId,
          );
          if (folder) {
            folder.expanded = !folder.expanded;
          } else {
            // Fallback to legacy recursive function
            const toggleFolder = (folders: RequestFolder[]): RequestFolder[] => {
              return folders.map(f => {
                if (f.id === folderId) {
                  return { ...f, expanded: !f.expanded };
                }
                return { ...f, folders: toggleFolder(f.folders) };
              });
            };

            state.collections[collectionIndex].folders = toggleFolder(
              state.collections[collectionIndex].folders
            );
          }
        });
      },

      reorderFolders: (collectionId: string, parentFolderId: string | null, fromIndex: number, toIndex: number) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          if (parentFolderId === null) {
            // Reorder folders at collection root level
            const [removed] = state.collections[collectionIndex].folders.splice(fromIndex, 1);
            state.collections[collectionIndex].folders.splice(toIndex, 0, removed);
          } else {
            // O(1) lookup + O(depth) navigation to parent folder
            const parent = navigateToFolder(
              state.collections[collectionIndex] as Collection,
              idx,
              parentFolderId,
            );
            if (parent) {
              const [removed] = parent.folders.splice(fromIndex, 1);
              parent.folders.splice(toIndex, 0, removed);
            } else {
              // Fallback to legacy recursive function
              const reorderInFolder = (folders: RequestFolder[]): RequestFolder[] => {
                return folders.map(f => {
                  if (f.id === parentFolderId) {
                    const newFolders = [...f.folders];
                    const [removed] = newFolders.splice(fromIndex, 1);
                    newFolders.splice(toIndex, 0, removed);
                    return { ...f, folders: newFolders };
                  }
                  return { ...f, folders: reorderInFolder(f.folders) };
                });
              };
              state.collections[collectionIndex].folders = reorderInFolder(
                state.collections[collectionIndex].folders
              );
            }
          }
        });
      },

      moveFolder: (
        sourceCollectionId: string,
        targetCollectionId: string,
        folderId: string,
        targetIndex?: number
      ) => {
        const state = get();
        const idx = state._entityIndex as any as EntityIndex;

        // Find the folder using the index — O(1) lookup
        const sourceCollection = state.collections.find(c => c.id === sourceCollectionId);
        if (!sourceCollection) return;

        const folder = navigateToFolder(sourceCollection, idx, folderId);
        if (!folder) return;

        // Deep clone for insertion into target (we're about to remove from source)
        const folderSnapshot = JSON.parse(JSON.stringify(folder)) as RequestFolder;

        set(s => {
          const sIdx = s._entityIndex as any as EntityIndex;

          // Remove from source collection
          const sourceColIndex = s.collections.findIndex(c => c.id === sourceCollectionId);
          if (sourceColIndex === -1) return;

          const container = getFolderContainer(
            s.collections as Collection[],
            sIdx,
            folderId,
          );
          if (container) {
            const folderObj = container.folders.find(f => f.id === folderId);
            if (folderObj) unindexFolder(sIdx, folderObj as RequestFolder);
            const fi = container.folders.findIndex(f => f.id === folderId);
            if (fi !== -1) container.folders.splice(fi, 1);
          } else {
            const deleteResult = findAndDeleteFolder(
              s.collections[sourceColIndex].folders,
              folderId
            );
            if (deleteResult.found) {
              s.collections[sourceColIndex].folders = deleteResult.folders;
            }
          }

          // Add to target collection
          const targetColIndex = s.collections.findIndex(c => c.id === targetCollectionId);
          if (targetColIndex === -1) return;

          if (targetIndex !== undefined) {
            s.collections[targetColIndex].folders.splice(targetIndex, 0, folderSnapshot);
          } else {
            s.collections[targetColIndex].folders.push(folderSnapshot);
          }

          // Re-index the moved folder and its children under the target collection
          indexFolder(sIdx, folderSnapshot, targetCollectionId, null);

          // Update any open tabs that reference requests in this folder
          const updateTabsForFolder = (folderToCheck: RequestFolder) => {
            folderToCheck.requests.forEach(req => {
              s.tabs = s.tabs.map(t => {
                if (t.requestId === req.id) {
                  return { ...t, collectionId: targetCollectionId };
                }
                return t;
              });
            });
            folderToCheck.folders.forEach(subFolder => updateTabsForFolder(subFolder));
          };
          updateTabsForFolder(folderSnapshot);
        });
      },

      // Requests
      addRequest: (collectionId: string, folderId: string | null, request?: Partial<ApiRequest>) => {
        const newRequest = createDefaultRequest(request);

        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          if (folderId === null) {
            state.collections[collectionIndex].requests.push(newRequest);
          } else {
            // O(1) index lookup + O(depth) navigation
            const parent = navigateToFolder(
              state.collections[collectionIndex] as Collection,
              idx,
              folderId,
            );
            if (parent) {
              parent.requests.push(newRequest);
            } else {
              // Fallback to legacy recursive function
              const result = addRequestToFolder(
                state.collections[collectionIndex].folders,
                folderId,
                newRequest
              );
              if (result.found) {
                state.collections[collectionIndex].folders = result.folders;
              }
            }
          }
          // Register in index
          indexRequest(idx, newRequest.id, collectionId, folderId);
        });

        return newRequest;
      },

      updateRequest: (collectionId: string, requestId: string, updates: Partial<ApiRequest>) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          // O(1) index lookup + O(depth) navigation for direct mutation
          const container = getRequestContainer(
            state.collections as Collection[],
            idx,
            requestId,
          );
          if (container) {
            const reqIdx = container.requests.findIndex(r => r.id === requestId);
            if (reqIdx !== -1) {
              Object.assign(container.requests[reqIdx], updates);
            }
          } else {
            // Fallback to legacy recursive function
            const result = findAndUpdateRequest(
              state.collections[collectionIndex].folders,
              state.collections[collectionIndex].requests,
              requestId,
              updates
            );

            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
              state.collections[collectionIndex].requests = result.requests;
            }
          }

          // If the request name was updated, keep all open tabs in sync.
          // • If the tab has a draftRequest (unsaved edits), update only the name field
          //   inside the draft so the user's other modifications are not discarded.
          // • If there is no draft, reset isModified so the panel reloads the new name
          //   from the collection (original behaviour).
          if (updates.name) {
            state.tabs = state.tabs.map(tab => {
              if (tab.type === 'request' && tab.requestId === requestId) {
                const draft = tab.draftRequest;
                return {
                  ...tab,
                  title: updates.name!,
                  ...(draft
                    ? { draftRequest: { ...draft, name: updates.name! } }
                    : { isModified: false }),
                };
              }
              return tab;
            });
          }
        });
      },

      deleteRequest: (collectionId: string, requestId: string) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          // O(1) index lookup + O(depth) navigation for direct splice
          const container = getRequestContainer(
            state.collections as Collection[],
            idx,
            requestId,
          );
          if (container) {
            const reqIdx = container.requests.findIndex(r => r.id === requestId);
            if (reqIdx !== -1) container.requests.splice(reqIdx, 1);
            unindexRequest(idx, requestId);
          } else {
            // Fallback to legacy recursive function
            const result = findAndDeleteRequest(
              state.collections[collectionIndex].folders,
              state.collections[collectionIndex].requests,
              requestId
            );
            if (result.found) {
              state.collections[collectionIndex].folders = result.folders;
              state.collections[collectionIndex].requests = result.requests;
            }
          }

          state.tabs = state.tabs.filter(t => t.requestId !== requestId);
        });
      },

      getRequest: (collectionId: string, requestId: string) => {
        const state = get();
        const idx = state._entityIndex as any as EntityIndex;

        // O(1) index lookup + O(depth) navigation
        const container = getRequestContainer(state.collections, idx, requestId);
        if (container) {
          return container.requests.find(r => r.id === requestId) ?? null;
        }

        // Fallback to legacy recursive function
        const collection = state.collections.find(c => c.id === collectionId);
        if (!collection) return null;
        return findRequest(collection.folders, collection.requests, requestId);
      },

      duplicateRequest: (collectionId: string, requestId: string) => {
        const state = get();
        const request = state.getRequest(collectionId, requestId);
        if (!request) return;

        const newRequest = createDefaultRequest({
          ...request,
          id: uuidv4(),
          name: `${request.name} (Copy)`,
        });

        set(s => {
          const collectionIndex = s.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;

          // Add to root level of collection for simplicity
          s.collections[collectionIndex].requests.push(newRequest);
          // Register in index (at collection root)
          indexRequest(s._entityIndex as any as EntityIndex, newRequest.id, collectionId, null);
        });
      },

      reorderRequests: (collectionId: string, folderId: string | null, fromIndex: number, toIndex: number) => {
        set(state => {
          const collectionIndex = state.collections.findIndex(c => c.id === collectionId);
          if (collectionIndex === -1) return;
          const idx = state._entityIndex as any as EntityIndex;

          if (folderId === null) {
            // Reorder requests at collection root level
            const [removed] = state.collections[collectionIndex].requests.splice(fromIndex, 1);
            state.collections[collectionIndex].requests.splice(toIndex, 0, removed);
          } else {
            // O(1) index lookup + O(depth) navigation
            const folder = navigateToFolder(
              state.collections[collectionIndex] as Collection,
              idx,
              folderId,
            );
            if (folder) {
              const [removed] = folder.requests.splice(fromIndex, 1);
              folder.requests.splice(toIndex, 0, removed);
            } else {
              // Fallback to legacy recursive function
              const reorderInFolder = (folders: RequestFolder[]): RequestFolder[] => {
                return folders.map(f => {
                  if (f.id === folderId) {
                    const newRequests = [...f.requests];
                    const [removed] = newRequests.splice(fromIndex, 1);
                    newRequests.splice(toIndex, 0, removed);
                    return { ...f, requests: newRequests };
                  }
                  return { ...f, folders: reorderInFolder(f.folders) };
                });
              };
              state.collections[collectionIndex].folders = reorderInFolder(
                state.collections[collectionIndex].folders
              );
            }
          }
        });
      },

      moveRequest: (
        sourceCollectionId: string,
        _sourceFolderId: string | null,
        targetCollectionId: string,
        targetFolderId: string | null,
        requestId: string,
        targetIndex?: number
      ) => {
        const state = get();
        const idx = state._entityIndex as any as EntityIndex;

        // O(1) index-assisted lookup for the request
        const container = getRequestContainer(state.collections, idx, requestId);
        const request = container
          ? container.requests.find(r => r.id === requestId) ?? null
          : null;

        if (!request) {
          // Fallback to legacy
          const sourceCollection = state.collections.find(c => c.id === sourceCollectionId);
          if (!sourceCollection) return;
          const legacyReq = findRequest(sourceCollection.folders, sourceCollection.requests, requestId);
          if (!legacyReq) return;
        }

        // We need a plain copy to insert into the target
        const requestSnapshot = request
          ? (JSON.parse(JSON.stringify(request)) as ApiRequest)
          : null;
        if (!requestSnapshot) return;

        set(s => {
          const sIdx = s._entityIndex as any as EntityIndex;

          // Remove from source using index
          const sourceColIndex = s.collections.findIndex(c => c.id === sourceCollectionId);
          if (sourceColIndex === -1) return;

          const srcContainer = getRequestContainer(
            s.collections as Collection[],
            sIdx,
            requestId,
          );
          if (srcContainer) {
            const ri = srcContainer.requests.findIndex(r => r.id === requestId);
            if (ri !== -1) srcContainer.requests.splice(ri, 1);
            unindexRequest(sIdx, requestId);
          } else {
            const deleteResult = findAndDeleteRequest(
              s.collections[sourceColIndex].folders,
              s.collections[sourceColIndex].requests,
              requestId
            );
            if (deleteResult.found) {
              s.collections[sourceColIndex].folders = deleteResult.folders;
              s.collections[sourceColIndex].requests = deleteResult.requests;
            }
          }

          // Add to target
          const targetColIndex = s.collections.findIndex(c => c.id === targetCollectionId);
          if (targetColIndex === -1) return;

          if (targetFolderId === null) {
            // Add to collection root
            if (targetIndex !== undefined) {
              s.collections[targetColIndex].requests.splice(targetIndex, 0, requestSnapshot);
            } else {
              s.collections[targetColIndex].requests.push(requestSnapshot);
            }
          } else {
            // Add to folder using index navigation
            const targetFolder = navigateToFolder(
              s.collections[targetColIndex] as Collection,
              sIdx,
              targetFolderId,
            );
            if (targetFolder) {
              if (targetIndex !== undefined) {
                targetFolder.requests.splice(targetIndex, 0, requestSnapshot);
              } else {
                targetFolder.requests.push(requestSnapshot);
              }
            } else {
              // Fallback to legacy
              const addToFolder = (folders: RequestFolder[]): RequestFolder[] => {
                return folders.map(f => {
                  if (f.id === targetFolderId) {
                    const newRequests = [...f.requests];
                    if (targetIndex !== undefined) {
                      newRequests.splice(targetIndex, 0, requestSnapshot);
                    } else {
                      newRequests.push(requestSnapshot);
                    }
                    return { ...f, requests: newRequests };
                  }
                  return { ...f, folders: addToFolder(f.folders) };
                });
              };
              s.collections[targetColIndex].folders = addToFolder(
                s.collections[targetColIndex].folders
              );
            }
          }

          // Register in index at new location
          indexRequest(sIdx, requestId, targetCollectionId, targetFolderId);

          // Update any open tabs that reference this request
          s.tabs = s.tabs.map(t => {
            if (t.requestId === requestId) {
              return { ...t, collectionId: targetCollectionId, folderId: targetFolderId ?? undefined };
            }
            return t;
          });
        });
      },

      // Environments
      environments: [],
      activeEnvironmentId: null,

      addEnvironment: (name: string) => {
        const environment: Environment = {
          id: uuidv4(),
          name,
          variables: [],
        };
        set(state => {
          state.environments.push(environment);
        });
        return environment;
      },

      updateEnvironment: (id: string, updates: Partial<Environment>) => {
        set(state => {
          const index = state.environments.findIndex(e => e.id === id);
          if (index !== -1) {
            state.environments[index] = { ...state.environments[index], ...updates };
            // If name was updated, sync open environment tabs
            if (updates.name) {
              state.tabs = state.tabs.map(tab => {
                if (tab.type === 'environment' && tab.environmentId === id) {
                  return { ...tab, title: updates.name! };
                }
                return tab;
              });
            }
          }
        });
      },

      deleteEnvironment: (id: string) => {
        set(state => {
          state.environments = state.environments.filter(e => e.id !== id);
          if (state.activeEnvironmentId === id) {
            state.activeEnvironmentId = null;
          }
        });
      },

      setActiveEnvironment: (id: string | null) => {
        set(state => {
          state.activeEnvironmentId = id;
        });
      },

      getActiveEnvironment: () => {
        const state = get();
        if (!state.activeEnvironmentId) return null;
        return state.environments.find(e => e.id === state.activeEnvironmentId) || null;
      },

      duplicateEnvironment: (id: string) => {
        const state = get();
        const original = state.environments.find(e => e.id === id);
        if (!original) return null;

        const duplicated: Environment = {
          id: uuidv4(),
          name: `${original.name} (Copy)`,
          variables: original.variables.map(v => ({
            ...v,
            id: uuidv4(),
          })),
        };

        set(state => {
          state.environments.push(duplicated);
        });

        return duplicated;
      },

      importEnvironment: (environment: Environment) => {
        const imported: Environment = {
          ...environment,
          id: uuidv4(),
          variables: environment.variables.map(v => ({
            ...v,
            id: uuidv4(),
          })),
        };

        set(state => {
          state.environments.push(imported);
        });

        return imported;
      },

      reorderEnvironments: (fromIndex: number, toIndex: number) => {
        set(state => {
          const [removed] = state.environments.splice(fromIndex, 1);
          state.environments.splice(toIndex, 0, removed);
        });
      },

      reorderEnvironmentVariables: (environmentId: string, fromIndex: number, toIndex: number) => {
        set(state => {
          const envIndex = state.environments.findIndex(e => e.id === environmentId);
          if (envIndex === -1) return;

          const [removed] = state.environments[envIndex].variables.splice(fromIndex, 1);
          state.environments[envIndex].variables.splice(toIndex, 0, removed);
        });
      },

      bulkUpdateEnvironments: (environments: Environment[], activeEnvId: string | null) => {
        set(state => {
          state.environments = environments;
          state.activeEnvironmentId = activeEnvId;
        });
      },

      // Tabs
      tabs: [],
      activeTabId: null,

      openTab: (tab: Omit<TabState, 'id'>) => {
        set(state => {
          // Check if tab already exists based on type
          let existingTab = null;

          if (tab.requestId) {
            // For request tabs, check by requestId
            existingTab = state.tabs.find(t => t.requestId === tab.requestId);
          } else if (tab.openApiDocId) {
            // For OpenAPI document tabs, check by openApiDocId
            existingTab = state.tabs.find(t => t.openApiDocId === tab.openApiDocId);
          } else if (tab.environmentId) {
            // For environment tabs, check by environmentId
            existingTab = state.tabs.find(t => t.environmentId === tab.environmentId);
          } else if (tab.collectionId && tab.type === 'collection') {
            // For collection tabs, check by collectionId and type
            existingTab = state.tabs.find(t => t.collectionId === tab.collectionId && t.type === 'collection');
          }

          if (existingTab) {
            state.activeTabId = existingTab.id;
          } else {
            const newTab: TabState = { ...tab, id: uuidv4(), scriptExecutionStatus: 'none' };
            state.tabs.push(newTab);
            state.activeTabId = newTab.id;
          }
        });
      },

      closeTab: (id: string) => {
        set(state => {
          const index = state.tabs.findIndex(t => t.id === id);
          state.tabs = state.tabs.filter(t => t.id !== id);

          if (state.activeTabId === id) {
            if (state.tabs.length > 0) {
              const newIndex = Math.min(index, state.tabs.length - 1);
              state.activeTabId = state.tabs[newIndex].id;
            } else {
              state.activeTabId = null;
            }
          }
        });
      },

      setActiveTab: (id: string) => {
        set(state => {
          state.activeTabId = id;
        });
      },

      updateTab: (id: string, updates: Partial<TabState>) => {
        set(state => {
          const index = state.tabs.findIndex(t => t.id === id);
          if (index !== -1) {
            state.tabs[index] = { ...state.tabs[index], ...updates };
          }
        });
      },

      // History
      history: [],

      addToHistory: (item: Omit<RequestHistoryItem, 'id' | 'timestamp'>) => {
        set(state => {
          const historyItem: RequestHistoryItem = {
            ...item,
            id: uuidv4(),
            timestamp: Date.now(),
          };
          state.history.unshift(historyItem);
          // Keep only last 100 items
          if (state.history.length > 100) {
            state.history = state.history.slice(0, 100);
          }
        });
      },

      clearHistory: () => {
        set(state => {
          state.history = [];
        });
      },

      // Active request
      activeRequest: null,

      setActiveRequest: (request: ApiRequest | null) => {
        set(state => {
          state.activeRequest = request;
        });
      },

      // Sidebar
      sidebarWidth: 280,
      sidebarCollapsed: false,

      setSidebarWidth: (width: number) => {
        set(state => {
          state.sidebarWidth = width;
        });
      },

      toggleSidebar: () => {
        set(state => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      // Panel widths
      requestPanelWidth: 50, // percentage

      setRequestPanelWidth: (width: number) => {
        set(state => {
          state.requestPanelWidth = width;
        });
      },

      // Panel layout
      panelLayout: 'horizontal',

      setPanelLayout: (layout: 'horizontal' | 'vertical') => {
        set(state => {
          state.panelLayout = layout;
        });
      },

      togglePanelLayout: () => {
        set(state => {
          state.panelLayout = state.panelLayout === 'horizontal' ? 'vertical' : 'horizontal';
        });
      },

      // Import/Export
      importCollection: (collection: Collection) => {
        set(state => {
          // Recursively regenerate UUIDs for all nested entities (#12)
          const regenerateIds = (folders: RequestFolder[]): RequestFolder[] =>
            folders.map(folder => ({
              ...folder,
              id: uuidv4(),
              requests: folder.requests.map(r => ({ ...r, id: uuidv4() })),
              folders: regenerateIds(folder.folders || []),
            }));

          const newCollection: Collection = {
            ...collection,
            id: uuidv4(),
            requests: (collection.requests || []).map(r => ({ ...r, id: uuidv4() })),
            folders: regenerateIds(collection.folders || []),
            variables: (collection.variables || []).map(v => ({ ...v, id: uuidv4() })),
          };
          state.collections.push(newCollection);
          // Index the newly imported collection
          reindexCollection(state._entityIndex as any as EntityIndex, newCollection as Collection);
        });
      },

      exportCollection: (id: string) => {
        const state = get();
        return state.collections.find(c => c.id === id) || null;
      },

      // Full app storage export/import
      exportFullStorage: () => {
        const state = get();

        // Deep clone collections and environments to avoid modifying the original state
        const sanitizeVariables = (variables: any[]) => {
          return variables.map(variable => ({
            ...variable,
            // For secret variables, replace value with the key itself
            value: variable.isSecret ? variable.key : variable.value
          }));
        };

        const sanitizeAuth = (auth: any) => {
          if (!auth) return auth;

          const sanitized = { ...auth };

          // Handle different auth types
          if (auth.type === 'basic' && auth.basic) {
            sanitized.basic = {
              username: auth.basic.username,
              // Replace password with a placeholder if it exists
              password: auth.basic.password ? '{{password}}' : ''
            };
          } else if (auth.type === 'bearer' && auth.bearer) {
            sanitized.bearer = {
              // Replace token with a placeholder if it exists
              token: auth.bearer.token ? '{{token}}' : ''
            };
          } else if (auth.type === 'api-key' && auth.apiKey) {
            sanitized.apiKey = {
              ...auth.apiKey,
              // Replace value with a placeholder if it exists
              value: auth.apiKey.value ? '{{apiKey}}' : ''
            };
          }

          return sanitized;
        };

        // Sanitize collections (variables and auth)
        const sanitizeFolders = (folders: any[]): any[] => {
          return folders.map((folder: any) => ({
            ...folder,
            auth: sanitizeAuth(folder.auth),
            folders: folder.folders ? sanitizeFolders(folder.folders) : [],
          }));
        };

        const sanitizedCollections = state.collections.map(collection => ({
          ...collection,
          variables: sanitizeVariables(collection.variables || []),
          auth: sanitizeAuth(collection.auth),
          folders: sanitizeFolders(collection.folders),
        }));

        // Sanitize environments (variables only)
        const sanitizedEnvironments = state.environments.map(env => ({
          ...env,
          variables: sanitizeVariables(env.variables || [])
        }));

        return {
          version: CURRENT_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          collections: sanitizedCollections,
          environments: sanitizedEnvironments,
          activeEnvironmentId: state.activeEnvironmentId,
          // Explicitly exclude history
          // history: state.history, // REMOVED - history is not exported
        };
      },

      importFullStorage: (data: AppStorageExport) => {
        // Run schema migrations before applying (#28)
        const migrated = migrateExport(data);
        set(state => {
          if (migrated.collections) {
            state.collections = migrated.collections;
          }
          if (migrated.environments) {
            state.environments = migrated.environments;
          }
          if (migrated.activeEnvironmentId !== undefined) {
            state.activeEnvironmentId = migrated.activeEnvironmentId;
          }
          if (migrated.history) {
            state.history = migrated.history;
          }
          // Close all tabs when importing full storage
          state.tabs = [];
          state.activeTabId = null;
          state.activeRequest = null;
          // Rebuild entity index from imported collections
          const fresh = buildEntityIndex(state.collections as Collection[]);
          state._entityIndex = fresh as any;
        });
      },

      // OpenAPI Documents
      openApiDocuments: [],

      addOpenApiDocument: (name: string, content?: string, format?: 'yaml' | 'json') => {
        const doc: OpenAPIDocument = {
          id: uuidv4(),
          name,
          content: content || '',
          format: format || 'yaml',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(state => {
          state.openApiDocuments.push(doc);
        });
        return doc;
      },

      updateOpenApiDocument: (id: string, updates: Partial<OpenAPIDocument>) => {
        set(state => {
          const index = state.openApiDocuments.findIndex(d => d.id === id);
          if (index !== -1) {
            state.openApiDocuments[index] = {
              ...state.openApiDocuments[index],
              ...updates,
              updatedAt: Date.now(),
            };
            // If name was updated, sync open openapi tabs
            if (updates.name) {
              state.tabs = state.tabs.map(tab => {
                if (tab.type === 'openapi' && tab.openApiDocId === id) {
                  return { ...tab, title: updates.name! };
                }
                return tab;
              });
            }
          }
        });
      },

      deleteOpenApiDocument: (id: string) => {
        set(state => {
          state.openApiDocuments = state.openApiDocuments.filter(d => d.id !== id);
          // Close any tabs for this document
          state.tabs = state.tabs.filter(t => t.openApiDocId !== id);
        });
      },

      getOpenApiDocument: (id: string) => {
        const state = get();
        return state.openApiDocuments.find(d => d.id === id) || null;
      },

      reorderOpenApiDocuments: (fromIndex: number, toIndex: number) => {
        set(state => {
          const docs = [...state.openApiDocuments];
          const [moved] = docs.splice(fromIndex, 1);
          docs.splice(toIndex, 0, moved);
          state.openApiDocuments = docs;
        });
      },
    })),
    {
      name: 'fetchy-storage',
      storage: createJSONStorage(() => createDebouncedStorage(createCustomStorage())),
      partialize: (state) => ({
        collections: state.collections,
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
        history: state.history,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        requestPanelWidth: state.requestPanelWidth,
        panelLayout: state.panelLayout,
        openApiDocuments: state.openApiDocuments,
      }),
      // Rebuild the entity index after every rehydrate (#26)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._entityIndex = buildEntityIndex(state.collections);
        }
      },
    }
  )
);

/**
 * Reset the app store to clean defaults and reload state from the
 * (now-active) workspace's storage.  This replaces `window.location.reload()`
 * for workspace switching — no full page reload required.
 *
 * Steps:
 * 0. Suppress persistence writes & cancel any pending debounced write so that
 *    stale / empty data is never flushed to the new workspace directory.
 * 1. Invalidate the debounced-write cache so stale data isn't flushed.
 * 2. Reset ALL state (tabs, persisted data) to empty defaults so that if the
 *    new workspace directory is empty (storage returns null), data from the
 *    previous workspace is not carried over.
 * 3. Call `persist.rehydrate()` which re-reads from the current storage
 *    backend (Electron IPC → new workspace directory, or localStorage).
 * 4. Re-enable persistence once the correct state is loaded.
 */
export async function rehydrateWorkspace(): Promise<void> {
  // 0. Block all debounced writes during the transition so existing files
  //    in the target directory are never overwritten with stale/empty data.
  suppressPersistence(true);
  cancelPendingPersistence();

  try {
    // 1. Prevent any queued debounced writes from overwriting the new workspace
    invalidateWriteCache();

    // 2. Reset ALL persisted + transient state to clean defaults.
    //    This is critical: if the new workspace directory is empty, zustand's
    //    persist.rehydrate() returns null and leaves the old state unchanged.
    //    By clearing first we guarantee a blank slate for every workspace switch.
    useAppStore.setState({
      tabs: [],
      activeTabId: null,
      activeRequest: null,
      collections: [],
      environments: [],
      activeEnvironmentId: null,
      history: [],
      openApiDocuments: [],
      sidebarWidth: 280,
      sidebarCollapsed: false,
      requestPanelWidth: 50,
      panelLayout: 'horizontal',
      _entityIndex: buildEntityIndex([]),
    });

    // 3. Re-read persisted state from the now-active workspace.
    //    If the workspace has data it will override the defaults above.
    await useAppStore.persist.rehydrate();

    // 4. Rebuild the entity index from the freshly loaded collections (#26)
    useAppStore.getState()._rebuildIndex();
  } finally {
    // 5. Re-enable persistence. From this point the loaded state matches
    //    what is on disk, so writeIfChanged will be a no-op until the user
    //    actually modifies something.
    suppressPersistence(false);
  }
}
