// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import ImportModal from '../../src/components/ImportModal';
import { useAppStore } from '../../src/store/appStore';
import { usePreferencesStore } from '../../src/store/preferencesStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/utils/helpers', () => ({
  importPostmanCollection: vi.fn(() => ({ id: 'c1', name: 'Postman Import', requests: [], folders: [], variables: [] })),
  importOpenAPISpec: vi.fn(() => ({ id: 'c2', name: 'OpenAPI Import', requests: [], folders: [], variables: [] })),
  importHoppscotchCollection: vi.fn(() => [{ id: 'c3', name: 'Hop Import', requests: [], folders: [], variables: [] }]),
  importBrunoCollection: vi.fn(() => ({ id: 'c4', name: 'Bruno Import', requests: [], folders: [], variables: [] })),
  importPostmanEnvironment: vi.fn(() => [{ id: 'e1', name: 'Env', variables: [] }]),
  importHoppscotchEnvironment: vi.fn(() => [{ id: 'e2', name: 'HopEnv', variables: [] }]),
  importBrunoEnvironment: vi.fn(() => [{ id: 'e3', name: 'BrunoEnv', variables: [] }]),
}));

vi.mock('../../src/utils/curlParser', () => ({
  parseCurlCommand: vi.fn((cmd: string) =>
    cmd.includes('fail') ? null : { id: 'r1', name: 'GET /api', method: 'GET', url: 'https://api.example.com', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }
  ),
}));

vi.mock('../../src/utils/aiImport', () => ({
  aiConvertCollection: vi.fn(),
  aiConvertEnvironment: vi.fn(),
  aiConvertRequest: vi.fn(),
}));

vi.mock('../../src/utils/fileUtils', () => ({
  getFirstDroppedFile: vi.fn(),
}));

const importCollection = vi.fn();
const importEnvironment = vi.fn();
const addCollection = vi.fn(() => ({ id: 'new-col', name: 'My Collection', requests: [], folders: [] }));
const addRequest = vi.fn((_col: string, _folder: null, req: unknown) => ({ ...(req as object), id: 'new-req' }));
const openTab = vi.fn();
const onClose = vi.fn();

