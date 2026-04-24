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

  // ─── Additional coverage tests ──────────────────────────────────────────────

  it('middle-click closes a tab', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    const tabEl = document.querySelector('.tab-item') as HTMLElement;
    fireEvent.mouseDown(tabEl, { button: 1 });
    expect(closeTab).toHaveBeenCalledWith('tab-1');
  });

  it('"Close Tabs to Right" closes only tabs after the target', () => {
    mockStore([
      makeTab({ id: 'tab-1', title: 'First' }),
      makeTab({ id: 'tab-2', title: 'Second' }),
      makeTab({ id: 'tab-3', title: 'Third' }),
    ]);
    render(<TabBar />);
    // Right-click the first tab
    const firstTab = document.querySelectorAll('.tab-item')[0];
    fireEvent.contextMenu(firstTab);
    fireEvent.click(screen.getByText('Close Tabs to Right'));
    // Should close tab-2 and tab-3
    expect(closeTab).toHaveBeenCalledTimes(2);
    expect(closeTab).toHaveBeenCalledWith('tab-2');
    expect(closeTab).toHaveBeenCalledWith('tab-3');
  });

  it('"Close Tabs to Left" closes only tabs before the target', () => {
    mockStore([
      makeTab({ id: 'tab-1', title: 'First' }),
      makeTab({ id: 'tab-2', title: 'Second' }),
      makeTab({ id: 'tab-3', title: 'Third' }),
    ]);
    render(<TabBar />);
    // Right-click the last tab
    const lastTab = document.querySelectorAll('.tab-item')[2];
    fireEvent.contextMenu(lastTab);
    fireEvent.click(screen.getByText('Close Tabs to Left'));
    expect(closeTab).toHaveBeenCalledTimes(2);
    expect(closeTab).toHaveBeenCalledWith('tab-1');
    expect(closeTab).toHaveBeenCalledWith('tab-2');
  });

  it('"Close Other Tabs" closes all tabs except the target', () => {
    mockStore([
      makeTab({ id: 'tab-1', title: 'First' }),
      makeTab({ id: 'tab-2', title: 'Second' }),
      makeTab({ id: 'tab-3', title: 'Third' }),
    ]);
    render(<TabBar />);
    const secondTab = document.querySelectorAll('.tab-item')[1];
    fireEvent.contextMenu(secondTab);
    fireEvent.click(screen.getByText('Close Other Tabs'));
    expect(closeTab).toHaveBeenCalledTimes(2);
    expect(closeTab).toHaveBeenCalledWith('tab-1');
    expect(closeTab).toHaveBeenCalledWith('tab-3');
  });

  it('shows collection badge for collection tabs', () => {
    mockStore([makeTab({ type: 'collection', requestId: null, collectionId: 'col-1' })]);
    vi.mocked(getRequest).mockReturnValue(null as unknown as ReturnType<typeof getRequest>);
    render(<TabBar />);
    const badge = document.querySelector('.bg-yellow-500\\/20') as HTMLElement;
    expect(badge).toBeDefined();
  });

  it('commits rename on blur', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Blur Renamed' } });
    fireEvent.blur(input);
    expect(updateRequest).toHaveBeenCalledWith('col-1', 'req-1', { name: 'Blur Renamed' });
  });

  it('does not rename if new name is empty', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it('does not rename if name is unchanged', () => {
    mockStore([makeTab()]);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Don't change the value, just press Enter
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it('renames a collection tab via commitRename', () => {
    mockStore([makeTab({ type: 'collection', requestId: null })]);
    vi.mocked(getRequest).mockReturnValue(null as unknown as ReturnType<typeof getRequest>);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Collection Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateCollection).toHaveBeenCalledWith('col-1', { name: 'New Collection Name' });
  });

  it('renames an environment tab via commitRename', () => {
    mockStore([makeTab({ type: 'environment', requestId: null, collectionId: null, environmentId: 'env-1' })]);
    vi.mocked(getRequest).mockReturnValue(null as unknown as ReturnType<typeof getRequest>);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Env Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateEnvironment).toHaveBeenCalledWith('env-1', { name: 'New Env Name' });
  });

  it('renames an openapi tab via commitRename', () => {
    mockStore([makeTab({ type: 'openapi', requestId: null, collectionId: null, openApiDocId: 'doc-1' })]);
    vi.mocked(getRequest).mockReturnValue(null as unknown as ReturnType<typeof getRequest>);
    render(<TabBar />);
    fireEvent.doubleClick(document.querySelector('.tab-item')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Doc Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateOpenApiDocument).toHaveBeenCalledWith('doc-1', { name: 'New Doc Name' });
  });

  it('"Close Tabs to Right" is disabled for the last tab', () => {
    mockStore([makeTab({ id: 'tab-1', title: 'Only' })]);
    render(<TabBar />);
    fireEvent.contextMenu(document.querySelector('.tab-item')!);
    const btn = screen.getByText('Close Tabs to Right');
    expect(btn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  it('"Close Tabs to Left" is disabled for the first tab', () => {
    mockStore([makeTab({ id: 'tab-1', title: 'Only' })]);
    render(<TabBar />);
    fireEvent.contextMenu(document.querySelector('.tab-item')!);
    const btn = screen.getByText('Close Tabs to Left');
    expect(btn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  it('"Close Other Tabs" is disabled when only one tab', () => {
    mockStore([makeTab({ id: 'tab-1', title: 'Only' })]);
    render(<TabBar />);
    fireEvent.contextMenu(document.querySelector('.tab-item')!);
    const btn = screen.getByText('Close Other Tabs');
    expect(btn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });
});
