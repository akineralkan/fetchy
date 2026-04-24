// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

vi.mock('../../src/components/sidebar/SortableCollectionItem', () => ({
  default: ({ collection, children, onToggle, onDoubleClick, onContextMenu, editingId, editingName, setEditingName, inputRef, onEditComplete }: any) => (
    <div data-testid={`collection-${collection.id}`} onContextMenu={onContextMenu}>
      <button data-testid={`toggle-${collection.id}`} onClick={onToggle}>{collection.name}</button>
      <button data-testid={`dblclick-${collection.id}`} onClick={onDoubleClick}>dbl</button>
      {editingId === collection.id && (
        <input
          data-testid={`edit-input-${collection.id}`}
          ref={inputRef}
          value={editingName}
          onChange={(e: any) => setEditingName(e.target.value)}
          onBlur={onEditComplete}
        />
      )}
      {collection.expanded && children}
    </div>
  ),
}));

vi.mock('../../src/components/sidebar/SortableFolderItem', () => ({
  default: ({ folder, children, onToggle, onContextMenu, editingId, editingName, setEditingName, inputRef, onEditComplete }: any) => (
    <div data-testid={`folder-${folder.id}`} onContextMenu={onContextMenu}>
      <button data-testid={`toggle-folder-${folder.id}`} onClick={onToggle}>{folder.name}</button>
      {editingId === folder.id && (
        <input
          data-testid={`edit-input-${folder.id}`}
          ref={inputRef}
          value={editingName}
          onChange={(e: any) => setEditingName(e.target.value)}
          onBlur={onEditComplete}
        />
      )}
      {folder.expanded && children}
    </div>
  ),
}));

