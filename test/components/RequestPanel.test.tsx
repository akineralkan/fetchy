// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RequestPanel from '../../src/components/RequestPanel';
import { useAppStore } from '../../src/store/appStore';

// ---- Mocks ----

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/utils/httpClient', () => ({
  executeRequest: vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true}',
    time: 42,
    size: 11,
  }),
}));

vi.mock('../../src/utils/helpers', () => ({
  resolveRequestVariables: vi.fn((_req: any) => _req),
  generateCurl: vi.fn(() => 'curl http://example.com'),
  generateJavaScript: vi.fn(() => 'fetch("http://example.com")'),
  generatePython: vi.fn(() => 'requests.get("http://example.com")'),
  generateJava: vi.fn(() => 'HttpClient.newHttpClient()'),
  generateDotNet: vi.fn(() => 'new HttpClient()'),
  generateGo: vi.fn(() => 'http.Get("http://example.com")'),
  generateRust: vi.fn(() => 'reqwest::get("http://example.com")'),
  generateCpp: vi.fn(() => 'curl_easy_setopt(curl, CURLOPT_URL, "http://example.com")'),
}));

vi.mock('../../src/utils/authInheritance', () => ({
  resolveInheritedAuth: vi.fn(() => null),
}));

vi.mock('../../src/utils/curlParser', () => ({
  parseCurlCommand: vi.fn(() => ({
    method: 'POST',
    url: 'http://parsed-curl.com',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  })),
}));