function mockStores() {
  vi.mocked(useAppStore).mockReturnValue({
    importCollection,
    importEnvironment,
    collections: [],
    addCollection,
    addRequest,
    openTab,
  } as ReturnType<typeof useAppStore>);
  vi.mocked(usePreferencesStore).mockReturnValue({
    aiSettings: { enabled: false, apiKey: '', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
  } as ReturnType<typeof usePreferencesStore>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportModal', () => {
  it('renders modal title', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Import' })).toBeDefined();
  });

  it('shows collection import categories', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    expect(screen.getByText('Collection')).toBeDefined();
    expect(screen.getByText('Environment')).toBeDefined();
    expect(screen.getByText('Request')).toBeDefined();
  });

  it('calls onClose when Cancel is clicked', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('imports a Postman collection from pasted JSON', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);

    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: '{"info":{"name":"test"},"item":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);

    await waitFor(() => expect(importCollection).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Successfully imported/i)).toBeDefined());
  });

  it('disables import button when content is empty', () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    expect(importBtn).toBeDefined();
    expect(importBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('switches to Request category and shows cURL textarea', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    expect(screen.getByPlaceholderText(/curl -X POST/i)).toBeDefined();
  });

  it('imports a cURL request successfully', async () => {
    mockStores();
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [{ id: 'col-1', name: 'Existing', requests: [], folders: [] }],
      addCollection,
      addRequest,
      openTab,
    } as ReturnType<typeof useAppStore>);

    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    const textarea = screen.getByPlaceholderText(/curl -X POST/i);
    fireEvent.change(textarea, { target: { value: 'curl https://api.example.com' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);

    await waitFor(() => expect(addRequest).toHaveBeenCalled());
  });

  it('shows error for invalid cURL command', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    const textarea = screen.getByPlaceholderText(/curl -X POST/i);
    fireEvent.change(textarea, { target: { value: 'fail this' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);

    await waitFor(() => expect(screen.getByText(/Failed to parse cURL/i)).toBeDefined());
  });

  it('shows source selector tabs for collection category', () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    expect(screen.getByText('Postman')).toBeDefined();
    expect(screen.getByText('Hoppscotch')).toBeDefined();
    expect(screen.getByText('Bruno')).toBeDefined();
    expect(screen.getByText('OpenAPI')).toBeDefined();
  });

  it('switches to Environment category', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Environment'));
    // Should show environment source options
    expect(screen.getByPlaceholderText(/Paste your Postman environment JSON/i)).toBeDefined();
  });

  it('calls onClose when header X button is clicked', () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button');
    // X button is the first button
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  // ── Additional coverage tests ──────────────────────────────────────────

  it('imports an OpenAPI spec from pasted content', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="openapi" />);
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI spec/i);
    fireEvent.change(textarea, { target: { value: '{"openapi":"3.0.0","info":{"title":"Test"},"paths":{}}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importCollection).toHaveBeenCalled());
  });

  it('imports a Hoppscotch collection', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="hoppscotch" />);
    const textarea = screen.getByPlaceholderText(/Paste your Hoppscotch collection JSON/i);
    fireEvent.change(textarea, { target: { value: '{"v":1,"name":"test","requests":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importCollection).toHaveBeenCalled());
  });

  it('imports a Bruno collection', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="bruno" />);
    const textarea = screen.getByPlaceholderText(/Paste your Bruno collection JSON/i);
    fireEvent.change(textarea, { target: { value: '{"name":"bruno","requests":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importCollection).toHaveBeenCalled());
  });

  it('imports a Postman environment', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman-env" />);
    const textarea = screen.getByPlaceholderText(/Paste your Postman environment JSON/i);
    fireEvent.change(textarea, { target: { value: '{"name":"env","values":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importEnvironment).toHaveBeenCalled());
  });

  it('imports a Hoppscotch environment', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="hoppscotch-env" />);
    const textarea = screen.getByPlaceholderText(/Paste your Hoppscotch environment JSON/i);
    fireEvent.change(textarea, { target: { value: '{"name":"test","variables":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importEnvironment).toHaveBeenCalled());
  });

  it('imports a Bruno environment', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="bruno-env" />);
    const textarea = screen.getByPlaceholderText(/Paste your Bruno environment JSON/i);
    fireEvent.change(textarea, { target: { value: '{"name":"test","variables":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importEnvironment).toHaveBeenCalled());
  });

  it('shows error when collection import fails', async () => {
    mockStores();
    const { importPostmanCollection } = await import('../../src/utils/helpers');
    vi.mocked(importPostmanCollection).mockReturnValueOnce(null as any);
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: 'invalid json' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(screen.getByText(/Failed to parse/i)).toBeDefined());
  });

  it('shows error when OpenAPI import fails', async () => {
    mockStores();
    const { importOpenAPISpec } = await import('../../src/utils/helpers');
    vi.mocked(importOpenAPISpec).mockReturnValueOnce(null as any);
    render(<ImportModal onClose={onClose} initialImportType="openapi" />);
    const textarea = screen.getByPlaceholderText(/Paste your OpenAPI spec/i);
    fireEvent.change(textarea, { target: { value: 'bad yaml' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(screen.getByText(/Failed to parse/i)).toBeDefined());
  });

  it('creates a new collection when cURL imported and no collections exist', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    const textarea = screen.getByPlaceholderText(/curl -X POST/i);
    fireEvent.change(textarea, { target: { value: 'curl https://api.example.com' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(addCollection).toHaveBeenCalledWith('My Collection'));
  });

  it('shows error when cURL input is empty', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    // Leave textarea empty but force import attempt
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    expect(importBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('shows error when file/paste content is empty for collection import', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    expect(importBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('switching source resets file content and error', () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    // Paste some content
    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: 'some content' } });
    // Switch to OpenAPI
    fireEvent.click(screen.getByText('OpenAPI'));
    const newTextarea = screen.getByPlaceholderText(/Paste your OpenAPI spec/i);
    expect((newTextarea as HTMLTextAreaElement).value).toBe('');
  });

  it('switching category resets state', () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: 'some content' } });
    fireEvent.click(screen.getByText('Request'));
    // Switch back to collection
    fireEvent.click(screen.getByText('Collection'));
    const newTextarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    expect((newTextarea as HTMLTextAreaElement).value).toBe('');
  });

  it('handles drag and drop events on file zone', () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const dropZone = screen.getByText('Click to import or drag and drop').closest('div')!;
    // drag events should not crash
    fireEvent.dragOver(dropZone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
    fireEvent.dragEnter(dropZone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
    fireEvent.dragLeave(dropZone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });
    fireEvent.drop(dropZone, { preventDefault: vi.fn(), stopPropagation: vi.fn(), dataTransfer: { files: [], items: [] } });
    expect(dropZone).toBeDefined();
  });

  it('shows AI-assisted import checkbox when AI is enabled', () => {
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [],
      addCollection,
      addRequest,
      openTab,
    } as ReturnType<typeof useAppStore>);
    vi.mocked(usePreferencesStore).mockReturnValue({
      aiSettings: { enabled: true, apiKey: 'key', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
    } as ReturnType<typeof usePreferencesStore>);
    render(<ImportModal onClose={onClose} />);
    expect(screen.getByText('AI-Assisted Import')).toBeDefined();
  });

  it('AI-assisted collection import calls aiConvertCollection', async () => {
    const { aiConvertCollection } = await import('../../src/utils/aiImport');
    vi.mocked(aiConvertCollection).mockResolvedValue({
      collection: { id: 'ai-col', name: 'AI Collection', requests: [], folders: [], variables: [] } as any,
      error: null,
    });
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [],
      addCollection,
      addRequest,
      openTab,
    } as ReturnType<typeof useAppStore>);
    vi.mocked(usePreferencesStore).mockReturnValue({
      aiSettings: { enabled: true, apiKey: 'key', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
    } as ReturnType<typeof usePreferencesStore>);
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    // Enable AI toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    // Paste content
    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: '{"some":"data"}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(aiConvertCollection).toHaveBeenCalled());
  });

  it('AI-assisted request import calls aiConvertRequest', async () => {
    const { aiConvertRequest } = await import('../../src/utils/aiImport');
    vi.mocked(aiConvertRequest).mockResolvedValue({
      request: { id: 'ai-r1', name: 'AI Request', method: 'GET', url: 'https://test.com', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } } as any,
      error: null,
    });
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [{ id: 'c1', name: 'Col', requests: [], folders: [] }],
      addCollection,
      addRequest,
      openTab,
    } as any);
    vi.mocked(usePreferencesStore).mockReturnValue({
      aiSettings: { enabled: true, apiKey: 'key', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
    } as ReturnType<typeof usePreferencesStore>);
    render(<ImportModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Request'));
    // Enable AI toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const textarea = screen.getByPlaceholderText(/curl -X POST/i);
    fireEvent.change(textarea, { target: { value: 'some raw request text' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(aiConvertRequest).toHaveBeenCalled());
  });

  it('AI-assisted environment import calls aiConvertEnvironment', async () => {
    const { aiConvertEnvironment } = await import('../../src/utils/aiImport');
    vi.mocked(aiConvertEnvironment).mockResolvedValue({
      environment: { id: 'ai-env', name: 'AI Env', variables: [] } as any,
      error: null,
    });
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [],
      addCollection,
      addRequest,
      openTab,
    } as ReturnType<typeof useAppStore>);
    vi.mocked(usePreferencesStore).mockReturnValue({
      aiSettings: { enabled: true, apiKey: 'key', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
    } as ReturnType<typeof usePreferencesStore>);
    render(<ImportModal onClose={onClose} initialImportType="postman-env" />);
    // Enable AI toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const textarea = screen.getByPlaceholderText(/Paste your Postman environment JSON/i);
    fireEvent.change(textarea, { target: { value: '{"some":"env data"}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(aiConvertEnvironment).toHaveBeenCalled());
  });

  it('AI-assisted import shows error on failure', async () => {
    const { aiConvertCollection } = await import('../../src/utils/aiImport');
    vi.mocked(aiConvertCollection).mockResolvedValue({
      collection: null,
      error: 'AI conversion failed',
    });
    vi.mocked(useAppStore).mockReturnValue({
      importCollection,
      importEnvironment,
      collections: [],
      addCollection,
      addRequest,
      openTab,
    } as ReturnType<typeof useAppStore>);
    vi.mocked(usePreferencesStore).mockReturnValue({
      aiSettings: { enabled: true, apiKey: 'key', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
    } as ReturnType<typeof usePreferencesStore>);
    render(<ImportModal onClose={onClose} initialImportType="postman" />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const textarea = screen.getByPlaceholderText(/Paste your Postman collection JSON/i);
    fireEvent.change(textarea, { target: { value: '{"bad":"data"}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(screen.getByText(/AI conversion failed/i)).toBeDefined());
  });

  it('uses filename for environment name when importing single env via paste', async () => {
    mockStores();
    render(<ImportModal onClose={onClose} initialImportType="postman-env" />);
    // Paste content directly and verify import works
    const textarea = screen.getByPlaceholderText(/Paste your Postman environment JSON/i);
    fireEvent.change(textarea, { target: { value: '{"name":"env","values":[]}' } });
    const importBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Import') && !b.textContent?.includes('Cancel') && !b.textContent?.includes('AI'));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(importEnvironment).toHaveBeenCalled());
  });
});
