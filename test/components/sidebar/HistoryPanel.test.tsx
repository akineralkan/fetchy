// @vitest-environment jsdom

/**
 * Tests for src/components/sidebar/HistoryPanel.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HistoryPanel from '../../../src/components/sidebar/HistoryPanel';
import { useAppStore } from '../../../src/store/appStore';

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../../src/utils/helpers', () => ({
  getMethodBgColor: vi.fn(() => 'bg-blue-500'),
}));

const mockUseAppStore = useAppStore as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeHistoryItem(overrides?: object) {
  return {
    id: 'hist-1',
    timestamp: Date.now() - 60000, // 1 minute ago
    request: {
      id: 'req-1',
      name: 'Get Users',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [],
      params: [],
      body: { type: 'none' },
      auth: { type: 'none' },
      preScript: '',
      script: '',
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"result":"ok"}',
      time: 120,
      size: 256,
    },
    ...overrides,
  };
}

function setupStore(history: any[], clearHistory = vi.fn()) {
  mockUseAppStore.mockImplementation((selector: any) => {
    const state = { history, clearHistory };
    return selector ? selector(state) : state;
  });
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('HistoryPanel – empty state', () => {
  it('shows empty state message when history is empty', () => {
    setupStore([]);
    render(<HistoryPanel />);
    expect(screen.getByText(/no request history/i)).toBeTruthy();
  });

  it('does not render history items in empty state', () => {
    setupStore([]);
    render(<HistoryPanel />);
    expect(screen.queryByText('Get Users')).not.toBeTruthy();
  });
});

// ─── With history items ───────────────────────────────────────────────────────

describe('HistoryPanel – with history', () => {
  it('renders a history item with request name', () => {
    setupStore([makeHistoryItem()]);
    render(<HistoryPanel />);
    expect(screen.getByText('Get Users')).toBeTruthy();
  });

  it('renders item count', () => {
    setupStore([makeHistoryItem(), makeHistoryItem({ id: 'hist-2' })]);
    render(<HistoryPanel />);
    expect(screen.getByText(/2 request/i)).toBeTruthy();
  });

  it('renders response status code', () => {
    setupStore([makeHistoryItem()]);
    render(<HistoryPanel />);
    expect(screen.getByText(/200/)).toBeTruthy();
  });

  it('renders the request URL', () => {
    setupStore([makeHistoryItem()]);
    render(<HistoryPanel />);
    expect(screen.getByText('https://api.example.com/users')).toBeTruthy();
  });

  it('renders Clear All button', () => {
    setupStore([makeHistoryItem()]);
    render(<HistoryPanel />);
    expect(screen.getByText(/clear all/i)).toBeTruthy();
  });

  it('calls clearHistory when Clear All is clicked', () => {
    const clearHistory = vi.fn();
    setupStore([makeHistoryItem()], clearHistory);
    render(<HistoryPanel />);
    fireEvent.click(screen.getByText(/clear all/i));
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });

  it('calls onHistoryItemClick when an item is clicked', () => {
    const item = makeHistoryItem();
    setupStore([item]);
    const onClick = vi.fn();
    render(<HistoryPanel onHistoryItemClick={onClick} />);
    // Click the item div
    const itemEl = screen.getByTitle(/click to load/i);
    fireEvent.click(itemEl);
    expect(onClick).toHaveBeenCalledWith(item);
  });
});

// ─── Time formatting ──────────────────────────────────────────────────────────

describe('HistoryPanel – time formatting', () => {
  it('shows "Just now" for very recent requests', () => {
    const recentItem = makeHistoryItem({ timestamp: Date.now() - 5000 }); // 5 seconds ago
    setupStore([recentItem]);
    render(<HistoryPanel />);
    expect(screen.getByText(/just now/i)).toBeTruthy();
  });

  it('shows minutes for requests a few minutes ago', () => {
    const item = makeHistoryItem({ timestamp: Date.now() - 5 * 60000 }); // 5 minutes ago
    setupStore([item]);
    render(<HistoryPanel />);
    expect(screen.getByText(/5m ago/i)).toBeTruthy();
  });
});

// ─── Response size formatting ─────────────────────────────────────────────────

describe('HistoryPanel – response size', () => {
  it('shows size in B for small responses', () => {
    const item = makeHistoryItem({ response: { status: 200, statusText: 'OK', headers: {}, body: '{}', time: 10, size: 512 } });
    setupStore([item]);
    render(<HistoryPanel />);
    expect(screen.getByText(/512 B/)).toBeTruthy();
  });

  it('shows size in KB for larger responses', () => {
    const item = makeHistoryItem({ response: { status: 200, statusText: 'OK', headers: {}, body: '{}', time: 10, size: 2048 } });
    setupStore([item]);
    render(<HistoryPanel />);
    expect(screen.getByText(/KB/)).toBeTruthy();
  });
});
