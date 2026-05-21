// @vitest-environment jsdom

/**
 * GH-73 Fix 1: SidebarContextMenu – recursive "Move to" destinations
 *
 * The "Move to" submenu for requests now:
 * - Recursively collects all collection roots AND nested folders
 * - Shows destinations even with a single collection (when folders exist)
 * - Excludes the current parent from the destination list
 * - Applies depth-based indentation (paddingLeft)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SidebarContextMenu from '../../../src/components/sidebar/SidebarContextMenu';
import { useAppStore } from '../../../src/store/appStore';
import type { ContextMenuState } from '../../../src/components/sidebar/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../../src/utils/helpers', () => ({
  exportToPostman: vi.fn(() => JSON.stringify({ info: { name: 'Test' } })),
}));

if (typeof URL.createObjectURL === 'undefined') {
  (URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
  (URL as any).revokeObjectURL = vi.fn();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUseAppStore = useAppStore as ReturnType<typeof vi.fn>;

function makeRequest(id: string, name = 'Request') {
  return {
    id,
    name,
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
  };
}

function makeFolder(id: string, name: string, folders: any[] = [], requests: any[] = []) {
  return { id, name, folders, requests, expanded: true };
}

function makeCollection(id: string, name: string, folders: any[] = [], requests: any[] = []) {
  return { id, name, folders, requests, variables: [], expanded: true };
}

function setupStore(overrides?: object) {
  const defaults = {
    collections: [],
    addRequest: vi.fn(),
    addFolder: vi.fn(),
    deleteCollection: vi.fn(),
    deleteFolder: vi.fn(),
    deleteRequest: vi.fn(),
    duplicateRequest: vi.fn(),
    moveRequest: vi.fn(),
    moveFolder: vi.fn(),
    reorderRequests: vi.fn(),
    openTab: vi.fn(),
  };
  const state = { ...defaults, ...overrides };
  mockUseAppStore.mockReturnValue(state);
  return state;
}

const defaultProps = {
  closeContextMenu: vi.fn(),
  showMoveToMenu: false,
  setShowMoveToMenu: vi.fn(),
  setRunCollectionModal: vi.fn(),
  setAuthModal: vi.fn(),
  setEditingId: vi.fn(),
  setEditingName: vi.fn(),
  inputRef: { current: null },
  setSortOption: vi.fn(),
};

function makeRequestMenu(
  collectionId = 'col-1',
  requestId = 'req-1',
  folderId?: string
): ContextMenuState {
  return { x: 100, y: 200, type: 'request', collectionId, requestId, folderId };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// GH-73 Fix 1: recursive Move destinations in SidebarContextMenu
// ═════════════════════════════════════════════════════════════════════════════

describe('GH-73 – SidebarContextMenu: Move to shows nested folders', () => {
  it('shows "Move to" button in a single-collection workspace when folders exist', () => {
    // Before fix: required collections.length > 1 to gate the submenu.
    // After fix: any non-empty destinations list reveals the button.
    const folder = makeFolder('f1', 'Alpha Folder');
    const col = makeCollection('col-1', 'My Collection', [folder], [makeRequest('req-1')]);
    setupStore({ collections: [col] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
      />
    );

    // The request sits at the collection root; the folder is a valid destination.
    expect(screen.getByText(/move to/i)).toBeTruthy();
  });

  it('includes nested (depth-2) folders in the Move to destination list', () => {
    const nestedFolder = makeFolder('f2', 'Nested Folder');
    const topFolder = makeFolder('f1', 'Top Folder', [nestedFolder]);
    const col = makeCollection('col-1', 'My Collection', [topFolder], [makeRequest('req-1')]);
    setupStore({ collections: [col] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    expect(screen.getByText('Top Folder')).toBeTruthy();
    expect(screen.getByText('Nested Folder')).toBeTruthy();
  });

  it('includes collection roots from other collections as move targets', () => {
    const col1 = makeCollection('col-1', 'Collection A', [], [makeRequest('req-1')]);
    const col2 = makeCollection('col-2', 'Collection B');
    setupStore({ collections: [col1, col2] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    expect(screen.getByText('Collection B')).toBeTruthy();
  });

  it('excludes the current parent folder from Move to destinations', () => {
    const parentFolder = makeFolder('f1', 'Parent Folder', [], [makeRequest('req-1')]);
    const siblingFolder = makeFolder('f2', 'Sibling Folder');
    const col = makeCollection('col-1', 'My Collection', [parentFolder, siblingFolder]);
    setupStore({ collections: [col] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu('col-1', 'req-1', 'f1')}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    // Parent folder itself must NOT appear (request is already there)
    expect(screen.queryByText('Parent Folder')).toBeNull();
    // Sibling folder MUST appear
    expect(screen.getByText('Sibling Folder')).toBeTruthy();
  });

  it('excludes current collection root when request is already at root', () => {
    const col = makeCollection('col-1', 'My Collection', [], [makeRequest('req-1')]);
    const col2 = makeCollection('col-2', 'Other Collection');
    setupStore({ collections: [col, col2] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    // Root of current collection must NOT appear as a destination
    const buttons = screen.getAllByRole('button');
    const myColBtn = buttons.find(b => b.textContent?.trim() === 'My Collection');
    expect(myColBtn).toBeUndefined();
    // Other collection root MUST appear
    expect(screen.getByText('Other Collection')).toBeTruthy();
  });

  it('calls moveRequest with the nested folder ID when its destination button is clicked', () => {
    const nestedFolder = makeFolder('f2', 'Nested Folder');
    const topFolder = makeFolder('f1', 'Top Folder', [nestedFolder]);
    const col = makeCollection('col-1', 'My Collection', [topFolder], [makeRequest('req-1')]);
    const store = setupStore({ collections: [col] });
    const closeContextMenu = vi.fn();

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        closeContextMenu={closeContextMenu}
        showMoveToMenu={true}
      />
    );

    fireEvent.click(screen.getByText('Nested Folder'));

    expect(store.moveRequest).toHaveBeenCalledWith(
      'col-1',   // sourceCollectionId
      null,      // sourceFolderId (request is at root)
      'col-1',   // destCollectionId
      'f2',      // destFolderId ← must be the nested folder's ID
      'req-1'    // requestId
    );
    expect(closeContextMenu).toHaveBeenCalled();
  });

  it('calls moveRequest with null folderId when a collection root destination is clicked', () => {
    const col1 = makeCollection('col-1', 'Source Collection', [], [makeRequest('req-1')]);
    const col2 = makeCollection('col-2', 'Target Collection');
    const store = setupStore({ collections: [col1, col2] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    fireEvent.click(screen.getByText('Target Collection'));

    expect(store.moveRequest).toHaveBeenCalledWith(
      'col-1',
      null,
      'col-2',
      null,   // collection root → folderId is null
      'req-1'
    );
  });

  it('applies deeper paddingLeft to more-nested folders', () => {
    const depth2Folder = makeFolder('f3', 'Deep Folder');
    const depth1Folder = makeFolder('f2', 'Mid Folder', [depth2Folder]);
    const depth0Folder = makeFolder('f1', 'Top Folder', [depth1Folder]);
    const col = makeCollection('col-1', 'My Collection', [depth0Folder], [makeRequest('req-1')]);
    setupStore({ collections: [col] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );

    const topBtn = screen.getByText('Top Folder').closest('button') as HTMLElement;
    const midBtn = screen.getByText('Mid Folder').closest('button') as HTMLElement;
    const deepBtn = screen.getByText('Deep Folder').closest('button') as HTMLElement;

    const topPad = parseInt(topBtn.style.paddingLeft);
    const midPad = parseInt(midBtn.style.paddingLeft);
    const deepPad = parseInt(deepBtn.style.paddingLeft);

    expect(midPad).toBeGreaterThan(topPad);
    expect(deepPad).toBeGreaterThan(midPad);
  });

  it('does NOT show Move to button when no valid destinations exist', () => {
    // Single collection, no folders, request at root → no valid destinations
    const col = makeCollection('col-1', 'Solo Collection', [], [makeRequest('req-1')]);
    setupStore({ collections: [col] });

    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/move to/i)).toBeNull();
  });
});