vi.mock('../../src/utils/kvTableUtils', () => ({
  computeKeyColWidth: vi.fn(() => 120),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

// Mock child components as simple elements
vi.mock('../../src/components/request/UrlBar', () => ({
  default: (props: any) => (
    <div data-testid="url-bar">
      <span data-testid="url-bar-method">{props.method}</span>
      <span data-testid="url-bar-url">{props.url}</span>
      <button data-testid="send-btn" onClick={props.onSend}>Send</button>
      <button data-testid="cancel-btn" onClick={props.onCancel}>Cancel</button>
      <button data-testid="show-code-btn" onClick={() => props.onShowCode('curl')}>Code</button>
      {props.isLoading && <span data-testid="loading-indicator">Loading...</span>}
    </div>
  ),
}));

vi.mock('../../src/components/request/BodyEditor', () => ({
  default: (props: any) => (
    <div data-testid="body-editor">
      <span data-testid="body-type">{props.body?.type}</span>
      <button data-testid="body-change-btn" onClick={() => props.onChange({ type: 'json', raw: '{}' })}>Change Body</button>
    </div>
  ),
}));

vi.mock('../../src/components/request/AuthEditor', () => ({
  default: (props: any) => (
    <div data-testid="auth-editor">
      <span data-testid="auth-type">{props.auth?.type}</span>
      <span data-testid="inherited-auth">{props.inheritedAuth ? 'has-inherited' : 'no-inherited'}</span>
      <button data-testid="auth-change-btn" onClick={() => props.onChange({ type: 'bearer', bearer: { token: 'tok' } })}>Change Auth</button>
    </div>
  ),
}));

vi.mock('../../src/components/request/ScriptsEditor', () => ({
  default: (props: any) => (
    <div data-testid={`scripts-editor-${props.type}`}>
      <span data-testid={`script-value-${props.type}`}>{props.value}</span>
      <button data-testid={`script-change-btn-${props.type}`} onClick={() => props.onChange('console.log("test")')}>Edit</button>
    </div>
  ),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: (props: any) => (
    <input data-testid="variable-input" value={props.value} onChange={(e: any) => props.onChange(e.target.value)} placeholder={props.placeholder} />
  ),
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: (props: any) => <div>{props.children}</div>,
}));

vi.mock('../../src/components/AIAssistant', () => ({
  AIGenerateRequestModal: () => null,
}));

vi.mock('lucide-react', () => ({
  Save: () => <span data-testid="icon-save">SaveIcon</span>,
  Plus: () => <span data-testid="icon-plus">PlusIcon</span>,
  Trash2: () => <span data-testid="icon-trash">TrashIcon</span>,
  FileText: () => <span data-testid="icon-filetext">FileTextIcon</span>,
  X: () => <span data-testid="icon-x">XIcon</span>,
  Terminal: () => <span data-testid="icon-terminal">TerminalIcon</span>,
  Check: () => <span data-testid="icon-check">CheckIcon</span>,
}));

vi.mock('react-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom')>();
  return { ...original, createPortal: (node: React.ReactNode) => node };
});

// ---- Helpers ----

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const setResponse = vi.fn();
const setSentRequest = vi.fn();
const setIsLoading = vi.fn();

const makeRequest = (overrides: Record<string, any> = {}): any => ({
  id: 'req-1',
  name: 'Test Request',
  method: 'GET',
  url: 'http://example.com/api',
  headers: [
    { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  params: [
    { id: 'p1', key: 'page', value: '1', enabled: true },
  ],
  body: { type: 'none' as const },
  auth: { type: 'none' as const },
  preScript: '',
  script: '',
  ...overrides,
});

const makeTab = (overrides: Record<string, any> = {}): any => ({
  id: 'tab-1',
  type: 'request',
  title: 'Test Request',
  requestId: 'req-1',
  collectionId: 'col-1',
  folderId: null,
  isModified: false,
  isHistoryItem: false,
  ...overrides,
});

const updateRequest = vi.fn();
const updateTab = vi.fn();
const addToHistory = vi.fn();
const addCollection = vi.fn(() => ({ id: 'col-new', name: 'Request History Rollback' }));
const addRequest = vi.fn(() => ({ id: 'req-new', name: 'From History' }));
const getActiveEnvironment = vi.fn(() => ({
  id: 'env-1',
  name: 'Dev',
  variables: [{ id: 'ev1', key: 'base_url', value: 'http://dev.api.com', enabled: true }],
}));

function mockStores(overrides: Record<string, any> = {}) {
  const request = overrides.request ?? makeRequest();
  const tab = overrides.tab ?? makeTab();
  const collections = overrides.collections ?? [
    {
      id: 'col-1',
      name: 'My Collection',
      folders: [],
      requests: [request],
      variables: [{ id: 'cv1', key: 'api_key', value: '123', enabled: true }],
    },
  ];

  vi.mocked(useAppStore).mockReturnValue({
    tabs: overrides.tabs ?? [tab],
    activeTabId: overrides.activeTabId ?? 'tab-1',
    getRequest: vi.fn(() => request),
    updateRequest,
    updateTab,
    collections,
    getActiveEnvironment,
    addToHistory,
    addCollection,
    addRequest,
    ...overrides.storeOverrides,
  } as any);
}

function renderPanel(props: Record<string, any> = {}) {
  return render(
    <RequestPanel
      setResponse={setResponse}
      setSentRequest={setSentRequest}
      setIsLoading={setIsLoading}
      isLoading={props.isLoading ?? false}
      urlBarContainer={props.urlBarContainer ?? null}
      {...props}
    />
  );
}

// ---- Tests ----

describe('RequestPanel', () => {
  // 1. Renders without crashing
  it('renders without crashing', () => {
    mockStores();
    const { container } = renderPanel();
    expect(container).toBeDefined();
  });

  // Placeholder when no request
  it('shows placeholder when no request is loaded', () => {
    vi.mocked(useAppStore).mockReturnValue({
      tabs: [],
      activeTabId: null,
      getRequest: vi.fn(() => null),
      updateRequest,
      updateTab,
      collections: [],
      getActiveEnvironment,
      addToHistory,
      addCollection,
      addRequest,
    } as any);
    renderPanel();
    expect(screen.getByText('Select a request to edit')).toBeDefined();
  });

  // 2. Shows URL bar
  it('shows the URL bar component', () => {
    mockStores();
    renderPanel();
    expect(screen.getByTestId('url-bar')).toBeDefined();
  });

  // 3. Shows method selector
  it('displays the request method in URL bar', () => {
    mockStores();
    renderPanel();
    expect(screen.getByTestId('url-bar-method').textContent).toBe('GET');
  });

  // 4. Tab switching — Params active by default
  it('shows Params tab as active by default', () => {
    mockStores();
    renderPanel();
    const paramsBtn = screen.getByText('Params');
    expect(paramsBtn.className).toContain('border-fetchy-accent');
  });

  // 5. Shows params tab with key-value pairs
  it('renders param key-value rows', () => {
    mockStores();
    renderPanel();
    const keyInputs = screen.getAllByPlaceholderText('Key');
    expect(keyInputs.length).toBeGreaterThanOrEqual(1);
    expect((keyInputs[0] as HTMLInputElement).value).toBe('page');
  });

  // 6. Shows headers tab
  it('switches to Headers tab when clicked', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('Headers').className).toContain('border-fetchy-accent');
  });

  it('shows header key-value rows on Headers tab', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Headers'));
    const keyInputs = screen.getAllByPlaceholderText('Key');
    expect(keyInputs.length).toBeGreaterThanOrEqual(1);
    expect((keyInputs[0] as HTMLInputElement).value).toBe('Content-Type');
  });

  // 7. Shows body tab with type selector
  it('switches to Body tab and shows BodyEditor', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Body'));
    expect(screen.getByTestId('body-editor')).toBeDefined();
    expect(screen.getByTestId('body-type').textContent).toBe('none');
  });

  // 8. Shows auth tab
  it('switches to Auth tab and shows AuthEditor', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Auth'));
    expect(screen.getByTestId('auth-editor')).toBeDefined();
    expect(screen.getByTestId('auth-type').textContent).toBe('none');
  });

  // 9. Shows scripts tab — Pre-Script
  it('switches to Pre-Script tab and shows ScriptsEditor', () => {
    mockStores({ request: makeRequest({ preScript: 'console.log("pre")' }) });
    renderPanel();
    fireEvent.click(screen.getByText('Pre-Script'));
    expect(screen.getByTestId('scripts-editor-pre')).toBeDefined();
    expect(screen.getByTestId('script-value-pre').textContent).toBe('console.log("pre")');
  });

  it('switches to Post-Script tab and shows ScriptsEditor', () => {
    mockStores({ request: makeRequest({ script: 'console.log("post")' }) });
    renderPanel();
    fireEvent.click(screen.getByText('Post-Script'));
    expect(screen.getByTestId('scripts-editor-post')).toBeDefined();
    expect(screen.getByTestId('script-value-post').textContent).toBe('console.log("post")');
  });

  // 10. Send button triggers request
  it('calls executeRequest when Send is clicked', async () => {
    const { executeRequest } = await import('../../src/utils/httpClient');
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => {
      expect(setIsLoading).toHaveBeenCalledWith(true);
    });
    await waitFor(() => {
      expect(executeRequest).toHaveBeenCalled();
    });
  });

  // 11. Cancel button during request
  it('calls setIsLoading(false) when Cancel is clicked while loading', () => {
    mockStores();
    renderPanel({ isLoading: true });
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(setIsLoading).toHaveBeenCalledWith(false);
  });

  // 12. Loading state during request
  it('passes isLoading to UrlBar and shows loading indicator', () => {
    mockStores();
    renderPanel({ isLoading: true });
    expect(screen.getByTestId('loading-indicator')).toBeDefined();
  });

  // 13. Request URL display in URL bar
  it('shows request URL in the URL bar', () => {
    mockStores();
    renderPanel();
    expect(screen.getByTestId('url-bar-url').textContent).toBe('http://example.com/api');
  });

  // 14. Environment variable resolution in URL
  it('resolves variables on send via resolveRequestVariables', async () => {
    const { resolveRequestVariables } = await import('../../src/utils/helpers');
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => {
      expect(resolveRequestVariables).toHaveBeenCalled();
    });
  });

  // 15. Query params count badge
  it('shows param count badge when params have enabled items', () => {
    mockStores({
      request: makeRequest({
        params: [
          { id: 'p1', key: 'page', value: '1', enabled: true },
          { id: 'p2', key: 'limit', value: '10', enabled: true },
        ],
      }),
    });
    renderPanel();
    expect(screen.getByText('2')).toBeDefined();
  });

  // 16. Headers count badge
  it('shows header count badge when headers have enabled items', () => {
    mockStores({
      request: makeRequest({
        headers: [
          { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
          { id: 'h2', key: 'Accept', value: '*/*', enabled: true },
        ],
      }),
    });
    renderPanel();
    expect(screen.getByText('2')).toBeDefined();
  });

  // 17. Body type switching via child component
  it('triggers handleChange when BodyEditor changes body type', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Body'));
    fireEvent.click(screen.getByTestId('body-change-btn'));
    expect(updateTab).toHaveBeenCalledWith('tab-1', expect.objectContaining({ isModified: true }));
  });

  // 18. Auth type switching via child component
  it('triggers handleChange when AuthEditor changes auth type', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Auth'));
    fireEvent.click(screen.getByTestId('auth-change-btn'));
    expect(updateTab).toHaveBeenCalledWith('tab-1', expect.objectContaining({ isModified: true }));
  });

  // 19. Pre-request script display
  it('renders pre-request script value', () => {
    mockStores({ request: makeRequest({ preScript: 'pm.environment.set("foo", "bar")' }) });
    renderPanel();
    fireEvent.click(screen.getByText('Pre-Script'));
    expect(screen.getByTestId('script-value-pre').textContent).toBe('pm.environment.set("foo", "bar")');
  });

  // 20. Test script display
  it('renders post-request script value', () => {
    mockStores({ request: makeRequest({ script: 'pm.test("status", () => pm.response.to.have.status(200))' }) });
    renderPanel();
    fireEvent.click(screen.getByText('Post-Script'));
    expect(screen.getByTestId('script-value-post').textContent).toBe('pm.test("status", () => pm.response.to.have.status(200))');
  });

  // Save button disabled when not modified
  it('shows disabled save button when tab is not modified', () => {
    mockStores();
    renderPanel();
    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(true);
  });

  // Save button enabled when modified
  it('shows enabled save button when tab is modified', () => {
    mockStores({ tab: makeTab({ isModified: true }) });
    renderPanel();
    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(false);
  });

  // Save calls updateRequest
  it('calls updateRequest on save when tab is modified', () => {
    mockStores({ tab: makeTab({ isModified: true }) });
    renderPanel();
    fireEvent.click(screen.getByText('Save').closest('button')!);
    expect(updateRequest).toHaveBeenCalledWith('col-1', 'req-1', expect.anything());
  });

  // History item shows "Save to Rollback"
  it('shows "Save to Rollback" for history tabs', () => {
    mockStores({
      tab: makeTab({
        isHistoryItem: true,
        historyRequest: makeRequest({ id: 'hist-1' }),
      }),
    });
    renderPanel();
    expect(screen.getByText('Save to Rollback')).toBeDefined();
  });

  // Add parameter button
  it('adds a new parameter when Add Parameter is clicked', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText(/Add Parameter/));
    expect(updateTab).toHaveBeenCalled();
  });

  // Add header button
  it('adds a new header when Add Header is clicked', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Headers'));
    fireEvent.click(screen.getByText(/Add Header/));
    expect(updateTab).toHaveBeenCalled();
  });

  // Bulk Edit button
  it('shows Bulk Edit button on params tab', () => {
    mockStores();
    renderPanel();
    expect(screen.getByText('Bulk Edit')).toBeDefined();
  });

  // Checkbox toggle for key-value items
  it('toggles param enabled state via checkbox', () => {
    mockStores();
    renderPanel();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(checkboxes[0]);
    expect(updateTab).toHaveBeenCalled();
  });

  // Delete key-value item
  it('removes a param when delete button is clicked', () => {
    mockStores();
    renderPanel();
    const trashIcons = screen.getAllByTestId('icon-trash');
    fireEvent.click(trashIcons[0].closest('button')!);
    expect(updateTab).toHaveBeenCalled();
  });

  // Body content indicator dot
  it('shows body content indicator when body type is not none', () => {
    mockStores({ request: makeRequest({ body: { type: 'json', raw: '{"a":1}' } }) });
    renderPanel();
    const bodyTab = screen.getByText('Body');
    const dot = bodyTab.parentElement?.querySelector('.bg-fetchy-accent\\/60');
    expect(dot).toBeDefined();
  });

  // POST method displayed
  it('renders POST method in URL bar', () => {
    mockStores({ request: makeRequest({ method: 'POST' }) });
    renderPanel();
    expect(screen.getByTestId('url-bar-method').textContent).toBe('POST');
  });

  // Inherited auth passed to AuthEditor
  it('passes inherited auth to AuthEditor', async () => {
    const { resolveInheritedAuth } = await import('../../src/utils/authInheritance');
    vi.mocked(resolveInheritedAuth).mockReturnValue({ type: 'bearer', bearer: { token: 'inherited' } } as any);
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Auth'));
    expect(screen.getByTestId('inherited-auth').textContent).toBe('has-inherited');
  });

  // History tab loads historyRequest
  it('loads historyRequest data for history tabs', () => {
    const histReq = makeRequest({ id: 'hist-1', url: 'http://history.com/endpoint' });
    mockStores({
      tab: makeTab({
        isHistoryItem: true,
        historyRequest: histReq,
      }),
    });
    renderPanel();
    expect(screen.getByTestId('url-bar-url').textContent).toBe('http://history.com/endpoint');
  });

  // No param badge when none enabled
  it('does not show param count badge when no params are enabled', () => {
    mockStores({
      request: makeRequest({
        params: [{ id: 'p1', key: 'x', value: 'y', enabled: false }],
        headers: [],
      }),
    });
    renderPanel();
    // The Params button text should not contain a number after it
    const paramsBtn = screen.getByText('Params');
    // Badge spans have text-xs class and contain a number
    const badgeSpans = paramsBtn.parentElement?.querySelectorAll('span.text-xs') ?? [];
    expect(badgeSpans.length).toBe(0);
  });

  // Code generation modal
  it('opens code generation modal when code button clicked', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('show-code-btn'));
    expect(screen.getByText('Code Generation')).toBeDefined();
  });

  // Code modal language tabs
  it('shows language tabs in code generation modal', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('show-code-btn'));
    expect(screen.getByText('cURL')).toBeDefined();
    expect(screen.getByText('JavaScript')).toBeDefined();
    expect(screen.getByText('Python')).toBeDefined();
    expect(screen.getByText('Java')).toBeDefined();
  });

  // Code modal close
  it('closes code generation modal when Close is clicked', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('show-code-btn'));
    expect(screen.getByText('Code Generation')).toBeDefined();
    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);
    expect(screen.queryByText('Code Generation')).toBeNull();
  });

  // Switching code language tabs
  it('switches between code language tabs', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('show-code-btn'));
    fireEvent.click(screen.getByText('Python'));
    expect(screen.getByText(/Python code using requests library/)).toBeDefined();
  });

  // Send sets response on success
  it('sets response after successful send', async () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => {
      expect(setResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });
  });

  // Send adds to history
  it('adds to history after successful send', async () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => {
      expect(addToHistory).toHaveBeenCalled();
    });
  });

  // Send handles error
  it('sets error response when executeRequest throws', async () => {
    const { executeRequest } = await import('../../src/utils/httpClient');
    vi.mocked(executeRequest).mockRejectedValueOnce(new Error('Network failure'));
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByTestId('send-btn'));
    await waitFor(() => {
      expect(setResponse).toHaveBeenCalledWith(expect.objectContaining({
        status: 0,
        statusText: 'Error',
      }));
    });
  });

  // Keyboard shortcut Ctrl+S
  it('saves on Ctrl+S', () => {
    mockStores({ tab: makeTab({ isModified: true }) });
    renderPanel();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(updateRequest).toHaveBeenCalled();
  });

  // Keyboard shortcut Ctrl+Enter sends
  it('sends on Ctrl+Enter', async () => {
    const { executeRequest } = await import('../../src/utils/httpClient');
    mockStores();
    renderPanel();
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await waitFor(() => {
      expect(executeRequest).toHaveBeenCalled();
    });
  });

  // Save history item creates rollback collection
  it('saves history item to rollback collection', () => {
    mockStores({
      tab: makeTab({
        isHistoryItem: true,
        historyRequest: makeRequest({ id: 'hist-1' }),
      }),
      collections: [],
    });
    renderPanel();
    const saveBtn = screen.getByText('Save to Rollback').closest('button')!;
    fireEvent.click(saveBtn);
    expect(addCollection).toHaveBeenCalledWith('Request History Rollback', expect.any(String));
  });

  // Draft request marks tab as modified
  it('marks tab as modified when request is changed', () => {
    mockStores();
    renderPanel();
    fireEvent.click(screen.getByText('Auth'));
    fireEvent.click(screen.getByTestId('auth-change-btn'));
    expect(updateTab).toHaveBeenCalledWith('tab-1', expect.objectContaining({
      isModified: true,
      draftRequest: expect.objectContaining({ auth: { type: 'bearer', bearer: { token: 'tok' } } }),
    }));
  });

  // Renders all section tabs
  it('renders all six section tabs', () => {
    mockStores();
    renderPanel();
    expect(screen.getByText('Params')).toBeDefined();
    expect(screen.getByText('Headers')).toBeDefined();
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Auth')).toBeDefined();
    expect(screen.getByText('Pre-Script')).toBeDefined();
    expect(screen.getByText('Post-Script')).toBeDefined();
  });
});
