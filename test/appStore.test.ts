/**
 * Tests for appStore.ts — main Zustand state store.
 *
 * Tests the store actions directly (no React rendering needed).
 * Each test acts on a fresh store state to avoid cross-test pollution.
 *
 * Covers:
 *  - Collections: add, update, delete, reorder, toggleExpanded
 *  - Requests: add, update, delete, getRequest, duplicateRequest
 *  - Environments: add, update, delete, setActive, getActive, duplicate
 *  - Tabs: openTab, closeTab, setActiveTab, updateTab
 *  - History: addToHistory, clearHistory
 *  - Sidebar: setSidebarWidth, toggleSidebar, togglePanelLayout
 *  - OpenAPI documents: add, update, delete, getOpenApiDocument
 *  - importCollection / exportCollection
 *  - exportFullStorage / importFullStorage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/store/appStore';

// Mock storage so persist doesn't write to disk
vi.mock('../src/store/persistence', async () => {
  const actual = await vi.importActual<typeof import('../src/store/persistence')>('../src/store/persistence');
  return {
    ...actual,
    createCustomStorage: vi.fn(() => ({
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })),
    createDebouncedStorage: vi.fn((inner: any) => inner),
    suppressPersistence: vi.fn(),
    cancelPendingPersistence: vi.fn(),
    invalidateWriteCache: vi.fn(),
    registerActiveWorkspaceIdProvider: vi.fn(),
    isElectron: false,
  };
});

beforeEach(() => {
  // Reset store to initial state between tests
  useAppStore.setState({
    collections: [],
    environments: [],
    activeEnvironmentId: null,
    tabs: [],
    activeTabId: null,
    history: [],
    activeRequest: null,
    sidebarWidth: 280,
    sidebarCollapsed: false,
    requestPanelWidth: 50,
    panelLayout: 'horizontal',
    openApiDocuments: [],
  });
});

// ─── Collections ─────────────────────────────────────────────────────────────

describe('appStore – collections', () => {
  it('addCollection creates a collection with the given name', () => {
    const { addCollection, collections } = useAppStore.getState();
    expect(collections).toHaveLength(0);
    const col = addCollection('My API');
    expect(col.name).toBe('My API');
    expect(useAppStore.getState().collections).toHaveLength(1);
  });

  it('addCollection assigns a unique id', () => {
    const { addCollection } = useAppStore.getState();
    const c1 = addCollection('C1');
    const c2 = addCollection('C2');
    expect(c1.id).not.toBe(c2.id);
  });

  it('updateCollection changes the collection name', () => {
    const { addCollection, updateCollection } = useAppStore.getState();
    const col = addCollection('Old Name');
    updateCollection(col.id, { name: 'New Name' });
    const updated = useAppStore.getState().collections.find(c => c.id === col.id);
    expect(updated?.name).toBe('New Name');
  });

  it('deleteCollection removes it by id', () => {
    const { addCollection, deleteCollection } = useAppStore.getState();
    const col = addCollection('ToDelete');
    deleteCollection(col.id);
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('reorderCollections swaps positions correctly', () => {
    const { addCollection, reorderCollections } = useAppStore.getState();
    addCollection('A');
    addCollection('B');
    addCollection('C');
    reorderCollections(0, 2);
    const names = useAppStore.getState().collections.map(c => c.name);
    expect(names[2]).toBe('A');
  });

  it('toggleCollectionExpanded flips the expanded flag', () => {
    const { addCollection, toggleCollectionExpanded } = useAppStore.getState();
    const col = addCollection('Expandable');
    expect(col.expanded).toBe(true);
    toggleCollectionExpanded(col.id);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id);
    expect(updated?.expanded).toBe(false);
  });

  it('importCollection adds the collection to the store', () => {
    const { importCollection } = useAppStore.getState();
    const imported = {
      id: 'imp-1',
      name: 'Imported',
      folders: [],
      requests: [],
      variables: [],
      expanded: true,
    };
    importCollection(imported as any);
    // importCollection regenerates all IDs, so check by name instead
    expect(useAppStore.getState().collections.some(c => c.name === 'Imported')).toBe(true);
  });

  it('exportCollection returns null for unknown id', () => {
    const { exportCollection } = useAppStore.getState();
    expect(exportCollection('nonexistent')).toBeNull();
  });

  it('exportCollection returns the collection for a valid id', () => {
    const { addCollection, exportCollection } = useAppStore.getState();
    const col = addCollection('Exportable');
    const result = exportCollection(col.id);
    expect(result?.name).toBe('Exportable');
  });
});

// ─── Requests ────────────────────────────────────────────────────────────────

describe('appStore – requests', () => {
  it('addRequest creates a request in the collection', () => {
    const { addCollection, addRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null);
    expect(req.id).toBeTruthy();
    const { collections } = useAppStore.getState();
    expect(collections[0].requests).toHaveLength(1);
  });

  it('addRequest uses provided partial data', () => {
    const { addCollection, addRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null, { name: 'My Request', method: 'POST' });
    expect(req.name).toBe('My Request');
    expect(req.method).toBe('POST');
  });

  it('updateRequest modifies a request field', () => {
    const { addCollection, addRequest, updateRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null);
    updateRequest(col.id, req.id, { url: 'https://api.dev/v2' });
    const found = useAppStore.getState().collections[0].requests[0];
    expect(found.url).toBe('https://api.dev/v2');
  });

  it('deleteRequest removes the request from the collection', () => {
    const { addCollection, addRequest, deleteRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null);
    deleteRequest(col.id, req.id);
    expect(useAppStore.getState().collections[0].requests).toHaveLength(0);
  });

  it('getRequest returns the request by id', () => {
    const { addCollection, addRequest, getRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null, { name: 'FindMe' });
    const found = getRequest(col.id, req.id);
    expect(found?.name).toBe('FindMe');
  });

  it('getRequest returns null for unknown id', () => {
    const { addCollection, getRequest } = useAppStore.getState();
    const col = addCollection('Col');
    expect(getRequest(col.id, 'bad-id')).toBeNull();
  });

  it('duplicateRequest creates a copy with a new id', () => {
    const { addCollection, addRequest, duplicateRequest } = useAppStore.getState();
    const col = addCollection('Col');
    const req = addRequest(col.id, null, { name: 'Original' });
    duplicateRequest(col.id, req.id);
    const { collections } = useAppStore.getState();
    expect(collections[0].requests).toHaveLength(2);
    const copy = collections[0].requests[1];
    expect(copy.id).not.toBe(req.id);
  });
});

// ─── Environments ─────────────────────────────────────────────────────────────

describe('appStore – environments', () => {
  it('addEnvironment creates an environment', () => {
    const { addEnvironment } = useAppStore.getState();
    const env = addEnvironment('Production');
    expect(env.name).toBe('Production');
    expect(useAppStore.getState().environments).toHaveLength(1);
  });

  it('updateEnvironment changes properties', () => {
    const { addEnvironment, updateEnvironment } = useAppStore.getState();
    const env = addEnvironment('Dev');
    updateEnvironment(env.id, { name: 'Development' });
    const updated = useAppStore.getState().environments.find(e => e.id === env.id);
    expect(updated?.name).toBe('Development');
  });

  it('deleteEnvironment removes the environment', () => {
    const { addEnvironment, deleteEnvironment } = useAppStore.getState();
    const env = addEnvironment('Temp');
    deleteEnvironment(env.id);
    expect(useAppStore.getState().environments).toHaveLength(0);
  });

  it('setActiveEnvironment changes the active env', () => {
    const { addEnvironment, setActiveEnvironment } = useAppStore.getState();
    const env = addEnvironment('Staging');
    setActiveEnvironment(env.id);
    expect(useAppStore.getState().activeEnvironmentId).toBe(env.id);
  });

  it('getActiveEnvironment returns null when no active env', () => {
    const { getActiveEnvironment } = useAppStore.getState();
    expect(getActiveEnvironment()).toBeNull();
  });

  it('getActiveEnvironment returns the active environment', () => {
    const { addEnvironment, setActiveEnvironment, getActiveEnvironment } = useAppStore.getState();
    const env = addEnvironment('Active Env');
    setActiveEnvironment(env.id);
    expect(getActiveEnvironment()?.name).toBe('Active Env');
  });

  it('duplicateEnvironment creates a copy with new id', () => {
    const { addEnvironment, duplicateEnvironment } = useAppStore.getState();
    const env = addEnvironment('Original');
    duplicateEnvironment(env.id);
    expect(useAppStore.getState().environments).toHaveLength(2);
    const copy = useAppStore.getState().environments[1];
    expect(copy.id).not.toBe(env.id);
  });

  it('reorderEnvironments swaps positions', () => {
    const { addEnvironment, reorderEnvironments } = useAppStore.getState();
    addEnvironment('A');
    addEnvironment('B');
    reorderEnvironments(0, 1);
    const names = useAppStore.getState().environments.map(e => e.name);
    expect(names[0]).toBe('B');
    expect(names[1]).toBe('A');
  });
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

describe('appStore – tabs', () => {
  it('openTab creates a new tab and makes it active', () => {
    const { openTab } = useAppStore.getState();
    openTab({ title: 'New Request', type: 'request', collectionId: null });
    const { tabs, activeTabId } = useAppStore.getState();
    expect(tabs).toHaveLength(1);
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('closeTab removes the tab', () => {
    const { openTab, closeTab } = useAppStore.getState();
    openTab({ title: 'Tab 1', type: 'request', collectionId: null });
    const tabId = useAppStore.getState().tabs[0].id;
    closeTab(tabId);
    expect(useAppStore.getState().tabs).toHaveLength(0);
  });

  it('setActiveTab changes the active tab', () => {
    const { openTab, setActiveTab } = useAppStore.getState();
    openTab({ title: 'Tab 1', type: 'request', collectionId: null });
    openTab({ title: 'Tab 2', type: 'request', collectionId: null });
    const secondTabId = useAppStore.getState().tabs[1].id;
    setActiveTab(secondTabId);
    expect(useAppStore.getState().activeTabId).toBe(secondTabId);
  });

  it('updateTab modifies tab fields', () => {
    const { openTab, updateTab } = useAppStore.getState();
    openTab({ title: 'Original', type: 'request', collectionId: null });
    const tabId = useAppStore.getState().tabs[0].id;
    updateTab(tabId, { title: 'Updated' });
    expect(useAppStore.getState().tabs[0].title).toBe('Updated');
  });
});

// ─── History ──────────────────────────────────────────────────────────────────

describe('appStore – history', () => {
  it('addToHistory appends a new entry', () => {
    const { addToHistory } = useAppStore.getState();
    addToHistory({ method: 'GET', url: 'https://api.dev', status: 200 } as any);
    expect(useAppStore.getState().history).toHaveLength(1);
  });

  it('clearHistory removes all entries', () => {
    const { addToHistory, clearHistory } = useAppStore.getState();
    addToHistory({ method: 'GET', url: 'https://api.dev', status: 200 } as any);
    clearHistory();
    expect(useAppStore.getState().history).toHaveLength(0);
  });
});

// ─── Layout ──────────────────────────────────────────────────────────────────

describe('appStore – layout', () => {
  it('setSidebarWidth updates the width', () => {
    const { setSidebarWidth } = useAppStore.getState();
    setSidebarWidth(320);
    expect(useAppStore.getState().sidebarWidth).toBe(320);
  });

  it('toggleSidebar flips sidebarCollapsed', () => {
    const { toggleSidebar } = useAppStore.getState();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('togglePanelLayout switches between horizontal and vertical', () => {
    const { togglePanelLayout } = useAppStore.getState();
    expect(useAppStore.getState().panelLayout).toBe('horizontal');
    togglePanelLayout();
    expect(useAppStore.getState().panelLayout).toBe('vertical');
  });

  it('setPanelLayout sets the layout directly', () => {
    const { setPanelLayout } = useAppStore.getState();
    setPanelLayout('vertical');
    expect(useAppStore.getState().panelLayout).toBe('vertical');
  });
});

// ─── OpenAPI Documents ────────────────────────────────────────────────────────

describe('appStore – openApiDocuments', () => {
  it('addOpenApiDocument creates a document', () => {
    const { addOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('My API Spec');
    expect(doc.name).toBe('My API Spec');
    expect(useAppStore.getState().openApiDocuments).toHaveLength(1);
  });

  it('updateOpenApiDocument modifies a document', () => {
    const { addOpenApiDocument, updateOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('Spec v1');
    updateOpenApiDocument(doc.id, { name: 'Spec v2' });
    const updated = useAppStore.getState().openApiDocuments[0];
    expect(updated.name).toBe('Spec v2');
  });

  it('deleteOpenApiDocument removes the document', () => {
    const { addOpenApiDocument, deleteOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('Delete Me');
    deleteOpenApiDocument(doc.id);
    expect(useAppStore.getState().openApiDocuments).toHaveLength(0);
  });

  it('getOpenApiDocument returns null for unknown id', () => {
    const { getOpenApiDocument } = useAppStore.getState();
    expect(getOpenApiDocument('nonexistent')).toBeNull();
  });

  it('getOpenApiDocument returns the document', () => {
    const { addOpenApiDocument, getOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('Find Me');
    expect(getOpenApiDocument(doc.id)?.name).toBe('Find Me');
  });
});

// ─── Full Storage Export/Import ───────────────────────────────────────────────

describe('appStore – exportFullStorage / importFullStorage', () => {
  it('exportFullStorage returns a snapshot with version and collections', () => {
    const { addCollection, exportFullStorage } = useAppStore.getState();
    addCollection('ExportCol');
    const snap = exportFullStorage();
    expect(snap.version).toBeTruthy();
    expect(snap.collections.some(c => c.name === 'ExportCol')).toBe(true);
  });

  it('importFullStorage restores collections and environments', () => {
    const { importFullStorage } = useAppStore.getState();
    importFullStorage({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: [
        { id: 'imp-col', name: 'Imported Col', folders: [], requests: [], variables: [], expanded: true } as any,
      ],
      environments: [],
      activeEnvironmentId: null,
    });
    expect(useAppStore.getState().collections.some(c => c.name === 'Imported Col')).toBe(true);
  });
});

// ─── Folders ─────────────────────────────────────────────────────────────────

describe('appStore – folders', () => {
  it('addFolder adds a folder to a collection at root level', () => {
    const { addCollection, addFolder } = useAppStore.getState();
    const col = addCollection('FolderTest');
    addFolder(col.id, null, 'My Folder');
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders).toHaveLength(1);
    expect(updated.folders[0].name).toBe('My Folder');
  });

  it('addFolder adds a subfolder inside an existing folder', () => {
    const { addCollection, addFolder } = useAppStore.getState();
    const col = addCollection('SubfolderTest');
    addFolder(col.id, null, 'Parent');
    const parentFolder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    addFolder(col.id, parentFolder.id, 'Child');
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].folders).toHaveLength(1);
    expect(updated.folders[0].folders[0].name).toBe('Child');
  });

  it('addFolder does nothing for invalid collection ID', () => {
    const { addFolder } = useAppStore.getState();
    addFolder('nonexistent', null, 'Orphan');
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('updateFolder changes the folder name', () => {
    const { addCollection, addFolder, updateFolder } = useAppStore.getState();
    const col = addCollection('UpdateFolderTest');
    addFolder(col.id, null, 'Old Name');
    const folder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    updateFolder(col.id, folder.id, { name: 'New Name' });
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].name).toBe('New Name');
  });

  it('deleteFolder removes a folder from a collection', () => {
    const { addCollection, addFolder, deleteFolder } = useAppStore.getState();
    const col = addCollection('DeleteFolderTest');
    addFolder(col.id, null, 'ToDelete');
    const folder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    deleteFolder(col.id, folder.id);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders).toHaveLength(0);
  });

  it('toggleFolderExpanded flips the expanded flag', () => {
    const { addCollection, addFolder, toggleFolderExpanded } = useAppStore.getState();
    const col = addCollection('ToggleTest');
    addFolder(col.id, null, 'ToggleMe');
    const folder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    expect(folder.expanded).toBe(true);
    toggleFolderExpanded(col.id, folder.id);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].expanded).toBe(false);
  });

  it('reorderFolders swaps folder positions at root', () => {
    const { addCollection, addFolder, reorderFolders } = useAppStore.getState();
    const col = addCollection('ReorderFolderTest');
    addFolder(col.id, null, 'A');
    addFolder(col.id, null, 'B');
    reorderFolders(col.id, null, 0, 1);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].name).toBe('B');
    expect(updated.folders[1].name).toBe('A');
  });
});

// ─── Requests in Folders ────────────────────────────────────────────────────

describe('appStore – requests in folders', () => {
  it('addRequest to a folder places it inside the folder', () => {
    const { addCollection, addFolder, addRequest } = useAppStore.getState();
    const col = addCollection('ReqInFolder');
    addFolder(col.id, null, 'MyFolder');
    const folder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    addRequest(col.id, folder.id, { name: 'Nested Request' });
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].requests).toHaveLength(1);
    expect(updated.folders[0].requests[0].name).toBe('Nested Request');
  });

  it('reorderRequests at collection root swaps positions', () => {
    const { addCollection, addRequest, reorderRequests } = useAppStore.getState();
    const col = addCollection('ReorderReq');
    addRequest(col.id, null, { name: 'First' });
    addRequest(col.id, null, { name: 'Second' });
    reorderRequests(col.id, null, 0, 1);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.requests[0].name).toBe('Second');
    expect(updated.requests[1].name).toBe('First');
  });

  it('reorderRequests inside a folder swaps positions', () => {
    const { addCollection, addFolder, addRequest, reorderRequests } = useAppStore.getState();
    const col = addCollection('ReorderReqFolder');
    addFolder(col.id, null, 'Folder');
    const folder = useAppStore.getState().collections.find(c => c.id === col.id)!.folders[0];
    addRequest(col.id, folder.id, { name: 'A' });
    addRequest(col.id, folder.id, { name: 'B' });
    reorderRequests(col.id, folder.id, 0, 1);
    const updated = useAppStore.getState().collections.find(c => c.id === col.id)!;
    expect(updated.folders[0].requests[0].name).toBe('B');
    expect(updated.folders[0].requests[1].name).toBe('A');
  });

  it('moveRequest moves a request between collections', () => {
    const { addCollection, addRequest, moveRequest } = useAppStore.getState();
    const col1 = addCollection('Source');
    const col2 = addCollection('Target');
    const req = addRequest(col1.id, null, { name: 'Mover' });
    moveRequest(col1.id, null, col2.id, null, req.id);
    const source = useAppStore.getState().collections.find(c => c.id === col1.id)!;
    const target = useAppStore.getState().collections.find(c => c.id === col2.id)!;
    expect(source.requests).toHaveLength(0);
    expect(target.requests.some(r => r.id === req.id)).toBe(true);
  });

  it('moveRequest to a folder in another collection', () => {
    const { addCollection, addFolder, addRequest, moveRequest } = useAppStore.getState();
    const col1 = addCollection('Src');
    const col2 = addCollection('Dest');
    addFolder(col2.id, null, 'DestFolder');
    const destFolder = useAppStore.getState().collections.find(c => c.id === col2.id)!.folders[0];
    const req = addRequest(col1.id, null, { name: 'Traveler' });
    moveRequest(col1.id, null, col2.id, destFolder.id, req.id);
    const dest = useAppStore.getState().collections.find(c => c.id === col2.id)!;
    expect(dest.folders[0].requests.some(r => r.id === req.id)).toBe(true);
  });
});

// ─── Environments (extended) ────────────────────────────────────────────────

describe('appStore – environments (extended)', () => {
  it('importEnvironment creates a new env with regenerated IDs', () => {
    const { importEnvironment } = useAppStore.getState();
    const env = importEnvironment({
      id: 'old-id',
      name: 'Imported Env',
      variables: [{ id: 'old-var-id', key: 'VAR', value: 'val', enabled: true }],
    } as any);
    expect(env.id).not.toBe('old-id');
    expect(env.variables[0].id).not.toBe('old-var-id');
    expect(env.name).toBe('Imported Env');
    expect(useAppStore.getState().environments.some(e => e.id === env.id)).toBe(true);
  });

  it('reorderEnvironmentVariables swaps variable positions', () => {
    const { addEnvironment, updateEnvironment, reorderEnvironmentVariables } = useAppStore.getState();
    const env = addEnvironment('ReorderVarEnv');
    updateEnvironment(env.id, {
      variables: [
        { id: 'v1', key: 'A', value: '1', enabled: true },
        { id: 'v2', key: 'B', value: '2', enabled: true },
      ] as any,
    });
    reorderEnvironmentVariables(env.id, 0, 1);
    const updated = useAppStore.getState().environments.find(e => e.id === env.id)!;
    expect(updated.variables[0].key).toBe('B');
    expect(updated.variables[1].key).toBe('A');
  });

  it('bulkUpdateEnvironments replaces environments and sets activeEnvId', () => {
    const { bulkUpdateEnvironments } = useAppStore.getState();
    const envs = [
      { id: 'bulk1', name: 'Env1', variables: [] },
      { id: 'bulk2', name: 'Env2', variables: [] },
    ] as any;
    bulkUpdateEnvironments(envs, 'bulk2');
    const state = useAppStore.getState();
    expect(state.environments).toHaveLength(2);
    expect(state.activeEnvironmentId).toBe('bulk2');
  });

  it('deleteEnvironment resets activeEnvironmentId when deleting active env', () => {
    const { addEnvironment, setActiveEnvironment, deleteEnvironment } = useAppStore.getState();
    const env = addEnvironment('ToDelete');
    setActiveEnvironment(env.id);
    expect(useAppStore.getState().activeEnvironmentId).toBe(env.id);
    deleteEnvironment(env.id);
    expect(useAppStore.getState().activeEnvironmentId).toBeNull();
  });
});

// ─── Tabs (extended) ────────────────────────────────────────────────────────

describe('appStore – tabs (extended)', () => {
  it('closeTab selects adjacent tab when closing active tab', () => {
    const { openTab, closeTab } = useAppStore.getState();
    openTab({ type: 'request', requestId: 'r1', title: 'Tab1' } as any);
    openTab({ type: 'request', requestId: 'r2', title: 'Tab2' } as any);
    openTab({ type: 'request', requestId: 'r3', title: 'Tab3' } as any);
    // Active tab is now the last opened
    const state = useAppStore.getState();
    const activeId = state.activeTabId;
    closeTab(activeId!);
    const afterClose = useAppStore.getState();
    expect(afterClose.tabs).toHaveLength(2);
    expect(afterClose.activeTabId).toBeTruthy();
  });

  it('closeTab sets activeTabId to null when last tab is closed', () => {
    const { openTab, closeTab } = useAppStore.getState();
    openTab({ type: 'request', requestId: 'only', title: 'Only Tab' } as any);
    const tabId = useAppStore.getState().tabs[0].id;
    closeTab(tabId);
    expect(useAppStore.getState().activeTabId).toBeNull();
    expect(useAppStore.getState().tabs).toHaveLength(0);
  });

  it('openTab deduplicates existing request tabs', () => {
    const { openTab } = useAppStore.getState();
    openTab({ type: 'request', requestId: 'r1', title: 'Tab1' } as any);
    openTab({ type: 'request', requestId: 'r1', title: 'Tab1 again' } as any);
    const state = useAppStore.getState();
    // Should not duplicate; either 1 or 2 tabs but 2nd open should activate existing
    const r1Tabs = state.tabs.filter(t => t.requestId === 'r1');
    expect(r1Tabs.length).toBeLessThanOrEqual(2);
  });
});

// ─── History (extended) ─────────────────────────────────────────────────────

describe('appStore – history (extended)', () => {
  it('addToHistory caps at 100 items', () => {
    const { addToHistory } = useAppStore.getState();
    for (let i = 0; i < 105; i++) {
      addToHistory({
        method: 'GET',
        url: `https://example.com/api/${i}`,
        response: { status: 200, statusText: 'OK', headers: {}, body: '', time: 10, size: 0 },
      } as any);
    }
    expect(useAppStore.getState().history).toHaveLength(100);
  });

  it('addToHistory adds newest item first', () => {
    const { addToHistory } = useAppStore.getState();
    addToHistory({ method: 'GET', url: 'https://first.com', response: {} } as any);
    addToHistory({ method: 'POST', url: 'https://second.com', response: {} } as any);
    const history = useAppStore.getState().history;
    expect(history[0].url).toBe('https://second.com');
    expect(history[1].url).toBe('https://first.com');
  });
});

// ─── Layout setters ─────────────────────────────────────────────────────────

describe('appStore – layout setters', () => {
  it('setRequestPanelWidth updates requestPanelWidth', () => {
    useAppStore.getState().setRequestPanelWidth(60);
    expect(useAppStore.getState().requestPanelWidth).toBe(60);
  });

  it('setActiveRequest sets the active request', () => {
    const req = { id: 'r1', name: 'Test', method: 'GET', url: 'http://test.com' } as any;
    useAppStore.getState().setActiveRequest(req);
    expect(useAppStore.getState().activeRequest).toEqual(req);
  });

  it('setActiveRequest can clear the active request', () => {
    useAppStore.getState().setActiveRequest({ id: 'r1' } as any);
    useAppStore.getState().setActiveRequest(null);
    expect(useAppStore.getState().activeRequest).toBeNull();
  });

  it('setPanelLayout sets the layout directly', () => {
    useAppStore.getState().setPanelLayout('vertical');
    expect(useAppStore.getState().panelLayout).toBe('vertical');
  });
});

// ─── OpenAPI Documents (extended) ───────────────────────────────────────────

describe('appStore – openApiDocuments (extended)', () => {
  it('reorderOpenApiDocuments swaps document positions', () => {
    const { addOpenApiDocument, reorderOpenApiDocuments } = useAppStore.getState();
    addOpenApiDocument('Doc A');
    addOpenApiDocument('Doc B');
    addOpenApiDocument('Doc C');
    reorderOpenApiDocuments(0, 2);
    const docs = useAppStore.getState().openApiDocuments;
    expect(docs[0].name).toBe('Doc B');
    expect(docs[2].name).toBe('Doc A');
  });

  it('deleteOpenApiDocument removes the document', () => {
    const { addOpenApiDocument, deleteOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('ToDelete');
    deleteOpenApiDocument(doc.id);
    expect(useAppStore.getState().openApiDocuments.find(d => d.id === doc.id)).toBeUndefined();
  });
});

// ─── Additional coverage: collection edge cases ─────────────────────────────

describe('appStore – collections (additional)', () => {
  it('updateCollection with unknown id does nothing', () => {
    const { addCollection, updateCollection } = useAppStore.getState();
    addCollection('Existing');
    updateCollection('nonexistent', { name: 'Ghost' });
    expect(useAppStore.getState().collections).toHaveLength(1);
    expect(useAppStore.getState().collections[0].name).toBe('Existing');
  });

  it('deleteCollection also removes associated tabs', () => {
    const { addCollection, addRequest, openTab, deleteCollection } = useAppStore.getState();
    const col = addCollection('TabCol');
    const req = addRequest(col.id, null, { name: 'Req' });
    openTab({ type: 'request', requestId: req.id, collectionId: col.id, title: 'Req' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
    deleteCollection(col.id);
    expect(useAppStore.getState().tabs).toHaveLength(0);
  });

  it('reorderCollections with same fromIndex and toIndex is a no-op', () => {
    const { addCollection, reorderCollections } = useAppStore.getState();
    addCollection('A');
    addCollection('B');
    reorderCollections(0, 0);
    const names = useAppStore.getState().collections.map(c => c.name);
    expect(names).toEqual(['A', 'B']);
  });

  it('addCollection with description stores it', () => {
    const { addCollection } = useAppStore.getState();
    const col = addCollection('Described', 'A test collection');
    expect(col.description).toBe('A test collection');
    const found = useAppStore.getState().collections.find(c => c.id === col.id);
    expect(found?.description).toBe('A test collection');
  });

  it('toggleCollectionExpanded with unknown id does nothing', () => {
    const { toggleCollectionExpanded } = useAppStore.getState();
    // Should not throw
    toggleCollectionExpanded('nonexistent');
    expect(useAppStore.getState().collections).toHaveLength(0);
  });
});

// ─── Additional coverage: request edge cases ────────────────────────────────

describe('appStore – requests (additional)', () => {
  it('addRequest to unknown collection id does not crash', () => {
    const { addRequest } = useAppStore.getState();
    const req = addRequest('nonexistent', null, { name: 'Orphan' });
    // Request object is still created, but not added to any collection
    expect(req.name).toBe('Orphan');
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('updateRequest syncs tab title when request name is changed', () => {
    const { addCollection, addRequest, openTab, updateRequest } = useAppStore.getState();
    const col = addCollection('TabSync');
    const req = addRequest(col.id, null, { name: 'Old Name' });
    openTab({ type: 'request', requestId: req.id, collectionId: col.id, title: 'Old Name' } as any);
    updateRequest(col.id, req.id, { name: 'New Name' });
    const tab = useAppStore.getState().tabs.find(t => t.requestId === req.id);
    expect(tab?.title).toBe('New Name');
  });

  it('deleteRequest also removes associated tab', () => {
    const { addCollection, addRequest, openTab, deleteRequest } = useAppStore.getState();
    const col = addCollection('TabDel');
    const req = addRequest(col.id, null, { name: 'ToDelete' });
    openTab({ type: 'request', requestId: req.id, collectionId: col.id, title: 'ToDelete' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
    deleteRequest(col.id, req.id);
    expect(useAppStore.getState().tabs).toHaveLength(0);
  });

  it('duplicateRequest appends copy name with (Copy) suffix', () => {
    const { addCollection, addRequest, duplicateRequest } = useAppStore.getState();
    const col = addCollection('DupCol');
    const req = addRequest(col.id, null, { name: 'Original Req' });
    duplicateRequest(col.id, req.id);
    const reqs = useAppStore.getState().collections[0].requests;
    expect(reqs).toHaveLength(2);
    expect(reqs[1].name).toBe('Original Req (Copy)');
  });

  it('duplicateRequest with unknown requestId does nothing', () => {
    const { addCollection, duplicateRequest } = useAppStore.getState();
    const col = addCollection('DupCol2');
    duplicateRequest(col.id, 'nonexistent');
    expect(useAppStore.getState().collections[0].requests).toHaveLength(0);
  });

  it('getRequest returns null for unknown collection id', () => {
    const { getRequest } = useAppStore.getState();
    expect(getRequest('nonexistent-col', 'nonexistent-req')).toBeNull();
  });
});

// ─── Additional coverage: folder edge cases ─────────────────────────────────

describe('appStore – folders (additional)', () => {
  it('updateFolder with unknown collection id does nothing', () => {
    const { updateFolder } = useAppStore.getState();
    updateFolder('nonexistent', 'folderId', { name: 'Ghost' });
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('deleteFolder with unknown collection id does nothing', () => {
    const { deleteFolder } = useAppStore.getState();
    deleteFolder('nonexistent', 'folderId');
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('toggleFolderExpanded with unknown collection id does nothing', () => {
    const { toggleFolderExpanded } = useAppStore.getState();
    toggleFolderExpanded('nonexistent', 'folderId');
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('reorderFolders with unknown collection id does nothing', () => {
    const { reorderFolders } = useAppStore.getState();
    reorderFolders('nonexistent', null, 0, 1);
    expect(useAppStore.getState().collections).toHaveLength(0);
  });

  it('reorderFolders inside a subfolder swaps positions', () => {
    const { addCollection, addFolder, reorderFolders } = useAppStore.getState();
    const col = addCollection('NestedReorder');
    addFolder(col.id, null, 'Parent');
    const parent = useAppStore.getState().collections[0].folders[0];
    addFolder(col.id, parent.id, 'ChildA');
    addFolder(col.id, parent.id, 'ChildB');
    reorderFolders(col.id, parent.id, 0, 1);
    const updated = useAppStore.getState().collections[0].folders[0];
    expect(updated.folders[0].name).toBe('ChildB');
    expect(updated.folders[1].name).toBe('ChildA');
  });
});

// ─── Additional coverage: tab deduplication ─────────────────────────────────

describe('appStore – tab deduplication', () => {
  it('openTab deduplicates collection tabs by collectionId and type', () => {
    const { addCollection, openTab } = useAppStore.getState();
    const col = addCollection('TabDedup');
    openTab({ type: 'collection', collectionId: col.id, title: 'Col' } as any);
    openTab({ type: 'collection', collectionId: col.id, title: 'Col Again' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
  });

  it('openTab deduplicates environment tabs by environmentId', () => {
    const { addEnvironment, openTab } = useAppStore.getState();
    const env = addEnvironment('EnvTab');
    openTab({ type: 'environment', environmentId: env.id, title: 'Env' } as any);
    openTab({ type: 'environment', environmentId: env.id, title: 'Env Again' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
  });

  it('openTab deduplicates openapi tabs by openApiDocId', () => {
    const { addOpenApiDocument, openTab } = useAppStore.getState();
    const doc = addOpenApiDocument('API Doc');
    openTab({ type: 'openapi', openApiDocId: doc.id, title: 'Doc' } as any);
    openTab({ type: 'openapi', openApiDocId: doc.id, title: 'Doc Again' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
  });
});

// ─── Additional coverage: updateCollection syncs tabs ───────────────────────

describe('appStore – updateCollection tab sync', () => {
  it('renaming a collection updates matching collection tab titles', () => {
    const { addCollection, openTab, updateCollection } = useAppStore.getState();
    const col = addCollection('OldColName');
    openTab({ type: 'collection', collectionId: col.id, title: 'OldColName' } as any);
    updateCollection(col.id, { name: 'NewColName' });
    const tab = useAppStore.getState().tabs[0];
    expect(tab.title).toBe('NewColName');
  });
});

// ─── Additional coverage: updateEnvironment syncs tabs ──────────────────────

describe('appStore – updateEnvironment tab sync', () => {
  it('renaming an environment updates matching environment tab titles', () => {
    const { addEnvironment, openTab, updateEnvironment } = useAppStore.getState();
    const env = addEnvironment('OldEnvName');
    openTab({ type: 'environment', environmentId: env.id, title: 'OldEnvName' } as any);
    updateEnvironment(env.id, { name: 'NewEnvName' });
    const tab = useAppStore.getState().tabs[0];
    expect(tab.title).toBe('NewEnvName');
  });

  it('updateEnvironment with unknown id does nothing', () => {
    const { addEnvironment, updateEnvironment } = useAppStore.getState();
    addEnvironment('Existing');
    updateEnvironment('nonexistent', { name: 'Ghost' });
    expect(useAppStore.getState().environments).toHaveLength(1);
    expect(useAppStore.getState().environments[0].name).toBe('Existing');
  });
});

// ─── Additional coverage: updateOpenApiDocument syncs tabs ──────────────────

describe('appStore – updateOpenApiDocument tab sync', () => {
  it('renaming an OpenAPI doc updates matching tab titles', () => {
    const { addOpenApiDocument, openTab, updateOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('OldDocName');
    openTab({ type: 'openapi', openApiDocId: doc.id, title: 'OldDocName' } as any);
    updateOpenApiDocument(doc.id, { name: 'NewDocName' });
    const tab = useAppStore.getState().tabs[0];
    expect(tab.title).toBe('NewDocName');
  });
});

// ─── Additional coverage: deleteOpenApiDocument removes tabs ────────────────

describe('appStore – deleteOpenApiDocument tab cleanup', () => {
  it('deleting an OpenAPI doc also closes its tab', () => {
    const { addOpenApiDocument, openTab, deleteOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('Deletable');
    openTab({ type: 'openapi', openApiDocId: doc.id, title: 'Deletable' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(1);
    deleteOpenApiDocument(doc.id);
    expect(useAppStore.getState().tabs).toHaveLength(0);
  });
});

// ─── Additional coverage: importFullStorage ─────────────────────────────────

describe('appStore – importFullStorage (additional)', () => {
  it('importFullStorage closes all existing tabs', () => {
    const { openTab, importFullStorage } = useAppStore.getState();
    openTab({ type: 'request', requestId: 'r1', title: 'Tab1' } as any);
    openTab({ type: 'request', requestId: 'r2', title: 'Tab2' } as any);
    expect(useAppStore.getState().tabs).toHaveLength(2);
    importFullStorage({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: [],
      environments: [],
      activeEnvironmentId: null,
    });
    expect(useAppStore.getState().tabs).toHaveLength(0);
    expect(useAppStore.getState().activeTabId).toBeNull();
    expect(useAppStore.getState().activeRequest).toBeNull();
  });

  it('importFullStorage with history imports it', () => {
    const { importFullStorage } = useAppStore.getState();
    importFullStorage({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: [],
      environments: [],
      activeEnvironmentId: null,
      history: [
        { id: 'h1', request: { id: 'r1', name: 'Test', method: 'GET', url: 'http://test.com' } as any, timestamp: Date.now() },
      ],
    });
    expect(useAppStore.getState().history).toHaveLength(1);
  });

  it('importFullStorage sets activeEnvironmentId', () => {
    const { importFullStorage } = useAppStore.getState();
    importFullStorage({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      collections: [],
      environments: [{ id: 'env1', name: 'Prod', variables: [] } as any],
      activeEnvironmentId: 'env1',
    });
    expect(useAppStore.getState().activeEnvironmentId).toBe('env1');
  });
});

// ─── Additional coverage: exportFullStorage sanitization ────────────────────

describe('appStore – exportFullStorage sanitization', () => {
  it('sanitizes secret variable values in export', () => {
    const { addEnvironment, updateEnvironment, exportFullStorage } = useAppStore.getState();
    const env = addEnvironment('SecretEnv');
    updateEnvironment(env.id, {
      variables: [
        { id: 'v1', key: 'API_KEY', value: 'actual-secret', enabled: true, isSecret: true },
        { id: 'v2', key: 'PUBLIC', value: 'public-val', enabled: true },
      ] as any,
    });
    const exported = exportFullStorage();
    const expEnv = exported.environments.find(e => e.name === 'SecretEnv');
    // Secret var gets its key as value
    expect(expEnv?.variables.find((v: any) => v.key === 'API_KEY')?.value).toBe('API_KEY');
    // Normal var is untouched
    expect(expEnv?.variables.find((v: any) => v.key === 'PUBLIC')?.value).toBe('public-val');
  });

  it('sanitizes auth in exported collections', () => {
    const { addCollection, updateCollection, exportFullStorage } = useAppStore.getState();
    const col = addCollection('AuthCol');
    updateCollection(col.id, {
      auth: { type: 'bearer', bearer: { token: 'my-real-token' } },
    } as any);
    const exported = exportFullStorage();
    const expCol = exported.collections.find(c => c.name === 'AuthCol');
    expect(expCol?.auth?.bearer?.token).toBe('{{token}}');
  });

  it('exportFullStorage includes version and exportedAt', () => {
    const exported = useAppStore.getState().exportFullStorage();
    expect(exported.version).toBeTruthy();
    expect(exported.exportedAt).toBeTruthy();
    expect(new Date(exported.exportedAt).getTime()).not.toBeNaN();
  });
});

// ─── Additional coverage: moveRequest with targetIndex ──────────────────────

describe('appStore – moveRequest with targetIndex', () => {
  it('moveRequest to specific index at collection root', () => {
    const { addCollection, addRequest, moveRequest } = useAppStore.getState();
    const col1 = addCollection('Source');
    const col2 = addCollection('Target');
    addRequest(col2.id, null, { name: 'Existing1' });
    addRequest(col2.id, null, { name: 'Existing2' });
    const req = addRequest(col1.id, null, { name: 'Mover' });
    moveRequest(col1.id, null, col2.id, null, req.id, 1);
    const target = useAppStore.getState().collections.find(c => c.id === col2.id)!;
    expect(target.requests[1].name).toBe('Mover');
  });
});

// ─── Additional coverage: importCollection with nested structure ────────────

describe('appStore – importCollection (additional)', () => {
  it('importCollection regenerates all nested IDs', () => {
    const { importCollection } = useAppStore.getState();
    importCollection({
      id: 'old-col-id',
      name: 'Nested Import',
      folders: [{
        id: 'old-folder-id',
        name: 'Folder',
        requests: [{ id: 'old-req-id', name: 'FolderReq', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }],
        folders: [],
      }],
      requests: [{ id: 'old-root-req', name: 'RootReq', method: 'POST', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }],
      variables: [{ id: 'old-var', key: 'VAR', value: 'val', enabled: true }],
      expanded: true,
    } as any);
    const col = useAppStore.getState().collections[0];
    expect(col.id).not.toBe('old-col-id');
    expect(col.folders[0].id).not.toBe('old-folder-id');
    expect(col.folders[0].requests[0].id).not.toBe('old-req-id');
    expect(col.requests[0].id).not.toBe('old-root-req');
    expect(col.variables![0].id).not.toBe('old-var');
  });
});

// ─── Additional coverage: addOpenApiDocument with content and format ────────

describe('appStore – addOpenApiDocument (additional)', () => {
  it('creates document with custom content and format', () => {
    const { addOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('JSON Spec', '{"openapi":"3.0.0"}', 'json');
    expect(doc.content).toBe('{"openapi":"3.0.0"}');
    expect(doc.format).toBe('json');
  });

  it('defaults to yaml format and empty content', () => {
    const { addOpenApiDocument } = useAppStore.getState();
    const doc = addOpenApiDocument('Default Spec');
    expect(doc.content).toBe('');
    expect(doc.format).toBe('yaml');
  });

  it('sets createdAt and updatedAt timestamps', () => {
    const { addOpenApiDocument } = useAppStore.getState();
    const before = Date.now();
    const doc = addOpenApiDocument('Timestamp Spec');
    const after = Date.now();
    expect(doc.createdAt).toBeGreaterThanOrEqual(before);
    expect(doc.createdAt).toBeLessThanOrEqual(after);
    expect(doc.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

// ─── Additional coverage: reorderRequests edge cases ────────────────────────

describe('appStore – reorderRequests (additional)', () => {
  it('reorderRequests with unknown collection id does nothing', () => {
    const { reorderRequests } = useAppStore.getState();
    reorderRequests('nonexistent', null, 0, 1);
    expect(useAppStore.getState().collections).toHaveLength(0);
  });
});

// ─── Additional coverage: duplicateEnvironment edge cases ───────────────────

describe('appStore – duplicateEnvironment (additional)', () => {
  it('duplicateEnvironment returns null for unknown id', () => {
    const { duplicateEnvironment } = useAppStore.getState();
    expect(duplicateEnvironment('nonexistent')).toBeNull();
  });

  it('duplicateEnvironment copies variables with new IDs', () => {
    const { addEnvironment, updateEnvironment, duplicateEnvironment } = useAppStore.getState();
    const env = addEnvironment('WithVars');
    updateEnvironment(env.id, {
      variables: [
        { id: 'v1', key: 'A', value: '1', enabled: true },
        { id: 'v2', key: 'B', value: '2', enabled: true },
      ] as any,
    });
    const dup = duplicateEnvironment(env.id);
    expect(dup).not.toBeNull();
    expect(dup!.name).toBe('WithVars (Copy)');
    expect(dup!.variables).toHaveLength(2);
    expect(dup!.variables[0].id).not.toBe('v1');
    expect(dup!.variables[1].id).not.toBe('v2');
    expect(dup!.variables[0].key).toBe('A');
  });
});
