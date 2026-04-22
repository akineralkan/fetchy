// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpenApiEditor from '../../src/components/OpenApiEditor';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock CodeMirror - it requires a real DOM but complex
vi.mock('codemirror', () => {
  const EditorView = vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    state: { doc: { toString: () => '' } },
    dispatch: vi.fn(),
  }));
  (EditorView as unknown as Record<string, unknown>).theme = vi.fn(() => []);
  (EditorView as unknown as Record<string, unknown>).updateListener = { of: vi.fn(() => []) };
  (EditorView as unknown as Record<string, unknown>).domEventHandlers = vi.fn(() => []);
  (EditorView as unknown as Record<string, unknown>).lineWrapping = [];
  return { basicSetup: [], EditorView };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({})),
  },
}));

vi.mock('@codemirror/lang-yaml', () => ({ yaml: vi.fn(() => []) }));
vi.mock('@codemirror/lang-json', () => ({ json: vi.fn(() => []) }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: [] }));

vi.mock('../../src/components/ResizeHandle', () => ({
  default: () => <div data-testid="resize-handle" />,
}));

vi.mock('js-yaml', () => ({
  load: vi.fn(() => ({
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0', description: 'A test API' },
    paths: { '/users': { get: { summary: 'Get users', responses: { '200': { description: 'OK' } } } } },
    components: { schemas: { User: { type: 'object', properties: { id: { type: 'string' } } } } },
  })),
  dump: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const updateOpenApiDocument = vi.fn();
const getOpenApiDocument = vi.fn(() => null);
const updateTab = vi.fn();

function mockStores(docContent?: string) {
  vi.mocked(usePreferencesStore).mockReturnValue({
    preferences: { theme: 'dark' },
  } as ReturnType<typeof usePreferencesStore>);

  if (docContent !== undefined) {
    vi.mocked(getOpenApiDocument).mockReturnValue({
      id: 'doc-1',
      name: 'My Spec',
      content: docContent,
      format: 'yaml',
    } as ReturnType<typeof getOpenApiDocument>);
  }

  vi.mocked(useAppStore).mockReturnValue({
    updateOpenApiDocument,
    getOpenApiDocument,
    updateTab,
    tabs: [{ id: 't1', title: 'My Spec', type: 'openapi', openApiDocId: 'doc-1', isModified: false }],
  } as ReturnType<typeof useAppStore>);
}

describe('OpenApiEditor', () => {
  it('renders without crashing (no documentId)', () => {
    mockStores();
    render(<OpenApiEditor />);
    // Should render some UI
    expect(document.body.firstChild).toBeDefined();
  });

  it('renders with a documentId', () => {
    mockStores('openapi: "3.0.0"');
    render(<OpenApiEditor documentId="doc-1" />);
    expect(document.body.firstChild).toBeDefined();
  });

  it('shows the document name', () => {
    mockStores('openapi: "3.0.0"');
    render(<OpenApiEditor documentId="doc-1" />);
    expect(screen.getByText('My Spec')).toBeDefined();
  });

  it('renders view mode toggle buttons', () => {
    mockStores();
    render(<OpenApiEditor />);
    // Should have Columns/Editor/Preview mode buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders section tabs (Paths, Schemas, Info)', () => {
    mockStores();
    render(<OpenApiEditor />);
    expect(screen.getByRole('button', { name: /Paths/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Schemas/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Info/i })).toBeDefined();
  });

  it('switches to Schemas section', () => {
    mockStores();
    render(<OpenApiEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Schemas/i }));
    // Active section button has bg-fetchy-accent class
    expect(screen.getByRole('button', { name: /Schemas/i }).className).toContain('bg-fetchy-accent');
  });

  it('switches to Info section', () => {
    mockStores();
    render(<OpenApiEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Info/i }));
    expect(screen.getByRole('button', { name: /Info/i }).className).toContain('bg-fetchy-accent');
  });

  it('allows clicking on the name to edit it', () => {
    mockStores('openapi: "3.0.0"');
    render(<OpenApiEditor documentId="doc-1" />);
    fireEvent.click(screen.getByText('My Spec'));
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('saves document name when Enter is pressed', async () => {
    mockStores('openapi: "3.0.0"');
    render(<OpenApiEditor documentId="doc-1" />);
    fireEvent.click(screen.getByText('My Spec'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Spec' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(updateOpenApiDocument).toHaveBeenCalled());
  });

  it('shows the current format badge in the editor toolbar', () => {
    mockStores();
    render(<OpenApiEditor />);
    // Format badge shows YAML or JSON in the editor source toolbar
    expect(document.body.textContent).toMatch(/YAML|JSON/);
  });
});
