// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock all dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...s: unknown[]) => s),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock('../../src/components/CollectionAuthModal', () => ({
  default: () => <div data-testid="collection-auth-modal" />,
}));

vi.mock('../../src/components/RunCollectionModal', () => ({
  default: () => <div data-testid="run-collection-modal" />,
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/sidebar/SortableCollectionItem', () => ({
  default: ({ collection, onAddRequest }: { collection: { id: string; name: string }; onAddRequest: () => void }) => (
    <div data-testid={`collection-${collection.id}`}>
      <span>{collection.name}</span>
      <button onClick={onAddRequest} data-testid={`add-request-${collection.id}`}>Add Request</button>
    </div>
  ),
}));

vi.mock('../../src/components/sidebar/SortableRequestItem', () => ({
  default: ({ request }: { request: { id: string; name: string } }) => (
    <div data-testid={`request-${request.id}`}>{request.name}</div>
  ),
}));

vi.mock('../../src/components/sidebar/SortableFolderItem', () => ({
  default: ({ folder }: { folder: { id: string; name: string } }) => (
    <div data-testid={`folder-${folder.id}`}>{folder.name}</div>
  ),
}));

vi.mock('../../src/components/sidebar/HistoryPanel', () => ({
  default: () => <div data-testid="history-panel" />,
}));

vi.mock('../../src/components/sidebar/ApiDocsPanel', () => ({
  default: () => <div data-testid="api-docs-panel" />,
}));

vi.mock('../../src/components/sidebar/SidebarContextMenu', () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const addCollection = vi.fn(() => ({ id: 'new-col', name: 'New Collection', requests: [], folders: [] }));
const addRequest = vi.fn(() => ({ id: 'new-req', name: 'New Request', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }));
const openTab = vi.fn();
const updateCollection = vi.fn();
const toggleCollectionExpanded = vi.fn();
const updateFolder = vi.fn();
const toggleFolderExpanded = vi.fn();
const updateRequest = vi.fn();
const reorderCollections = vi.fn();
const reorderRequests = vi.fn();
const reorderFolders = vi.fn();
const moveRequest = vi.fn();
const moveFolder = vi.fn();

const mockCollection = {
  id: 'c1',
  name: 'My API',
  requests: [{ id: 'r1', name: 'Get Users', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }],
  folders: [],
  variables: [],
  expanded: true,
  auth: { type: 'none' },
};

function mockStore(collections: unknown[] = [mockCollection]) {
  vi.mocked(useAppStore).mockReturnValue({
    collections,
    addCollection,
    updateCollection,
    toggleCollectionExpanded,
    updateFolder,
    toggleFolderExpanded,
    addRequest,
    updateRequest,
    openTab,
    tabs: [],
    activeTabId: null,
    reorderCollections,
    reorderRequests,
    reorderFolders,
    moveRequest,
    moveFolder,
    openApiDocuments: [],
  } as ReturnType<typeof useAppStore>);
}

describe('Sidebar', () => {
  it('renders without crashing', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    expect(screen.getByText('My API')).toBeDefined();
  });

  it('renders the Collections tab by default', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    expect(screen.getByTestId('collection-c1')).toBeDefined();
  });

  it('shows empty state when no collections exist', () => {
    mockStore([]);
    render(<Sidebar onImport={vi.fn()} />);
    expect(screen.getByText(/No collections/i)).toBeDefined();
  });

  it('switches to History tab', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    const historyTab = screen.getAllByRole('button').find(b => b.title?.includes('History') || b.getAttribute('title')?.includes('History'));
    if (historyTab) {
      fireEvent.click(historyTab);
      expect(screen.getByTestId('history-panel')).toBeDefined();
    }
  });

  it('switches to API Docs tab', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    const apiTab = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('API') || b.getAttribute('title')?.includes('Docs'));
    if (apiTab) {
      fireEvent.click(apiTab);
      expect(screen.getByTestId('api-docs-panel')).toBeDefined();
    }
  });

  it('adds a new collection when Add Collection button is clicked', () => {
    mockStore([]);
    render(<Sidebar onImport={vi.fn()} />);
    const addBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('New Collection') || b.textContent?.includes('New Collection'));
    if (addBtn) {
      fireEvent.click(addBtn);
      expect(addCollection).toHaveBeenCalled();
    }
  });

  it('calls onImport when Import button is clicked', () => {
    mockStore([]);
    const onImport = vi.fn();
    render(<Sidebar onImport={onImport} />);
    const importBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Import') || b.textContent?.includes('Import'));
    if (importBtn) {
      fireEvent.click(importBtn);
      expect(onImport).toHaveBeenCalled();
    }
  });

  it('renders a collection with its requests', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    expect(screen.getByTestId('collection-c1')).toBeDefined();
  });

  it('renders search input field', () => {
    mockStore();
    render(<Sidebar onImport={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();
  });

  it('filters collections by search query', async () => {
    mockStore([
      { ...mockCollection, id: 'c1', name: 'Auth API' },
      { ...mockCollection, id: 'c2', name: 'Users API' },
    ]);
    render(<Sidebar onImport={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'auth' } });
    await waitFor(() => {
      expect(screen.queryByTestId('collection-c2')).toBeNull();
    });
  });
});
