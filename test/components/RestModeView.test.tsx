// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RestModeView from '../../src/components/RestModeView';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/components/Sidebar', () => ({
  default: ({ onImport }: { onImport: () => void }) => (
    <div data-testid="sidebar"><button onClick={onImport}>Import</button></div>
  ),
}));

vi.mock('../../src/components/TabBar', () => ({
  default: () => <div data-testid="tab-bar" />,
}));

vi.mock('../../src/components/RequestPanel', () => ({
  default: () => <div data-testid="request-panel" />,
}));

vi.mock('../../src/components/ResponsePanel', () => ({
  default: () => <div data-testid="response-panel" />,
}));

vi.mock('../../src/components/WelcomeScreen', () => ({
  default: () => <div data-testid="welcome-screen" />,
}));

vi.mock('../../src/components/ResizeHandle', () => ({
  default: ({ onResize }: { onResize: (d: number) => void }) => (
    <div data-testid="resize-handle" onClick={() => onResize(10)} />
  ),
}));

vi.mock('../../src/components/OpenApiEditor', () => ({
  default: () => <div data-testid="openapi-editor" />,
}));

vi.mock('../../src/components/CollectionConfigPanel', () => ({
  default: () => <div data-testid="collection-config-panel" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockStore(overrides: Partial<ReturnType<typeof useAppStore>> = {}) {
  vi.mocked(useAppStore).mockReturnValue({
    tabs: [],
    activeTabId: null,
    sidebarWidth: 280,
    sidebarCollapsed: false,
    openTab: vi.fn(),
    setSidebarWidth: vi.fn(),
    requestPanelWidth: 50,
    setRequestPanelWidth: vi.fn(),
    panelLayout: 'horizontal',
    ...overrides,
  } as ReturnType<typeof useAppStore>);
}

describe('RestModeView', () => {
  it('renders the sidebar', () => {
    mockStore();
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('sidebar')).toBeDefined();
  });

  it('renders the tab bar', () => {
    mockStore();
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('tab-bar')).toBeDefined();
  });

  it('renders welcome screen when no active tab', () => {
    mockStore({ tabs: [], activeTabId: null });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('welcome-screen')).toBeDefined();
  });

  it('renders request and response panels when active request tab', () => {
    mockStore({
      tabs: [{ id: 't1', title: 'Get', type: 'request', collectionId: 'c1', requestId: 'r1', isHistoryItem: false, isModified: false }],
      activeTabId: 't1',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('request-panel')).toBeDefined();
    expect(screen.getByTestId('response-panel')).toBeDefined();
  });

  it('renders OpenAPI editor when active openapi tab', () => {
    mockStore({
      tabs: [{ id: 't2', title: 'API Spec', type: 'openapi', openApiDocId: 'doc-1', isHistoryItem: false, isModified: false }],
      activeTabId: 't2',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('openapi-editor')).toBeDefined();
  });

  it('renders collection config panel when active collection tab', () => {
    mockStore({
      tabs: [{ id: 't3', title: 'My API', type: 'collection', collectionId: 'c1', isHistoryItem: false, isModified: false }],
      activeTabId: 't3',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('collection-config-panel')).toBeDefined();
  });

  it('hides sidebar when sidebarCollapsed is true', () => {
    mockStore({ sidebarCollapsed: true });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    // Sidebar element still in DOM but with width 0
    const sidebarContainer = screen.getByTestId('sidebar').parentElement!;
    expect(sidebarContainer.style.width).toBe('0px');
  });

  it('does not render resize handle when sidebar is collapsed', () => {
    mockStore({ sidebarCollapsed: true });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.queryByTestId('resize-handle')).toBeNull();
  });

  it('calls onImport when sidebar Import is invoked', () => {
    mockStore();
    const onImport = vi.fn();
    render(
      <RestModeView
        onImport={onImport}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    screen.getByRole('button', { name: 'Import' }).click();
    expect(onImport).toHaveBeenCalled();
  });

  it('sets sidebar width from store value', () => {
    mockStore({ sidebarWidth: 350, sidebarCollapsed: false });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    const sidebarContainer = screen.getByTestId('sidebar').parentElement!;
    expect(sidebarContainer.style.width).toBe('350px');
  });

  it('renders resize handle when sidebar is not collapsed', () => {
    mockStore({ sidebarCollapsed: false });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('resize-handle')).toBeDefined();
  });

  it('renders URL bar container for active request tab', () => {
    mockStore({
      tabs: [{ id: 't1', title: 'Get', type: 'request', collectionId: 'c1', requestId: 'r1', isHistoryItem: false, isModified: false }],
      activeTabId: 't1',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    // Should have request panel and response panel
    expect(screen.getByTestId('request-panel')).toBeDefined();
    expect(screen.getByTestId('response-panel')).toBeDefined();
  });

  it('does not render request/response panels for non-request tabs', () => {
    mockStore({
      tabs: [{ id: 't1', title: 'API Spec', type: 'openapi', openApiDocId: 'd1', isHistoryItem: false, isModified: false }],
      activeTabId: 't1',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.queryByTestId('request-panel')).toBeNull();
    expect(screen.queryByTestId('response-panel')).toBeNull();
  });

  it('renders tab bar always', () => {
    mockStore({ tabs: [], activeTabId: null });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('tab-bar')).toBeDefined();
  });

  it('shows welcome screen when there are tabs but no active tab', () => {
    mockStore({
      tabs: [{ id: 't1', title: 'Get', type: 'request', collectionId: 'c1', requestId: 'r1', isHistoryItem: false, isModified: false }],
      activeTabId: null,
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('welcome-screen')).toBeDefined();
  });

  it('uses default sidebar width of 280', () => {
    mockStore();
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    const sidebarContainer = screen.getByTestId('sidebar').parentElement!;
    expect(sidebarContainer.style.width).toBe('280px');
  });

  it('renders with vertical panel layout', () => {
    mockStore({
      panelLayout: 'vertical',
      tabs: [{ id: 't1', title: 'Get', type: 'request', collectionId: 'c1', requestId: 'r1', isHistoryItem: false, isModified: false }],
      activeTabId: 't1',
    });
    render(
      <RestModeView
        onImport={vi.fn()}
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />
    );
    expect(screen.getByTestId('request-panel')).toBeDefined();
  });
});
