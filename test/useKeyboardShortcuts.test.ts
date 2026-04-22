// @vitest-environment jsdom

/**
 * Tests for useKeyboardShortcuts.ts
 *
 * Covers:
 *  - Ctrl+W closes the active tab
 *  - Ctrl+Tab cycles to next tab
 *  - Ctrl+Shift+Tab cycles to previous tab
 *  - Ctrl+1-9 switches to a specific tab by index
 *  - Additional custom shortcuts are handled before built-ins
 *  - No crash when there are no tabs or activeTabId
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts';
import { useAppStore } from '../src/store/appStore';

vi.mock('../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function dispatchKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

function makeTab(id: string, title = 'Tab') {
  return { id, title, type: 'request' as const };
}

describe('useKeyboardShortcuts', () => {
  const closeTab = vi.fn();
  const setActiveTab = vi.fn();

  function mockStore(tabs: ReturnType<typeof makeTab>[], activeTabId: string | null) {
    vi.mocked(useAppStore).mockReturnValue({
      tabs,
      activeTabId,
      closeTab,
      setActiveTab,
    } as never);
  }

  it('calls closeTab with active tab id on Ctrl+W', () => {
    mockStore([makeTab('t1'), makeTab('t2')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('w', { ctrlKey: true });
    expect(closeTab).toHaveBeenCalledWith('t1');
  });

  it('does not close tab when no active tab', () => {
    mockStore([makeTab('t1')], null);
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('w', { ctrlKey: true });
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('switches to next tab on Ctrl+Tab', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('Tab', { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t2');
  });

  it('wraps from last to first tab on Ctrl+Tab', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't3');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('Tab', { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t1');
  });

  it('switches to previous tab on Ctrl+Shift+Tab', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't3');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('Tab', { ctrlKey: true, shiftKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t2');
  });

  it('wraps from first to last tab on Ctrl+Shift+Tab', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('Tab', { ctrlKey: true, shiftKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t3');
  });

  it('does not cycle when there is only one tab', () => {
    mockStore([makeTab('t1')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('Tab', { ctrlKey: true });
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('switches to first tab with Ctrl+1', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't3');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('1', { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t1');
  });

  it('switches to third tab with Ctrl+3', () => {
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('3', { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t3');
  });

  it('does not switch when Ctrl+N is pressed for out-of-range tab', () => {
    mockStore([makeTab('t1'), makeTab('t2')], 't1');
    renderHook(() => useKeyboardShortcuts());
    dispatchKey('9', { ctrlKey: true }); // only 2 tabs, tab 9 doesn't exist
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('calls custom additional shortcut handler', () => {
    mockStore([makeTab('t1')], 't1');
    const customHandler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 'n', ctrl: true, handler: customHandler, description: 'New request' },
      ])
    );
    dispatchKey('n', { ctrlKey: true });
    expect(customHandler).toHaveBeenCalled();
  });

  it('custom shortcut takes priority and prevents built-in from firing', () => {
    mockStore([makeTab('t1'), makeTab('t2')], 't1');
    const customHandler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 'w', ctrl: true, handler: customHandler, description: 'Custom W' },
      ])
    );
    dispatchKey('w', { ctrlKey: true });
    expect(customHandler).toHaveBeenCalled();
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    mockStore([makeTab('t1')], 't1');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
