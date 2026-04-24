// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/ApiDocsPanel.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ApiDocsPanel from '../../../src/components/sidebar/ApiDocsPanel';
import { useAppStore } from '../../../src/store/appStore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

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

vi.mock('../../../src/utils/helpers', () => ({
  importOpenAPISpec: vi.fn(() => ({ id: 'col-1', name: 'Imported', requests: [], folders: [] })),
}));

vi.mock('../../../src/components/openapi/constants', () => ({
  DEFAULT_OPENAPI_YAML: 'openapi: "3.0.0"\ninfo:\n  title: New API\n  version: "1.0.0"\npaths: {}',
}));

vi.mock('../../../src/components/sidebar/SortableApiDocItem', () => ({
  default: ({ doc, onClick }: { doc: any; onClick: () => void }) => (
    <div data-testid={`api-doc-${doc.id}`} onClick={onClick}>
      {doc.name}
    </div>
  ),
}));

const mockUseAppStore = useAppStore as ReturnType<typeof vi.fn>;

function makeDoc(id: string, name: string) {
  return { id, name, content: '...', createdAt: Date.now() };
}

function setupStore(overrides?: object) {
  const defaults = {
    openApiDocuments: [],
    addOpenApiDocument: vi.fn(),
    updateOpenApiDocument: vi.fn(),
    deleteOpenApiDocument: vi.fn(),
    reorderOpenApiDocuments: vi.fn(),
    openTab: vi.fn(),
    tabs: [],
    updateTab: vi.fn(),
  };
  const state = { ...defaults, ...overrides };
  mockUseAppStore.mockImplementation((selector?: any) =>
    selector ? selector(state) : state
  );
  return state;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ApiDocsPanel', () => {
  it('renders without crashing with empty documents', () => {
    setupStore();
    render(<ApiDocsPanel filteredApiDocuments={[]} onResetSort={vi.fn()} />);
    // Should render the panel (add button should be present)
    expect(document.body).toBeTruthy();
  });

  it('renders a list of API doc items', () => {
    const docs = [makeDoc('doc-1', 'Petstore API'), makeDoc('doc-2', 'Users API')];
    setupStore({ openApiDocuments: docs });
    render(<ApiDocsPanel filteredApiDocuments={docs} onResetSort={vi.fn()} />);
    expect(screen.getByText('Petstore API')).toBeTruthy();
    expect(screen.getByText('Users API')).toBeTruthy();
  });

  it('calls addOpenApiDocument when add button is clicked', () => {
    const doc = { id: 'doc-new', name: 'New API Spec', content: '', createdAt: Date.now() };
    const addOpenApiDocument = vi.fn(() => doc);
    const openTab = vi.fn();
    setupStore({ addOpenApiDocument, openTab });
    render(<ApiDocsPanel filteredApiDocuments={[]} onResetSort={vi.fn()} />);
    // Find the add/plus button
    const addButton = document.querySelector('button');
    if (addButton) fireEvent.click(addButton);
    // Expect addOpenApiDocument was called
    expect(addOpenApiDocument).toHaveBeenCalled();
  });

  it('opens a tab when a doc item is clicked', () => {
    const openTab = vi.fn();
    const docs = [makeDoc('doc-1', 'Test API')];
    setupStore({ openApiDocuments: docs, openTab });
    render(<ApiDocsPanel filteredApiDocuments={docs} onResetSort={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-doc-doc-1'));
    expect(openTab).toHaveBeenCalled();
  });

  it('shows empty state when openApiDocuments is empty', () => {
    setupStore({ openApiDocuments: [] });
    render(<ApiDocsPanel filteredApiDocuments={[]} onResetSort={vi.fn()} />);
    expect(screen.getByText(/no openapi specs yet/i)).toBeTruthy();
  });

  it('shows "Create OpenAPI Spec" button in empty state', () => {
    const addOpenApiDocument = vi.fn(() => ({ id: 'doc-new', name: 'New', content: '' }));
    const openTab = vi.fn();
    setupStore({ openApiDocuments: [], addOpenApiDocument, openTab });
    render(<ApiDocsPanel filteredApiDocuments={[]} onResetSort={vi.fn()} />);
    const btn = screen.getByText('Create OpenAPI Spec');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(addOpenApiDocument).toHaveBeenCalled();
  });

  it('shows filtered empty state when docs exist but filter matches none', () => {
    const docs = [makeDoc('doc-1', 'Hidden API')];
    setupStore({ openApiDocuments: docs });
    render(<ApiDocsPanel filteredApiDocuments={[]} onResetSort={vi.fn()} />);
    expect(screen.getByText(/no matching specs found/i)).toBeTruthy();
  });

  it('displays correct count of filtered vs total docs', () => {
    const allDocs = [makeDoc('doc-1', 'API 1'), makeDoc('doc-2', 'API 2'), makeDoc('doc-3', 'API 3')];
    const filtered = [allDocs[0]];
    setupStore({ openApiDocuments: allDocs });
    render(<ApiDocsPanel filteredApiDocuments={filtered} onResetSort={vi.fn()} />);
    expect(screen.getByText('1 spec')).toBeTruthy();
    expect(screen.getByText(/3 total/i)).toBeTruthy();
  });

  it('displays plural "specs" for multiple filtered docs', () => {
    const allDocs = [makeDoc('doc-1', 'API 1'), makeDoc('doc-2', 'API 2')];
    setupStore({ openApiDocuments: allDocs });
    render(<ApiDocsPanel filteredApiDocuments={allDocs} onResetSort={vi.fn()} />);
    expect(screen.getByText('2 specs')).toBeTruthy();
  });

  it('displays "1 spec" singular for a single doc', () => {
    const allDocs = [makeDoc('doc-1', 'Only API')];
    setupStore({ openApiDocuments: allDocs });
    render(<ApiDocsPanel filteredApiDocuments={allDocs} onResetSort={vi.fn()} />);
    expect(screen.getByText('1 spec')).toBeTruthy();
  });

  it('clicking New Spec creates and opens a new doc', () => {
    const newDoc = { id: 'doc-new', name: 'New API Spec', content: '', createdAt: Date.now() };
    const addOpenApiDocument = vi.fn(() => newDoc);
    const openTab = vi.fn();
    const docs = [makeDoc('doc-1', 'Existing')];
    setupStore({ openApiDocuments: docs, addOpenApiDocument, openTab });
    render(<ApiDocsPanel filteredApiDocuments={docs} onResetSort={vi.fn()} />);
    // Click the "New Spec" button at the top
    const newSpecBtn = screen.getByText('New Spec').closest('button')!;
    fireEvent.click(newSpecBtn);
    expect(addOpenApiDocument).toHaveBeenCalledWith('New API Spec', expect.any(String), 'yaml');
    expect(openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'openapi', openApiDocId: 'doc-new' }));
  });

  it('does not show total count when filtered count equals total', () => {
    const allDocs = [makeDoc('doc-1', 'API 1'), makeDoc('doc-2', 'API 2')];
    setupStore({ openApiDocuments: allDocs });
    render(<ApiDocsPanel filteredApiDocuments={allDocs} onResetSort={vi.fn()} />);
    expect(screen.queryByText(/total/i)).toBeNull();
  });
});
