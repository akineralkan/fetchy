// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RequestPanel from '../../src/components/RequestPanel';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/utils/httpClient', () => ({
  executeRequest: vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true}',
    time: 50,
    size: 128,
  }),
}));

vi.mock('../../src/utils/authInheritance', () => ({
  resolveInheritedAuth: vi.fn(() => null),
}));

vi.mock('../../src/utils/helpers', () => ({
  resolveRequestVariables: vi.fn((req: unknown) => req),
  generateCurl: vi.fn(() => 'curl https://example.com'),
  generateJavaScript: vi.fn(() => 'fetch(...)'),
  generatePython: vi.fn(() => 'requests.get(...)'),
  generateJava: vi.fn(() => 'HttpClient...'),
  generateDotNet: vi.fn(() => 'HttpClient...'),
  generateGo: vi.fn(() => 'http.Get(...)'),
  generateRust: vi.fn(() => 'reqwest::get(...)'),
  generateCpp: vi.fn(() => 'curl_easy_perform(...)'),
  getMethodBgColor: () => 'bg-blue-500',
  exportToPostman: vi.fn(() => '{}'),
  isJWT: vi.fn(() => false),
  decodeJWT: vi.fn(() => null),
  formatBytes: (n: number) => `${n}B`,
  formatTime: (n: number) => `${n}ms`,
  getStatusColor: (s: number) => s < 400 ? 'text-green-400' : 'text-red-400',
  prettyPrintJson: (s: string) => s,
}));

vi.mock('../../src/utils/curlParser', () => ({
  parseCurlCommand: vi.fn(() => null),
}));

vi.mock('../../src/utils/kvTableUtils', () => ({
  computeKeyColWidth: vi.fn(() => 150),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="variable-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/components/request/BodyEditor', () => ({
  default: () => <div data-testid="body-editor" />,
}));

vi.mock('../../src/components/request/AuthEditor', () => ({
  default: () => <div data-testid="auth-editor" />,
}));

vi.mock('../../src/components/request/ScriptsEditor', () => ({
  default: () => <div data-testid="scripts-editor" />,
}));

vi.mock('../../src/components/request/UrlBar', () => ({
  default: ({ onSend, onCancel, isLoading, url, onUrlChange }: {
    onSend: () => void;
    onCancel: () => void;
    isLoading: boolean;
    url: string;
    onUrlChange: (v: string) => void;
    method: string;
    onMethodChange: (m: string) => void;
    onUrlPaste: () => void;
  }) => (
    <div data-testid="url-bar">
      <input data-testid="url-input" value={url} onChange={(e) => onUrlChange(e.target.value)} />
      {isLoading
        ? <button data-testid="cancel-btn" onClick={onCancel}>Cancel</button>
        : <button data-testid="send-btn" onClick={onSend}>Send</button>
      }
    </div>
  ),
}));

vi.mock('../../src/components/AIAssistant', () => ({
  AIGenerateRequestModal: () => null,
}));

vi.mock('react-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom')>();
  return { ...original, createPortal: (node: React.ReactNode) => node };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockRequest = {
  id: 'req-1',
  name: 'Get Users',
  method: 'GET' as const,
  url: 'https://api.example.com/users',
  headers: [],
  params: [],
  body: { type: 'none' as const },
  auth: { type: 'none' as const },
  preScript: '',
  script: '',
};

function mockStore(overrides: Partial<ReturnType<typeof useAppStore>> = {}) {
  vi.mocked(useAppStore).mockReturnValue({
    tabs: [{ id: 't1', title: 'Get Users', type: 'request', collectionId: 'c1', requestId: 'req-1', isHistoryItem: false, isModified: false }],
    activeTabId: 't1',
    getRequest: vi.fn(() => mockRequest),
    updateRequest: vi.fn(),
    updateTab: vi.fn(),
    collections: [{ id: 'c1', name: 'My API', requests: [mockRequest], folders: [], variables: [] }],
    getActiveEnvironment: vi.fn(() => null),
    addToHistory: vi.fn(),
    addCollection: vi.fn(() => ({ id: 'new-col', name: 'New Collection', requests: [], folders: [] })),
    addRequest: vi.fn(() => ({ ...mockRequest, id: 'new-req' })),
    ...overrides,
  } as ReturnType<typeof useAppStore>);
}

describe('RequestPanel', () => {
  it('renders without crashing with a valid request tab', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    expect(screen.getByTestId('url-bar')).toBeDefined();
  });

  it('renders tab sections (params, headers, body, auth)', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    expect(screen.getByRole('button', { name: /Params/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Headers/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Body/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Auth/i })).toBeDefined();
  });

  it('switches to Headers tab on click', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Headers/i }));
    // After switching, Headers button should have active accent class
    expect(screen.getByRole('button', { name: /Headers/i }).className).toContain('border-fetchy-accent');
  });

  it('sends request when Send button is clicked', async () => {
    const { executeRequest } = await import('../../src/utils/httpClient');
    const setResponse = vi.fn();
    const setIsLoading = vi.fn();
    mockStore();

    render(
      <RequestPanel
        setResponse={setResponse}
        setSentRequest={vi.fn()}
        setIsLoading={setIsLoading}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => expect(executeRequest).toHaveBeenCalled());
  });

  it('renders empty state when no active request tab', () => {
    mockStore({ tabs: [], activeTabId: null });
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    // Should not crash; URL bar is not rendered without a request
    expect(screen.queryByTestId('url-bar')).toBeNull();
  });

  it('shows Body editor when Body tab is clicked', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Body/i }));
    expect(screen.getByTestId('body-editor')).toBeDefined();
  });

  it('shows Auth editor when Auth tab is clicked', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Auth/i }));
    expect(screen.getByTestId('auth-editor')).toBeDefined();
  });

  it('shows Cancel button when isLoading is true', () => {
    mockStore();
    render(
      <RequestPanel
        setResponse={vi.fn()}
        setSentRequest={vi.fn()}
        setIsLoading={vi.fn()}
        isLoading={true}
      />
    );
    expect(screen.getByTestId('cancel-btn')).toBeDefined();
  });
});
