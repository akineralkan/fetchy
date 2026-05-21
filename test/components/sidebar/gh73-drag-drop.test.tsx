// @vitest-environment jsdom

/**
 * GH-73 Fix 2: Sidebar handleDragEnd – dropping a request onto a folder
 *
 * The bug: `overData.folderId` was undefined for folder items (the correct
 * property is `overData.folder.id`), so drag-drop always landed at the
 * collection root instead of moving the request into the target folder.
 *
 * The fix: explicitly check `overIdStr.startsWith('folder-')` at the top of
 * the request-drag branch and use `overData.folder.id` as the destination.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import Sidebar from '../../../src/components/Sidebar';
import { useAppStore } from '../../../src/store/appStore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

// Capture the onDragEnd callback from DndContext so tests can invoke it directly
let capturedOnDragEnd: ((event: any) => void) | null = null;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  DragOverlay: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
}));

vi.mock('../../../src/components/sidebar/SortableCollectionItem', () => ({
  default: ({ collection, children, onToggle }: any) => (
    <div data-testid={`collection-${collection.id}`}>
      <button onClick={onToggle}>{collection.name}</button>
      {collection.expanded && children}
    </div>
  ),
}));

vi.mock('../../../src/components/sidebar/SortableFolderItem', () => ({
  default: ({ folder, children, onToggle }: any) => (
    <div data-testid={`folder-${folder.id}`}>
      <button onClick={onToggle}>{folder.name}</button>
      {folder.expanded && children}
    </div>
  ),
}));

vi.mock('../../../src/components/sidebar/SortableRequestItem', () => ({
  default: ({ request }: any) => (
    <div data-testid={`request-${request.id}`}>{request.name}</div>
  ),
}));

vi.mock('../../../src/components/sidebar/HistoryPanel', () => ({
  default: () => <div data-testid="history-panel" />,
}));

vi.mock('../../../src/components/sidebar/ApiDocsPanel', () => ({
  default: () => <div data-testid="api-docs-panel" />,
}));

vi.mock('../../../src/components/sidebar/SidebarContextMenu', () => ({
  default: () => <div data-testid="context-menu" />,
}));

vi.mock('../../../src/components/CollectionAuthModal', () => ({
  default: (props: any) => (props.isOpen ? <div data-testid="auth-modal" /> : null),
}));

vi.mock('../../../src/components/RunCollectionModal', () => ({
  default: (props: any) => (props.isOpen ? <div data-testid="run-modal" /> : null),
}));

vi.mock('../../../src/components/Tooltip', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => {
  const S = () => null;
  return {
    FilePlus: S, ChevronDown: S, ChevronUp: S, Folder: S, Plus: S,
    Clock: S, Download: S, Filter: S, ArrowUpDown: S, X: S, FileCode: S,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUseAppStore = useAppStore as ReturnType<typeof vi.fn>;

function setupStore(overrides?: object) {
  const defaults = {
    collections: [],
    tabs: [],
    activeTabId: null,
    openApiDocuments: [],
    addCollection: vi.fn(),
    updateCollection: vi.fn(),
    toggleCollectionExpanded: vi.fn(),
    updateFolder: vi.fn(),
    toggleFolderExpanded: vi.fn(),
    addRequest: vi.fn(),
    updateRequest: vi.fn(),
    openTab: vi.fn(),
    reorderCollections: vi.fn(),
    reorderRequests: vi.fn(),
    reorderFolders: vi.fn(),
    moveRequest: vi.fn(),
    moveFolder: vi.fn(),
  };
  const state = { ...defaults, ...overrides };
  mockUseAppStore.mockReturnValue(state as any);
  (useAppStore as any).getState = vi.fn(() => state);
  return state;
}

function makeCollection(id: string, name: string, folders: any[] = [], requests: any[] = []) {
  return { id, name, folders, requests, variables: [], expanded: true };
}

function makeFolder(id: string, name: string, folders: any[] = [], requests: any[] = []) {
  return { id, name, folders, requests, expanded: true };
}

function makeRequest(id: string) {
  return {
    id,
    name: 'Test Request',
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedOnDragEnd = null;
});

// ═════════════════════════════════════════════════════════════════════════════
// GH-73 Fix 2: Sidebar handleDragEnd request → folder drop
// ═════════════════════════════════════════════════════════════════════════════

describe('GH-73 – Sidebar handleDragEnd: request dropped onto folder', () => {
  it('moves request INTO the folder using overData.folder.id (not the broken overData.folderId)', () => {
    const folder = makeFolder('f1', 'Target Folder');
    const req = makeRequest('req-1');
    const col = makeCollection('col-1', 'My Collection', [folder], [req]);
    const store = setupStore({ collections: [col] });

    render(<Sidebar onImport={vi.fn()} />);
    expect(capturedOnDragEnd).toBeTruthy();

    // Simulate dropping request-req-1 onto folder-f1
    capturedOnDragEnd!({
      active: {
        id: 'request-req-1',
        data: {
          current: {
            request: { id: 'req-1' },
            collectionId: 'col-1',
            folderId: null,
          },
        },
      },
      over: {
        id: 'folder-f1',
        data: {
          current: {
            collectionId: 'col-1',
            folder: { id: 'f1' },  // ← the fixed property
            // NOTE: overData.folderId is intentionally absent to prove the bug
            // is fixed — old code used overData.folderId which would be undefined
          },
        },
      },
    });

    expect(store.moveRequest).toHaveBeenCalledWith(
      'col-1',   // sourceCollectionId
      null,      // sourceFolderId
      'col-1',   // destCollectionId
      'f1',      // destFolderId ← MUST be 'f1', not undefined
      'req-1'
    );
  });

  it('moves request from one folder to another folder across collections', () => {
    const srcFolder = makeFolder('f1', 'Source Folder', [], [makeRequest('req-1')]);
    const destFolder = makeFolder('f2', 'Dest Folder');
    const col1 = makeCollection('col-1', 'Col A', [srcFolder]);
    const col2 = makeCollection('col-2', 'Col B', [destFolder]);
    const store = setupStore({ collections: [col1, col2] });

    render(<Sidebar onImport={vi.fn()} />);

    capturedOnDragEnd!({
      active: {
        id: 'request-req-1',
        data: {
          current: {
            request: { id: 'req-1' },
            collectionId: 'col-1',
            folderId: 'f1',
          },
        },
      },
      over: {
        id: 'folder-f2',
        data: {
          current: {
            collectionId: 'col-2',
            folder: { id: 'f2' },
          },
        },
      },
    });

    expect(store.moveRequest).toHaveBeenCalledWith(
      'col-1',
      'f1',
      'col-2',
      'f2',
      'req-1'
    );
  });

  it('moves request to collection root when dropped on a collection header', () => {
    const srcFolder = makeFolder('f1', 'Source Folder', [], [makeRequest('req-1')]);
    const col1 = makeCollection('col-1', 'Col A', [srcFolder]);
    const col2 = makeCollection('col-2', 'Col B');
    const store = setupStore({ collections: [col1, col2] });

    render(<Sidebar onImport={vi.fn()} />);

    capturedOnDragEnd!({
      active: {
        id: 'request-req-1',
        data: {
          current: {
            request: { id: 'req-1' },
            collectionId: 'col-1',
            folderId: 'f1',
          },
        },
      },
      over: {
        id: 'collection-col-2',
        data: {
          current: { collectionId: 'col-2' },
        },
      },
    });

    expect(store.moveRequest).toHaveBeenCalledWith(
      'col-1',
      'f1',
      'col-2',
      null,   // collection root → folderId null
      'req-1'
    );
  });

  it('does NOT call moveRequest when active and over IDs are the same', () => {
    const col = makeCollection('col-1', 'Col', [], [makeRequest('req-1')]);
    const store = setupStore({ collections: [col] });

    render(<Sidebar onImport={vi.fn()} />);

    capturedOnDragEnd!({
      active: { id: 'request-req-1', data: { current: {} } },
      over: { id: 'request-req-1', data: { current: {} } },
    });

    expect(store.moveRequest).not.toHaveBeenCalled();
  });

  it('does NOT call moveRequest when there is no drop target (over is null)', () => {
    const col = makeCollection('col-1', 'Col', [], [makeRequest('req-1')]);
    const store = setupStore({ collections: [col] });

    render(<Sidebar onImport={vi.fn()} />);

    capturedOnDragEnd!({
      active: {
        id: 'request-req-1',
        data: {
          current: {
            request: { id: 'req-1' },
            collectionId: 'col-1',
            folderId: null,
          },
        },
      },
      over: null,
    });

    expect(store.moveRequest).not.toHaveBeenCalled();
  });
});
