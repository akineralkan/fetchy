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
