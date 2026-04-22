// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TabBar from '../../src/components/TabBar';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/utils/helpers', () => ({
  getMethodBgColor: (method: string) => `method-color-${method}`,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const closeTab = vi.fn();
const setActiveTab = vi.fn();
const updateRequest = vi.fn();
const updateCollection = vi.fn();
const updateEnvironment = vi.fn();
const updateOpenApiDocument = vi.fn();
const getRequest = vi.fn(() => ({
  id: 'req-1',
  method: 'GET',
  name: 'My Request',
  url: '',
  headers: [],
  params: [],
  body: { type: 'none' },
  auth: { type: 'none' },
}));

function mockStore(tabs: unknown[], activeTabId: string | null = null) {
  vi.mocked(useAppStore).mockReturnValue({
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    getRequest,
    updateRequest,
    updateCollection,
    updateEnvironment,
    updateOpenApiDocument,
  } as ReturnType<typeof useAppStore>);
}

const makeTab = (overrides = {}) => ({
  id: 'tab-1',
  title: 'Get Users',
  type: 'request',
  collectionId: 'col-1',
  requestId: 'req-1',
  isHistoryItem: false,
  isModified: false,
  ...overrides,
});

describe('TabBar', () => {
  it('renders nothing when there are no tabs', () => {
    mockStore([]);
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a tab with the title', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    expect(screen.getByText('Get Users')).toBeDefined();
  });

  it('calls setActiveTab when a tab is clicked', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.click(screen.getByText('Get Users'));
    expect(setActiveTab).toHaveBeenCalledWith('tab-1');
  });

  it('calls closeTab when close button is clicked', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    const closeBtn = document.querySelector('.tab-close-btn') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(closeTab).toHaveBeenCalledWith('tab-1');
  });

  it('shows modified indicator when tab is modified', () => {
    mockStore([makeTab({ isModified: true })]);
    render(<TabBar />);
    // Modified indicator is a small dot with bg-fetchy-accent
    const dot = document.querySelector('.w-2.h-2.rounded-full') as HTMLElement;
    expect(dot).toBeDefined();
  });

  it('highlights active tab', () => {
    mockStore([makeTab()], 'tab-1');
    render(<TabBar />);
    const tabEl = document.querySelector('.tab-item') as HTMLElement;
    expect(tabEl.className).toContain('bg-fetchy-tab-active');
  });

  it('shows history badge for history items', () => {
    mockStore([makeTab({ isHistoryItem: true, historyRequest: { method: 'GET', name: 'History' } })]);
    render(<TabBar />);
    // History badge contains a Clock icon container
    const badge = document.querySelector('.bg-blue-500\\/20') as HTMLElement;
    expect(badge).toBeDefined();
  });

  it('shows HTTP method badge when request exists', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    expect(screen.getByText('GET')).toBeDefined();
  });

  it('shows openapi badge for openapi tabs', () => {
    mockStore([makeTab({ type: 'openapi', requestId: null, collectionId: null, openApiDocId: 'doc-1' })]);
    vi.mocked(getRequest).mockReturnValue(null as unknown as ReturnType<typeof getRequest>);
    render(<TabBar />);
    const badge = document.querySelector('.bg-purple-500\\/20') as HTMLElement;
    expect(badge).toBeDefined();
  });

  it('right-click shows context menu', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.contextMenu(document.querySelector('.tab-item')!);
    expect(screen.getByText('Close All Tabs')).toBeDefined();
  });

  it('"Close All Tabs" closes all tabs', () => {
    mockStore([makeTab(), makeTab({ id: 'tab-2', title: 'Tab 2' })]);
    render(<TabBar />);
    fireEvent.contextMenu(document.querySelector('.tab-item')!);
    fireEvent.click(screen.getByText('Close All Tabs'));
    expect(closeTab).toHaveBeenCalledTimes(2);
  });

  it('double-click starts rename editing', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('pressing Escape during rename cancels edit', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('pressing Enter during rename commits the new name', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateRequest).toHaveBeenCalledWith('col-1', 'req-1', { name: 'Renamed' });
  });

  it('does not rename history items on double-click', () => {
    mockStore([makeTab({ isHistoryItem: true, historyRequest: { method: 'GET', name: 'H' } })]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
