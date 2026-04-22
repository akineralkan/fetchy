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
});
