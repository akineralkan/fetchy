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
});
