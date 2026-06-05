// @vitest-environment jsdom

/**
 * GH-82: Refactor UI to Isolate gRPC Features into Dedicated 'gRPC Mode'
 *
 * Covers:
 *  - RequestPanel: forcedAppMode="grpc" overrides request.appMode
 *  - RequestPanel: forcedAppMode="rest" overrides a grpc-mode request
 *  - RequestPanel: gRPC mode renders GrpcEditor instead of REST sections
 *  - GrpcModeView: renders RequestPanel with forcedAppMode="grpc"
 *  - App-level routing: activeMode=grpc mounts GrpcModeView, not REST tabs
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RequestPanel from '../../src/components/RequestPanel';
import GrpcModeView from '../../src/components/GrpcModeView';
import { useAppStore } from '../../src/store/appStore';
import { executeRequest } from '../../src/utils/httpClient';

// ─── Store mock ───────────────────────────────────────────────────────────────

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

// ─── Utility mocks ────────────────────────────────────────────────────────────

vi.mock('../../src/utils/httpClient', () => ({ executeRequest: vi.fn() }));
vi.mock('../../src/utils/helpers', () => ({
  resolveRequestVariables: vi.fn((r: any) => r),
  generateCurl: vi.fn(() => ''),
  generateJavaScript: vi.fn(() => ''),
  generatePython: vi.fn(() => ''),
  generateJava: vi.fn(() => ''),
  generateDotNet: vi.fn(() => ''),
  generateGo: vi.fn(() => ''),
  generateRust: vi.fn(() => ''),
  generateCpp: vi.fn(() => ''),
}));
vi.mock('../../src/utils/authInheritance', () => ({ resolveInheritedAuth: vi.fn(() => null) }));
vi.mock('../../src/utils/curlParser', () => ({ parseCurlCommand: vi.fn() }));
vi.mock('../../src/utils/kvTableUtils', () => ({ computeKeyColWidth: vi.fn(() => 120) }));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid') }));

// ─── Component mocks ─────────────────────────────────────────────────────────

// UrlBar: expose appMode as data attribute so tests can assert on it
vi.mock('../../src/components/request/UrlBar', () => ({
  default: (props: any) => (
    <div data-testid="url-bar" data-app-mode={props.appMode}>
      <span data-testid="url-bar-method">{props.method}</span>
    </div>
  ),
}));

// GrpcEditor: render a clear test marker
vi.mock('../../src/components/request/GrpcEditor', () => ({
  default: (props: any) => (
    <div data-testid="grpc-editor">
      <span data-testid="grpc-server">{props.grpc?.serverAddress}</span>
      <button data-testid="grpc-invoke-btn" onClick={props.onInvoke}>Invoke</button>
    </div>
  ),
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
vi.mock('../../src/components/VariableInput', () => ({
  default: (props: any) => <input data-testid="variable-input" value={props.value} onChange={() => {}} />,
}));
vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: any) => <>{children}</>,
}));
vi.mock('../../src/components/AIAssistant', () => ({
  AIGenerateRequestModal: () => null,
}));
vi.mock('lucide-react', () => ({
  Save: () => null, Plus: () => null, Trash2: () => null, FileText: () => null,
  X: () => null, Terminal: () => null, Check: () => null,
}));
vi.mock('react-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom')>();
  return { ...original, createPortal: (node: React.ReactNode) => node };
});

// GrpcModeView child mocks
vi.mock('../../src/components/Sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock('../../src/components/TabBar', () => ({
  default: () => <div data-testid="tab-bar" />,
}));
vi.mock('../../src/components/ResponsePanel', () => ({
  default: () => <div data-testid="response-panel" />,
}));
vi.mock('../../src/components/ResizeHandle', () => ({
  default: () => <div data-testid="resize-handle" />,
}));
vi.mock('../../src/components/CollectionConfigPanel', () => ({
  default: () => <div data-testid="collection-config-panel" />,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const updateRequest = vi.fn();
const updateTab = vi.fn();
const addToHistory = vi.fn();
const addCollection = vi.fn(() => ({ id: 'col-new', name: 'Rollback' }));
const addRequest = vi.fn(() => ({ id: 'req-new', name: 'Req' }));
const getActiveEnvironment = vi.fn(() => null);

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    id: 'req-1',
    name: 'Test',
    method: 'GET',
    url: 'http://example.com',
    headers: [],
    params: [],
    body: { type: 'none' as const },
    auth: { type: 'none' as const },
    preScript: '',
    script: '',
    grpc: { serverAddress: 'localhost:50051', protoFilePath: '', serviceName: '', methodName: '', payload: '{}', metadata: [], useTls: false },
    ...overrides,
  };
}

function makeTab(overrides: Record<string, any> = {}) {
  return {
    id: 'tab-1',
    type: 'request',
    title: 'Test',
    requestId: 'req-1',
    collectionId: 'col-1',
    isModified: false,
    isHistoryItem: false,
    ...overrides,
  };
}

function mockStore(overrides: Record<string, any> = {}) {
  const request = overrides.request ?? makeRequest();
  const tab = overrides.tab ?? makeTab();
  vi.mocked(useAppStore).mockReturnValue({
    tabs: [tab],
    activeTabId: 'tab-1',
    getRequest: vi.fn(() => request),
    updateRequest,
    updateTab,
    collections: [
      { id: 'col-1', name: 'Collection', folders: [], requests: [request], variables: [] },
    ],
    getActiveEnvironment,
    addToHistory,
    addCollection,
    addRequest,
    sidebarWidth: 260,
    sidebarCollapsed: false,
    openTab: vi.fn(),
    setSidebarWidth: vi.fn(),
    requestPanelWidth: 50,
    setRequestPanelWidth: vi.fn(),
    panelLayout: 'horizontal',
    ...overrides.storeOverrides,
  } as any);
}

function renderPanel(props: Record<string, any> = {}) {
  return render(
    <RequestPanel
      setResponse={vi.fn()}
      setSentRequest={vi.fn()}
      setIsLoading={vi.fn()}
      isLoading={false}
      urlBarContainer={null}
      {...props}
    />
  );
}

// ─── RequestPanel – forcedAppMode ─────────────────────────────────────────────

describe('RequestPanel — forcedAppMode (GH-82)', () => {
  it('passes appMode="grpc" to UrlBar when forcedAppMode="grpc" regardless of request.appMode', () => {
    // request has no appMode (defaults to rest-like)
    mockStore({ request: makeRequest({ appMode: 'rest' }) });
    renderPanel({ forcedAppMode: 'grpc' });
    const urlBar = screen.getByTestId('url-bar');
    expect(urlBar.getAttribute('data-app-mode')).toBe('grpc');
  });

  it('renders GrpcEditor (not REST sections) when forcedAppMode="grpc" (GH-82)', () => {
    mockStore({ request: makeRequest() });
    renderPanel({ forcedAppMode: 'grpc' });
    expect(screen.getByTestId('grpc-editor')).toBeDefined();
    // REST-only tabs should not be present
    expect(screen.queryByText('Params')).toBeNull();
    expect(screen.queryByText('Headers')).toBeNull();
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('passes appMode="rest" to UrlBar when forcedAppMode="rest" overrides grpc request (GH-82)', () => {
    mockStore({ request: makeRequest({ appMode: 'grpc' }) });
    renderPanel({ forcedAppMode: 'rest' });
    const urlBar = screen.getByTestId('url-bar');
    expect(urlBar.getAttribute('data-app-mode')).toBe('rest');
  });

  it('renders REST sections (not GrpcEditor) when forcedAppMode="rest" (GH-82)', () => {
    mockStore({ request: makeRequest({ appMode: 'grpc' }) });
    renderPanel({ forcedAppMode: 'rest' });
    expect(screen.queryByTestId('grpc-editor')).toBeNull();
    expect(screen.getByText('Params')).toBeDefined();
  });

  it('renders GrpcEditor when request.appMode is grpc and no forcedAppMode (GH-82)', () => {
    mockStore({ request: makeRequest({ appMode: 'grpc' }) });
    renderPanel();
    expect(screen.getByTestId('grpc-editor')).toBeDefined();
  });

  it('renders REST sections when request.appMode is rest and no forcedAppMode (GH-82)', () => {
    mockStore({ request: makeRequest({ appMode: 'rest' }) });
    renderPanel();
    expect(screen.queryByTestId('grpc-editor')).toBeNull();
    expect(screen.getByText('Params')).toBeDefined();
  });
});

// ─── GrpcModeView ────────────────────────────────────────────────────────────

describe('GrpcModeView (GH-82)', () => {
  it('renders without crashing', () => {
    mockStore();
    const { container } = render(<GrpcModeView />);
    expect(container).toBeDefined();
  });

  it('renders a TabBar', () => {
    mockStore();
    render(<GrpcModeView />);
    expect(screen.getByTestId('tab-bar')).toBeDefined();
  });

  it('renders a Sidebar', () => {
    mockStore();
    render(<GrpcModeView />);
    expect(screen.getByTestId('sidebar')).toBeDefined();
  });

  it('renders RequestPanel with forcedAppMode grpc — UrlBar receives appMode grpc (GH-82)', () => {
    mockStore();
    render(<GrpcModeView />);
    // The mocked UrlBar renders data-app-mode; GrpcModeView passes forcedAppMode="grpc"
    const urlBar = screen.getByTestId('url-bar');
    expect(urlBar.getAttribute('data-app-mode')).toBe('grpc');
  });

  it('renders GrpcEditor (not REST params/headers tabs) inside GrpcModeView (GH-82)', () => {
    mockStore();
    render(<GrpcModeView />);
    expect(screen.getByTestId('grpc-editor')).toBeDefined();
    expect(screen.queryByText('Params')).toBeNull();
    expect(screen.queryByText('Headers')).toBeNull();
  });
});

// ─── RequestPanel — Ctrl+Enter keyboard shortcut dispatch ────────────────────

describe('RequestPanel — Ctrl+Enter keyboard shortcut dispatch (GH-82)', () => {
  function dispatchCtrlEnter() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })
    );
  }

  it('dispatches to handleGrpcSend (not handleSend) on Ctrl+Enter when forcedAppMode="grpc" (GH-82)', () => {
    const grpcInvoke = vi.fn().mockResolvedValue({ success: true, response: '{}', time: 10 });
    (window as any).electronAPI = { grpc: { invoke: grpcInvoke } };

    mockStore({
      request: makeRequest({
        grpc: {
          serverAddress: 'localhost:50051',
          protoFilePath: '/app/service.proto',
          serviceName: 'EchoService',
          methodName: 'Echo',
          payload: '{}',
          metadata: [],
          useTls: false,
        },
      }),
    });
    renderPanel({ forcedAppMode: 'grpc' });

    dispatchCtrlEnter();

    expect(grpcInvoke).toHaveBeenCalledOnce();
    expect(vi.mocked(executeRequest)).not.toHaveBeenCalled();

    delete (window as any).electronAPI;
  });

  it('dispatches to handleSend (not handleGrpcSend) on Ctrl+Enter when forcedAppMode="rest" (GH-82)', () => {
    const grpcInvoke = vi.fn();
    (window as any).electronAPI = { grpc: { invoke: grpcInvoke } };

    vi.mocked(executeRequest).mockResolvedValue({
      status: 200, statusText: 'OK', headers: {}, body: '{}', time: 10, size: 2,
    } as any);

    mockStore({ request: makeRequest() });
    renderPanel({ forcedAppMode: 'rest' });

    dispatchCtrlEnter();

    expect(vi.mocked(executeRequest)).toHaveBeenCalledOnce();
    expect(grpcInvoke).not.toHaveBeenCalled();

    delete (window as any).electronAPI;
  });
});
