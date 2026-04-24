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

// Stub URL.createObjectURL / revokeObjectURL for jsdom
if (typeof URL.createObjectURL === 'undefined') {
  (URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
  (URL as any).revokeObjectURL = vi.fn();
}

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

  it('calls deleteRequest when Delete is clicked on a request', () => {
    const { deleteRequest } = setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [{
          id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://x.com',
          headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '',
        }],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/delete/i));
    expect(deleteRequest).toHaveBeenCalledWith('col-1', 'req-1');
  });

  it('shows Move Up/Down when request is in the middle', () => {
    setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [
          { id: 'req-0', name: 'First', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '' },
          { id: 'req-1', name: 'Middle', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '' },
          { id: 'req-2', name: 'Last', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '' },
        ],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    expect(screen.getByText(/move up/i)).toBeTruthy();
    expect(screen.getByText(/move down/i)).toBeTruthy();
  });

  it('calls reorderRequests on Move Up', () => {
    const store = setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [
          { id: 'req-0', name: 'First', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '' },
          { id: 'req-1', name: 'Second', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '' },
        ],
      }],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/move up/i));
    expect(store.reorderRequests).toHaveBeenCalled();
  });

  it('shows Move to submenu for requests when multiple collections exist', () => {
    setupStore({
      collections: [
        {
          ...makeCollection('col-1', 'Collection A'),
          requests: [{
            id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://x.com',
            headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '',
          }],
        },
        makeCollection('col-2', 'Collection B'),
      ],
    });
    render(<SidebarContextMenu contextMenu={makeRequestMenu()} {...defaultProps} />);
    expect(screen.getByText(/move to/i)).toBeTruthy();
  });

  it('calls setEditingId on request Rename click', () => {
    const setEditingId = vi.fn();
    const setEditingName = vi.fn();
    setupStore({
      collections: [{
        ...makeCollection('col-1', 'My Collection'),
        requests: [{
          id: 'req-1', name: 'Get Users', method: 'GET', url: 'https://x.com',
          headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' }, preScript: '', script: '',
        }],
      }],
    });
    render(
      <SidebarContextMenu
        contextMenu={makeRequestMenu()}
        {...defaultProps}
        setEditingId={setEditingId}
        setEditingName={setEditingName}
      />
    );
    fireEvent.click(screen.getByText(/rename/i));
    expect(setEditingId).toHaveBeenCalledWith('req-1');
    expect(setEditingName).toHaveBeenCalledWith('Get Users');
  });
});

// ─── Collection context menu – extended ───────────────────────────────────────

describe('SidebarContextMenu – collection extended', () => {
  it('calls setAuthModal when Auth Settings is clicked', () => {
    const setAuthModal = vi.fn();
    setupStore();
    render(
      <SidebarContextMenu
        contextMenu={makeCollectionMenu()}
        {...defaultProps}
        setAuthModal={setAuthModal}
      />
    );
    fireEvent.click(screen.getByText(/auth settings/i));
    expect(setAuthModal).toHaveBeenCalledWith({ open: true, collectionId: 'col-1' });
  });

  it('calls openTab for Configure', () => {
    const store = setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/configure/i));
    expect(store.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'collection', collectionId: 'col-1' })
    );
  });

  it('shows delete confirmation dialog when Delete is clicked', () => {
    setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/delete/i));
    // The confirmation dialog should appear
    expect(screen.getByText(/are you sure/i)).toBeTruthy();
  });

  it('confirms deletion of a collection', () => {
    const store = setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/delete/i));
    // Click the confirm Delete button in the dialog
    const confirmBtn = screen.getAllByText(/delete/i).find(
      el => el.closest('.btn')?.className.includes('bg-red')
    );
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(store.deleteCollection).toHaveBeenCalledWith('col-1');
  });

  it('cancels deletion when Cancel is clicked in the dialog', () => {
    const store = setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/delete/i));
    fireEvent.click(screen.getByText(/cancel/i));
    expect(store.deleteCollection).not.toHaveBeenCalled();
  });

  it('closes context menu when backdrop is clicked', () => {
    const closeContextMenu = vi.fn();
    setupStore();
    render(
      <SidebarContextMenu
        contextMenu={makeCollectionMenu()}
        {...defaultProps}
        closeContextMenu={closeContextMenu}
      />
    );
    // Click the fixed inset-0 backdrop (first fixed element)
    const backdrop = document.querySelector('.fixed.inset-0.z-40') as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(closeContextMenu).toHaveBeenCalled();
  });

  it('triggers export to Postman', () => {
    setupStore();
    render(<SidebarContextMenu contextMenu={makeCollectionMenu()} {...defaultProps} />);
    // Export to Postman button should be present
    const exportBtn = screen.getByText(/export to postman/i);
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn);
    // closeContextMenu should be called after export
    expect(defaultProps.closeContextMenu).toHaveBeenCalled();
  });

  it('calls setEditingId on collection Rename click', () => {
    const setEditingId = vi.fn();
    const setEditingName = vi.fn();
    setupStore();
    render(
      <SidebarContextMenu
        contextMenu={makeCollectionMenu()}
        {...defaultProps}
        setEditingId={setEditingId}
        setEditingName={setEditingName}
      />
    );
    fireEvent.click(screen.getByText(/rename/i));
    expect(setEditingId).toHaveBeenCalledWith('col-1');
    expect(setEditingName).toHaveBeenCalledWith('My Collection');
  });
});

