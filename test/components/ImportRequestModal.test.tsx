// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import ImportRequestModal from '../../src/components/ImportRequestModal';
import { useAppStore } from '../../src/store/appStore';
import { usePreferencesStore } from '../../src/store/preferencesStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/utils/curlParser', () => ({
  parseCurlCommand: vi.fn((cmd: string) =>
    cmd.includes('fail')
      ? null
      : { id: 'r1', name: 'GET /api', method: 'GET', url: 'https://api.example.com', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }
  ),
}));

vi.mock('../../src/utils/aiImport', () => ({
  aiConvertRequest: vi.fn().mockResolvedValue({
    request: { id: 'ai-req', name: 'AI Request', method: 'POST', url: 'https://ai.example.com', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } },
    error: null,
  }),
}));

const addCollection = vi.fn(() => ({ id: 'new-col', name: 'My Collection', requests: [], folders: [] }));
const addRequest = vi.fn((_col: string, _folder: null, req: unknown) => ({ ...(req as object), id: 'new-req' }));
const openTab = vi.fn();
const onClose = vi.fn();

function mockStores(collections: unknown[] = [], aiEnabled = false) {
  vi.mocked(useAppStore).mockReturnValue({
    addCollection,
    addRequest,
    openTab,
    collections,
  } as ReturnType<typeof useAppStore>);
  vi.mocked(usePreferencesStore).mockReturnValue({
    aiSettings: { enabled: aiEnabled, apiKey: aiEnabled ? 'key' : '', baseUrl: '', provider: 'gemini', model: 'gemini-pro' },
  } as ReturnType<typeof usePreferencesStore>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportRequestModal', () => {
  it('renders the modal title', () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    expect(screen.getByText('Import Request')).toBeDefined();
  });

  it('shows cURL input area', () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    expect(screen.getByPlaceholderText(/curl -X POST/i)).toBeDefined();
  });

  it('disables import button when input is empty', () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    const importBtn = screen.getAllByRole('button').find(b => !b.textContent?.includes('Cancel') && (b.textContent?.includes('Import') ?? false));
    expect(importBtn).toBeDefined();
    expect(importBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('imports a valid cURL command into an existing collection', async () => {
    mockStores([{ id: 'col-1', name: 'Existing', requests: [], folders: [] }]);
    render(<ImportRequestModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/i), {
      target: { value: 'curl https://api.example.com' },
    });
    const importBtn = screen.getAllByRole('button').find(b => !b.textContent?.includes('Cancel') && (b.textContent?.includes('Import') ?? false));
    fireEvent.click(importBtn!);

    await waitFor(() => expect(addRequest).toHaveBeenCalledWith('col-1', null, expect.any(Object)));
    await waitFor(() => expect(openTab).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Successfully imported/i)).toBeDefined());
  });

  it('creates a new collection if none exist', async () => {
    mockStores([]);
    render(<ImportRequestModal onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/i), {
      target: { value: 'curl https://api.example.com' },
    });
    const importBtn = screen.getAllByRole('button').find(b => !b.textContent?.includes('Cancel') && (b.textContent?.includes('Import') ?? false));
    fireEvent.click(importBtn!);

    await waitFor(() => expect(addCollection).toHaveBeenCalled());
    await waitFor(() => expect(addRequest).toHaveBeenCalled());
  });

  it('shows error for invalid cURL command', async () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/curl -X POST/i), {
      target: { value: 'fail this' },
    });
    const importBtn = screen.getAllByRole('button').find(b => !b.textContent?.includes('Cancel') && (b.textContent?.includes('Import') ?? false));
    fireEvent.click(importBtn!);
    await waitFor(() => expect(screen.getByText(/Failed to parse cURL/i)).toBeDefined());
  });

  it('calls onClose when Cancel button is clicked', () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when header X button is clicked', () => {
    mockStores();
    render(<ImportRequestModal onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders AI-assisted toggle when AI is enabled', () => {
    mockStores([], true);
    render(<ImportRequestModal onClose={onClose} />);
    const aiToggle = document.querySelector('input[type="checkbox"]');
    expect(aiToggle).not.toBeNull();
  });

  it('uses AI conversion when AI-assisted mode is enabled', async () => {
    mockStores([{ id: 'col-1', name: 'Existing', requests: [], folders: [] }], true);
    const { aiConvertRequest } = await import('../../src/utils/aiImport');

    render(<ImportRequestModal onClose={onClose} />);

    // Enable AI-assisted toggle
    const toggle = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);

    // After toggling, placeholder changes to AI mode
    await waitFor(() => {
      const aiBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
      expect(aiBtn).toBeDefined();
    });

    const textarea = screen.getByPlaceholderText(/Paste a cURL command/i);
    fireEvent.change(textarea, { target: { value: 'some raw request data' } });

    const aiBtn2 = screen.getAllByRole('button').find(b => b.textContent?.includes('AI Import'));
    expect(aiBtn2).toBeDefined();
    fireEvent.click(aiBtn2!);
    await waitFor(() => expect(aiConvertRequest).toHaveBeenCalled());
  });
});