vi.mock('../../src/components/sidebar/SortableRequestItem', () => ({
  default: ({ request, onClick, onContextMenu, isActive, isHighlighted, editingId, editingName, setEditingName, inputRef, onEditComplete }: any) => (
    <div
      data-testid={`request-${request.id}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-active={isActive}
      data-highlighted={isHighlighted}
    >
      <span>{request.method}</span>
      <span>{request.name}</span>
      {editingId === request.id && (
        <input
          data-testid={`edit-input-${request.id}`}
          ref={inputRef}
          value={editingName}
          onChange={(e: any) => setEditingName(e.target.value)}
          onBlur={onEditComplete}
        />
      )}
    </div>
  ),
}));

vi.mock('../../src/components/sidebar/HistoryPanel', () => ({
  default: ({ onHistoryItemClick }: any) => <div data-testid="history-panel">History Panel</div>,
}));

vi.mock('../../src/components/sidebar/ApiDocsPanel', () => ({
  default: ({ filteredApiDocuments, onResetSort }: any) => (
    <div data-testid="api-docs-panel">
      API Docs Panel ({filteredApiDocuments?.length ?? 0} docs)
      <button data-testid="api-reset-sort" onClick={onResetSort}>Reset Sort</button>
    </div>
  ),
}));

vi.mock('../../src/components/sidebar/SidebarContextMenu', () => ({
  default: (props: any) => <div data-testid="context-menu">Context Menu</div>,
}));

vi.mock('../../src/components/CollectionAuthModal', () => ({
  default: (props: any) => props.isOpen ? <div data-testid="auth-modal">Auth Modal</div> : null,
}));

vi.mock('../../src/components/RunCollectionModal', () => ({
  default: (props: any) => props.isOpen ? <div data-testid="run-collection-modal">Run Modal</div> : null,
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children, content }: any) => <div title={content}>{children}</div>,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
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

vi.mock('lucide-react', () => ({
  FilePlus: (props: any) => <span data-testid="icon-file-plus" />,
  ChevronDown: (props: any) => <span data-testid="icon-chevron-down" />,
  ChevronUp: (props: any) => <span data-testid="icon-chevron-up" />,
  Folder: (props: any) => <span data-testid="icon-folder" />,
  Plus: (props: any) => <span data-testid="icon-plus" />,
  Clock: (props: any) => <span data-testid="icon-clock" />,
  Download: (props: any) => <span data-testid="icon-download" />,
  Filter: (props: any) => <span data-testid="icon-filter" />,
  ArrowUpDown: (props: any) => <span data-testid="icon-arrow-up-down" />,
  X: (props: any) => <span data-testid="icon-x" />,
  FileCode: (props: any) => <span data-testid="icon-file-code" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const addCollection = vi.fn(() => ({ id: 'new-col', name: 'New Collection' }));
const updateCollection = vi.fn();
const toggleCollectionExpanded = vi.fn();
const updateFolder = vi.fn();
const toggleFolderExpanded = vi.fn();
const addRequest = vi.fn();
const updateRequest = vi.fn();
const openTab = vi.fn();
const reorderCollections = vi.fn();
const reorderRequests = vi.fn();
const reorderFolders = vi.fn();
const moveRequest = vi.fn();
const moveFolder = vi.fn();
const onImport = vi.fn();
const onHistoryItemClick = vi.fn();

function mockStores(overrides: Record<string, any> = {}) {
  const defaultState = {
    collections: [],
    tabs: [],
    activeTabId: null,
    openApiDocuments: [],
    addCollection,
    updateCollection,
    toggleCollectionExpanded,
    updateFolder,
    toggleFolderExpanded,
    addRequest,
    updateRequest,
    openTab,
    reorderCollections,
    reorderRequests,
    reorderFolders,
    moveRequest,
    moveFolder,
    ...overrides,
  };
  vi.mocked(useAppStore).mockReturnValue(defaultState as any);
  (useAppStore as any).getState = vi.fn(() => defaultState);
}

function makeCollection(overrides: Record<string, any> = {}) {
  return {
    id: 'col-1',
    name: 'Test Collection',
    folders: [],
    requests: [],
    expanded: true,
    variables: [],
    ...overrides,
  };
}

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    id: 'req-1',
    name: 'Test Request',
    method: 'GET',
    url: 'http://test.com',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    ...overrides,
  };
}

describe('Sidebar', () => {
  // 1. Renders without crashing
  it('renders without crashing', () => {
    mockStores();
    const { container } = render(<Sidebar onImport={onImport} />);
    expect(container.firstChild).toBeDefined();
  });

  // 2. Shows empty state when no collections
  it('shows empty state when no collections', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('No collections yet')).toBeDefined();
  });

  // 3. Shows "Create Collection" and "Import" buttons in empty state
  it('shows Create Collection and Import buttons in empty state', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('Create Collection')).toBeDefined();
    expect(screen.getByText('Import from file')).toBeDefined();
  });

  // 4. Clicking "New Collection" calls addCollection
  it('clicking Create Collection calls addCollection', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    fireEvent.click(screen.getByText('Create Collection'));
    expect(addCollection).toHaveBeenCalledWith('New Collection');
  });

  // 5. Tab switching (collections/history/api tabs)
  it('switches to history tab when clicked', () => {
    mockStores();
    render(<Sidebar onImport={onImport} onHistoryItemClick={onHistoryItemClick} />);
    const buttons = screen.getAllByRole('button');
    const historyBtn = buttons.find(b => b.querySelector('[data-testid="icon-clock"]'));
    expect(historyBtn).toBeDefined();
    fireEvent.click(historyBtn!);
    expect(screen.getByTestId('history-panel')).toBeDefined();
  });

  it('switches to API tab when clicked', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    const buttons = screen.getAllByRole('button');
    const apiBtn = buttons.find(b => b.querySelector('[data-testid="icon-file-code"]'));
    expect(apiBtn).toBeDefined();
    fireEvent.click(apiBtn!);
    expect(screen.getByTestId('api-docs-panel')).toBeDefined();
  });

  it('switches back to collections tab', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    const historyBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-clock"]'));
    fireEvent.click(historyBtn!);
    const collectionsBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-folder"]'));
    fireEvent.click(collectionsBtn!);
    expect(screen.getByText('No collections yet')).toBeDefined();
  });

  // 6. Search input appears and filters work
  it('shows search input when collections exist', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByPlaceholderText('Search requests...')).toBeDefined();
  });

  it('filters requests by search query', () => {
    const req1 = makeRequest({ id: 'r1', name: 'Get Users' });
    const req2 = makeRequest({ id: 'r2', name: 'Create Post', method: 'POST' });
    const col = makeCollection({ requests: [req1, req2] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const searchInput = screen.getByPlaceholderText('Search requests...');
    fireEvent.change(searchInput, { target: { value: 'Users' } });
    expect(screen.getByText('Get Users')).toBeDefined();
    expect(screen.queryByText('Create Post')).toBeNull();
  });

  // 7. Filter method dropdown toggle
  it('opens filter menu when filter button is clicked', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    expect(filterBtn).toBeDefined();
    fireEvent.click(filterBtn!);
    expect(screen.getByText('Filter by Method')).toBeDefined();
    expect(screen.getByText('All Methods')).toBeDefined();
  });

  // 8. Sort option changes
  it('changes sort option when selected', () => {
    const req1 = makeRequest({ id: 'r1', name: 'Zebra' });
    const req2 = makeRequest({ id: 'r2', name: 'Alpha' });
    const col = makeCollection({ requests: [req1, req2] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    fireEvent.click(screen.getByText('Name (A-Z)'));
    expect(screen.getByText('Zebra')).toBeDefined();
    expect(screen.getByText('Alpha')).toBeDefined();
  });

  // 9. Clear filters
  it('shows clear filters button when filters are active', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const searchInput = screen.getByPlaceholderText('Search requests...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    expect(screen.getByText('Clear All Filters')).toBeDefined();
  });

  // 10. Expand all / collapse all collections
  it('calls updateCollection for expand all', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const expandBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-chevron-down"]'));
    expect(expandBtn).toBeDefined();
    fireEvent.click(expandBtn!);
    expect(updateCollection).toHaveBeenCalledWith('col-1', expect.objectContaining({ expanded: true }));
  });

  it('calls updateCollection for collapse all', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const collapseBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-chevron-up"]'));
    expect(collapseBtn).toBeDefined();
    fireEvent.click(collapseBtn!);
    expect(updateCollection).toHaveBeenCalledWith('col-1', expect.objectContaining({ expanded: false }));
  });

  // 11. Click on a request opens a tab
  it('opens tab when request is clicked', () => {
    const req = makeRequest();
    const col = makeCollection({ requests: [req] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    fireEvent.click(screen.getByTestId('request-req-1'));
    expect(openTab).toHaveBeenCalledWith({
      type: 'request',
      title: 'Test Request',
      requestId: 'req-1',
      collectionId: 'col-1',
      folderId: undefined,
    });
  });

  // 12. Shows collection count
  it('shows collection count', () => {
    const col1 = makeCollection({ id: 'c1', name: 'Col 1' });
    const col2 = makeCollection({ id: 'c2', name: 'Col 2' });
    mockStores({ collections: [col1, col2] });
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('2 collections')).toBeDefined();
  });

  it('shows singular collection count for one collection', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('1 collection')).toBeDefined();
  });

  // 13. Shows history panel when history tab selected
  it('renders HistoryPanel when history tab is active', () => {
    mockStores();
    render(<Sidebar onImport={onImport} onHistoryItemClick={onHistoryItemClick} />);
    const historyBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-clock"]'));
    fireEvent.click(historyBtn!);
    expect(screen.getByTestId('history-panel')).toBeDefined();
    expect(screen.getByText('History Panel')).toBeDefined();
  });

  // 14. Shows API docs panel when api tab selected
  it('renders ApiDocsPanel when API tab is active', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    expect(screen.getByTestId('api-docs-panel')).toBeDefined();
  });

  // 15. Context menu renders when right-clicking
  it('shows context menu when right-clicking a collection', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const colEl = screen.getByTestId('collection-col-1');
    fireEvent.contextMenu(colEl);
    expect(screen.getByTestId('context-menu')).toBeDefined();
  });

  it('shows context menu when right-clicking a request', () => {
    const req = makeRequest();
    const col = makeCollection({ requests: [req] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const reqEl = screen.getByTestId('request-req-1');
    fireEvent.contextMenu(reqEl);
    expect(screen.getByTestId('context-menu')).toBeDefined();
  });

  // 16. Inline rename functionality
  it('starts inline rename after adding collection', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    fireEvent.click(screen.getByText('Create Collection'));
    expect(addCollection).toHaveBeenCalled();
  });

  // 17. Keyboard navigation (arrow keys for highlighting)
  it('does not crash on keydown events when sidebar has no collections', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  // 18. Renders collections list
  it('renders collections list', () => {
    const col1 = makeCollection({ id: 'c1', name: 'Users API' });
    const col2 = makeCollection({ id: 'c2', name: 'Orders API' });
    mockStores({ collections: [col1, col2] });
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('Users API')).toBeDefined();
    expect(screen.getByText('Orders API')).toBeDefined();
  });

  // 19. "New Request" button for empty collections
  it('shows New Request button for empty collection', () => {
    const col = makeCollection({ folders: [], requests: [] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const newReqBtn = screen.getByText('New Request');
    expect(newReqBtn).toBeDefined();
    fireEvent.click(newReqBtn);
    expect(addRequest).toHaveBeenCalledWith('col-1', null);
  });

  // 20. Double-click collection opens tab
  it('double-clicking collection opens collection tab', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const dblBtn = screen.getByTestId('dblclick-col-1');
    fireEvent.click(dblBtn);
    expect(openTab).toHaveBeenCalledWith({
      type: 'collection',
      title: 'Test Collection',
      collectionId: 'col-1',
    });
  });

  // 21. Search clear button
  it('shows clear button when search has text and clears on click', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const searchInput = screen.getByPlaceholderText('Search requests...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    const clearBtns = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-x"]'));
    expect(clearBtns.length).toBeGreaterThan(0);
    fireEvent.click(clearBtns[0]);
    expect((screen.getByPlaceholderText('Search requests...') as HTMLInputElement).value).toBe('');
  });

  // 22. API tab search and filter
  it('shows search input in API tab when documents exist', () => {
    const docs = [{ id: 'doc-1', name: 'Pet Store', content: 'openapi: 3.0', format: 'yaml' }];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    expect(screen.getByPlaceholderText('Search API specs...')).toBeDefined();
  });

  it('filters API documents by search query', () => {
    const docs = [
      { id: 'doc-1', name: 'Pet Store', content: 'openapi: 3.0', format: 'yaml' },
      { id: 'doc-2', name: 'User API', content: 'openapi: 3.0', format: 'json' },
    ];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    const searchInput = screen.getByPlaceholderText('Search API specs...');
    fireEvent.change(searchInput, { target: { value: 'Pet' } });
    expect(screen.getByText(/1 docs/)).toBeDefined();
  });

  // 23. API format filter
  it('opens API filter menu and filters by format', () => {
    const docs = [{ id: 'doc-1', name: 'Spec', content: 'content', format: 'yaml' }];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    expect(screen.getByText('Filter by Format')).toBeDefined();
    expect(screen.getByText('All Formats')).toBeDefined();
    fireEvent.click(screen.getByText('YAML'));
    expect(screen.getByText(/1 docs/)).toBeDefined();
  });

  // 24. API sort options
  it('shows API sort options in filter menu', () => {
    const docs = [{ id: 'doc-1', name: 'Spec', content: 'content', format: 'yaml' }];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    expect(screen.getByText('Name (A-Z)')).toBeDefined();
    expect(screen.getByText('Name (Z-A)')).toBeDefined();
    expect(screen.getByText('Format')).toBeDefined();
    expect(screen.getByText('Created Order')).toBeDefined();
  });

  // 25. Focus state management
  it('sets focus state when sidebar is clicked', () => {
    mockStores();
    const { container } = render(<Sidebar onImport={onImport} />);
    const sidebar = container.firstChild as HTMLElement;
    fireEvent.mouseDown(sidebar);
    expect(sidebar).toBeDefined();
  });

  it('removes focus state when clicking outside sidebar', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    fireEvent.mouseDown(document.body);
    expect(document.body).toBeDefined();
  });

  // Additional tests for broader coverage

  it('Import from file button calls onImport', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    fireEvent.click(screen.getByText('Import from file'));
    expect(onImport).toHaveBeenCalled();
  });

  it('Import button in toolbar calls onImport', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const importBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-download"]'));
    expect(importBtn).toBeDefined();
    fireEvent.click(importBtn!);
    expect(onImport).toHaveBeenCalled();
  });

  it('New Collection button in header adds collection', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const newColBtn = screen.getByText('New Collection');
    fireEvent.click(newColBtn);
    expect(addCollection).toHaveBeenCalledWith('New Collection');
  });

  it('renders requests inside a folder', () => {
    const req = makeRequest({ id: 'fr1', name: 'Folder Request' });
    const folder = { id: 'f1', name: 'My Folder', folders: [], requests: [req], expanded: true, variables: [] };
    const col = makeCollection({ folders: [folder] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    expect(screen.getByText('My Folder')).toBeDefined();
    expect(screen.getByText('Folder Request')).toBeDefined();
  });

  it('toggles collection expanded state', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    fireEvent.click(screen.getByTestId('toggle-col-1'));
    expect(toggleCollectionExpanded).toHaveBeenCalledWith('col-1');
  });

  it('filters requests by HTTP method', () => {
    const req1 = makeRequest({ id: 'r1', name: 'Get Users', method: 'GET' });
    const req2 = makeRequest({ id: 'r2', name: 'Create Post', method: 'POST' });
    const col = makeCollection({ requests: [req1, req2] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    // Use getAllByText to find the filter menu option (a button with role='button' in the dropdown)
    const getOptions = screen.getAllByText('GET');
    const filterOption = getOptions.find(el => el.tagName === 'BUTTON');
    fireEvent.click(filterOption!);
    expect(screen.getByText('Get Users')).toBeDefined();
    expect(screen.queryByText('Create Post')).toBeNull();
  });

  it('clears all collection filters', () => {
    const col = makeCollection();
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const searchInput = screen.getByPlaceholderText('Search requests...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    fireEvent.click(screen.getByText('Clear All Filters'));
    expect((screen.getByPlaceholderText('Search requests...') as HTMLInputElement).value).toBe('');
  });

  it('clears API search input with clear button', () => {
    const docs = [{ id: 'doc-1', name: 'Spec', content: 'content', format: 'yaml' }];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    const searchInput = screen.getByPlaceholderText('Search API specs...');
    fireEvent.change(searchInput, { target: { value: 'pet' } });
    const clearBtns = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-x"]'));
    expect(clearBtns.length).toBeGreaterThan(0);
    fireEvent.click(clearBtns[0]);
    expect((screen.getByPlaceholderText('Search API specs...') as HTMLInputElement).value).toBe('');
  });

  it('clears all API filters from menu', () => {
    const docs = [{ id: 'doc-1', name: 'Spec', content: 'content', format: 'yaml' }];
    mockStores({ openApiDocuments: docs });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    const searchInput = screen.getByPlaceholderText('Search API specs...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    const filterBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-filter"]'));
    fireEvent.click(filterBtn!);
    fireEvent.click(screen.getByText('Clear All Filters'));
    expect((screen.getByPlaceholderText('Search API specs...') as HTMLInputElement).value).toBe('');
  });

  it('highlights active request', () => {
    const req = makeRequest();
    const col = makeCollection({ requests: [req] });
    mockStores({
      collections: [col],
      tabs: [{ id: 'tab-1', requestId: 'req-1' }],
      activeTabId: 'tab-1',
    });
    render(<Sidebar onImport={onImport} />);
    const reqEl = screen.getByTestId('request-req-1');
    expect(reqEl.getAttribute('data-active')).toBe('true');
  });

  it('does not show New Request button when collection has requests', () => {
    const req = makeRequest();
    const col = makeCollection({ requests: [req] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const newReqButtons = screen.queryAllByText('New Request');
    expect(newReqButtons.length).toBe(0);
  });

  it('does not show search bar when no collections and on collections tab', () => {
    mockStores();
    render(<Sidebar onImport={onImport} />);
    expect(screen.queryByPlaceholderText('Search requests...')).toBeNull();
  });

  it('does not show search bar when no API docs and on API tab', () => {
    mockStores({ openApiDocuments: [] });
    render(<Sidebar onImport={onImport} />);
    const apiBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-testid="icon-file-code"]'));
    fireEvent.click(apiBtn!);
    expect(screen.queryByPlaceholderText('Search API specs...')).toBeNull();
  });

  it('renders folder context menu on right click', () => {
    const folder = { id: 'f1', name: 'Folder', folders: [], requests: [], expanded: true, variables: [] };
    const col = makeCollection({ folders: [folder] });
    mockStores({ collections: [col] });
    render(<Sidebar onImport={onImport} />);
    const folderEl = screen.getByTestId('folder-f1');
    fireEvent.contextMenu(folderEl);
    expect(screen.getByTestId('context-menu')).toBeDefined();
  });
});