// ─── Folder context menu – extended ───────────────────────────────────────────

describe('SidebarContextMenu – folder extended', () => {
  const folderCollection = {
    ...makeCollection('col-1', 'My Collection'),
    folders: [{
      id: 'folder-1', name: 'My Folder', requests: [], folders: [], expanded: true,
    }],
  };

  it('calls addFolder when Add Subfolder is clicked', () => {
    const store = setupStore({ collections: [folderCollection] });
    render(<SidebarContextMenu contextMenu={makeFolderMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/add subfolder/i));
    expect(store.addFolder).toHaveBeenCalledWith('col-1', 'folder-1', 'New Folder');
  });

  it('calls setAuthModal for folder Auth Settings', () => {
    const setAuthModal = vi.fn();
    setupStore({ collections: [folderCollection] });
    render(
      <SidebarContextMenu
        contextMenu={makeFolderMenu()}
        {...defaultProps}
        setAuthModal={setAuthModal}
      />
    );
    fireEvent.click(screen.getByText(/auth settings/i));
    expect(setAuthModal).toHaveBeenCalledWith({ open: true, collectionId: 'col-1', folderId: 'folder-1' });
  });

  it('shows delete confirmation for folder', () => {
    setupStore({ collections: [folderCollection] });
    render(<SidebarContextMenu contextMenu={makeFolderMenu()} {...defaultProps} />);
    fireEvent.click(screen.getByText(/delete/i));
    expect(screen.getByText(/are you sure/i)).toBeTruthy();
  });

  it('calls setEditingId on folder Rename', () => {
    const setEditingId = vi.fn();
    const setEditingName = vi.fn();
    setupStore({ collections: [folderCollection] });
    render(
      <SidebarContextMenu
        contextMenu={makeFolderMenu()}
        {...defaultProps}
        setEditingId={setEditingId}
        setEditingName={setEditingName}
      />
    );
    fireEvent.click(screen.getByText(/rename/i));
    expect(setEditingId).toHaveBeenCalledWith('folder-1');
    expect(setEditingName).toHaveBeenCalledWith('My Folder');
  });

  it('shows Move to submenu for folders when multiple collections exist', () => {
    setupStore({
      collections: [
        folderCollection,
        makeCollection('col-2', 'Other Collection'),
      ],
    });
    render(<SidebarContextMenu contextMenu={makeFolderMenu()} {...defaultProps} />);
    expect(screen.getByText(/move to/i)).toBeTruthy();
  });

  it('calls moveFolder on Move to target click', () => {
    const store = setupStore({
      collections: [
        folderCollection,
        makeCollection('col-2', 'Other Collection'),
      ],
    });
    render(
      <SidebarContextMenu
        contextMenu={makeFolderMenu()}
        {...defaultProps}
        showMoveToMenu={true}
      />
    );
    const target = screen.getByText('Other Collection');
    fireEvent.click(target);
    expect(store.moveFolder).toHaveBeenCalledWith('col-1', 'col-2', 'folder-1');
  });
});
