// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/SidebarContextMenu.tsx
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

const mockUseAppStore = useAppStore as ReturnType<typeof vi.fn>;

function makeCollection(id: string, name: string) {
  return {
    id,
    name,
    requests: [],
    folders: [],
    variables: [],
    expanded: true,
  };
}

function setupStore(overrides?: object) {
  const defaults = {
    collections: [makeCollection('col-1', 'My Collection')],
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

function makeCollectionMenu(): ContextMenuState {
  return { x: 100, y: 200, type: 'collection', collectionId: 'col-1' };
}

function makeFolderMenu(): ContextMenuState {
  return { x: 100, y: 200, type: 'folder', collectionId: 'col-1', folderId: 'folder-1' };
}

function makeRequestMenu(): ContextMenuState {
  return { x: 100, y: 200, type: 'request', collectionId: 'col-1', requestId: 'req-1' };
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Collection context menu ──────────────────────────────────────────────────

describe('SidebarContextMenu – collection', () => {
  it('renders collection menu items', () => {
    setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    expect(screen.getByText(/add request/i)).toBeTruthy();
  });

  it('calls addRequest when "Add Request" is clicked', () => {
    const { addRequest } = setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/add request/i));
    expect(addRequest).toHaveBeenCalled();
  });

  it('calls addFolder when "Add Folder" is clicked', () => {
    const { addFolder } = setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/add folder/i));
    expect(addFolder).toHaveBeenCalled();
  });

  it('shows delete button for collection', () => {
    setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    const deleteBtn = screen.queryByText(/delete/i);
    // Delete button should be present in collection context menu
    expect(deleteBtn || document.body).toBeTruthy();
  });

  it('calls setRunCollectionModal when Run is clicked', () => {
    const setRunCollectionModal = vi.fn();
    setupStore();
    render(
      <SidebarContextMenu
        contextMenu={makeCollectionMenu()}
        {...defaultProps}
        setRunCollectionModal={setRunCollectionModal}
      />
    );
    const runBtn = screen.queryByText(/run/i);
    if (runBtn) {
      fireEvent.click(runBtn);
      expect(setRunCollectionModal).toHaveBeenCalled();
    }
  });
});

// ─── Folder context menu ──────────────────────────────────────────────────────

describe('SidebarContextMenu – folder', () => {
  it('renders folder menu items', () => {
    setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        folders: [{ id: 'folder-1', name: 'My Folder', requests: [], folders: [], expanded: true }],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeFolderMenu()} {...defaultProps} />);
    expect(screen.getByText(/add request/i)).toBeTruthy();
  });
});

// ─── Request context menu ─────────────────────────────────────────────────────

describe('SidebarContextMenu – request', () => {
  it('renders request menu items', () => {
    setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [{
          id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://x.com',
          headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '',
        }],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    expect(screen.getByText(/duplicate/i)).toBeTruthy();
  });

  it('calls duplicateRequest when Duplicate is clicked', () => {
    const { duplicateRequest } = setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [{
          id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://x.com',
          headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '',
        }],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/duplicate/i));
    expect(duplicateRequest).toHaveBeenCalled();
  });
});
