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
 *  - GH-86: getEffectiveBinding, formatShortcutBinding, matchesBinding utilities
 *  - GH-86: DEFAULT_KEYBOARD_SHORTCUTS structure
 *  - GH-86: Custom bindings from preferences override defaults in the hook
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

import {
  useKeyboardShortcuts,
  getEffectiveBinding,
  formatShortcutBinding,
  matchesBinding,
  DEFAULT_KEYBOARD_SHORTCUTS,
  SHORTCUT_ACTIONS,
} from '../src/hooks/useKeyboardShortcuts';
import { useAppStore } from '../src/store/appStore';
import { usePreferencesStore } from '../src/store/preferencesStore';
import { ShortcutBinding, KeyboardShortcutsConfig } from '../src/types';

vi.mock('../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
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

// ─── Pure Utility Function Tests ─────────────────────────────────────────────

describe('DEFAULT_KEYBOARD_SHORTCUTS', () => {
  it('defines all 9 expected action IDs', () => {
    const ids = Object.keys(DEFAULT_KEYBOARD_SHORTCUTS);
    expect(ids).toContain('close-tab');
    expect(ids).toContain('next-tab');
    expect(ids).toContain('prev-tab');
    expect(ids).toContain('new-request');
    expect(ids).toContain('import');
    expect(ids).toContain('open-environments');
    expect(ids).toContain('show-shortcuts');
    expect(ids).toContain('save-request');
    expect(ids).toContain('send-request');
    expect(ids).toHaveLength(9);
  });

  it('close-tab defaults to Ctrl+W', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['close-tab']).toEqual({ ctrl: true, key: 'w' });
  });

  it('next-tab defaults to Ctrl+Tab', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['next-tab']).toEqual({ ctrl: true, key: 'Tab' });
  });

  it('prev-tab defaults to Ctrl+Shift+Tab', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['prev-tab']).toEqual({ ctrl: true, shift: true, key: 'Tab' });
  });

  it('save-request defaults to Ctrl+S', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['save-request']).toEqual({ ctrl: true, key: 's' });
  });

  it('send-request defaults to Ctrl+Enter', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['send-request']).toEqual({ ctrl: true, key: 'Enter' });
  });

  it('show-shortcuts defaults to Ctrl+/', () => {
    expect(DEFAULT_KEYBOARD_SHORTCUTS['show-shortcuts']).toEqual({ ctrl: true, key: '/' });
  });
});

describe('SHORTCUT_ACTIONS', () => {
  it('has an entry for every action in DEFAULT_KEYBOARD_SHORTCUTS', () => {
    const defaultIds = Object.keys(DEFAULT_KEYBOARD_SHORTCUTS);
    const actionIds = SHORTCUT_ACTIONS.map(a => a.id);
    for (const id of defaultIds) {
      expect(actionIds).toContain(id);
    }
  });

  it('each action has id, label and group', () => {
    for (const action of SHORTCUT_ACTIONS) {
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('group');
      expect(typeof action.id).toBe('string');
      expect(typeof action.label).toBe('string');
      expect(typeof action.group).toBe('string');
    }
  });
});

describe('getEffectiveBinding', () => {
  it('returns the default binding when no config is provided', () => {
    const binding = getEffectiveBinding('close-tab');
    expect(binding).toEqual({ ctrl: true, key: 'w' });
  });

  it('returns the default binding when config is undefined', () => {
    const binding = getEffectiveBinding('save-request', undefined);
    expect(binding).toEqual({ ctrl: true, key: 's' });
  });

  it('returns the default binding when the action is not in config', () => {
    const config: KeyboardShortcutsConfig = { 'new-request': { ctrl: true, key: 'k' } };
    const binding = getEffectiveBinding('close-tab', config);
    expect(binding).toEqual({ ctrl: true, key: 'w' });
  });

  it('returns a custom binding when the action is present in config', () => {
    const custom: ShortcutBinding = { ctrl: true, alt: true, key: 'q' };
    const config: KeyboardShortcutsConfig = { 'close-tab': custom };
    const binding = getEffectiveBinding('close-tab', config);
    expect(binding).toEqual(custom);
  });

  it('returns null when the action is explicitly disabled (set to null) in config', () => {
    const config: KeyboardShortcutsConfig = { 'close-tab': null };
    const binding = getEffectiveBinding('close-tab', config);
    expect(binding).toBeNull();
  });

  it('returns a custom binding for send-request when overridden', () => {
    const custom: ShortcutBinding = { ctrl: true, shift: true, key: 'r' };
    const config: KeyboardShortcutsConfig = { 'send-request': custom };
    const binding = getEffectiveBinding('send-request', config);
    expect(binding).toEqual(custom);
  });

  it('returns defaults for actions not touched by a partial config', () => {
    const config: KeyboardShortcutsConfig = { 'close-tab': { ctrl: true, key: 'q' } };
    // next-tab is untouched
    expect(getEffectiveBinding('next-tab', config)).toEqual(DEFAULT_KEYBOARD_SHORTCUTS['next-tab']);
    expect(getEffectiveBinding('prev-tab', config)).toEqual(DEFAULT_KEYBOARD_SHORTCUTS['prev-tab']);
  });
});

describe('formatShortcutBinding', () => {
  it('returns "Disabled" for null binding', () => {
    expect(formatShortcutBinding(null)).toBe('Disabled');
  });

  it('formats Ctrl+W correctly', () => {
    expect(formatShortcutBinding({ ctrl: true, key: 'w' })).toBe('Ctrl+W');
  });

  it('formats Ctrl+Shift+Tab correctly', () => {
    expect(formatShortcutBinding({ ctrl: true, shift: true, key: 'Tab' })).toBe('Ctrl+Shift+Tab');
  });

  it('formats Ctrl+Alt+key correctly', () => {
    expect(formatShortcutBinding({ ctrl: true, alt: true, key: 'p' })).toBe('Ctrl+Alt+P');
  });

  it('formats Ctrl+Enter correctly', () => {
    expect(formatShortcutBinding({ ctrl: true, key: 'Enter' })).toBe('Ctrl+Enter');
  });

  it('formats Ctrl+/ correctly (show-shortcuts default)', () => {
    expect(formatShortcutBinding({ ctrl: true, key: '/' })).toBe('Ctrl+/');
  });

  it('formats Space key correctly', () => {
    expect(formatShortcutBinding({ ctrl: true, key: ' ' })).toBe('Ctrl+Space');
  });

  it('formats Escape key correctly', () => {
    expect(formatShortcutBinding({ key: 'Escape' })).toBe('Esc');
  });

  it('formats arrow keys with symbols', () => {
    expect(formatShortcutBinding({ ctrl: true, key: 'ArrowUp' })).toBe('Ctrl+↑');
    expect(formatShortcutBinding({ ctrl: true, key: 'ArrowDown' })).toBe('Ctrl+↓');
    expect(formatShortcutBinding({ ctrl: true, key: 'ArrowLeft' })).toBe('Ctrl+←');
    expect(formatShortcutBinding({ ctrl: true, key: 'ArrowRight' })).toBe('Ctrl+→');
  });

  it('uppercases plain letter keys', () => {
    expect(formatShortcutBinding({ ctrl: true, key: 'k' })).toBe('Ctrl+K');
  });

  it('formats modifier-only orderings: Ctrl before Alt before Shift', () => {
    const result = formatShortcutBinding({ ctrl: true, alt: true, shift: true, key: 'x' });
    expect(result).toBe('Ctrl+Alt+Shift+X');
  });

  it('formats a binding with no modifiers (single key)', () => {
    expect(formatShortcutBinding({ key: 'F5' })).toBe('F5');
  });
});

describe('matchesBinding', () => {
  function makeKeyboardEvent(overrides: Partial<KeyboardEventInit>): KeyboardEvent {
    return new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...overrides,
    });
  }

  it('returns false for null binding', () => {
    const event = makeKeyboardEvent({ key: 'w', ctrlKey: true });
    expect(matchesBinding(event, null)).toBe(false);
  });

  it('matches Ctrl+W binding correctly', () => {
    const event = makeKeyboardEvent({ key: 'w', ctrlKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'w' })).toBe(true);
  });

  it('does not match when ctrl modifier differs', () => {
    const event = makeKeyboardEvent({ key: 'w', ctrlKey: false });
    expect(matchesBinding(event, { ctrl: true, key: 'w' })).toBe(false);
  });

  it('does not match when shift modifier differs', () => {
    const event = makeKeyboardEvent({ key: 'Tab', ctrlKey: true, shiftKey: false });
    expect(matchesBinding(event, { ctrl: true, shift: true, key: 'Tab' })).toBe(false);
  });

  it('does not match when alt modifier differs', () => {
    const event = makeKeyboardEvent({ key: 's', ctrlKey: true, altKey: false });
    expect(matchesBinding(event, { ctrl: true, alt: true, key: 's' })).toBe(false);
  });

  it('does not match when key differs', () => {
    const event = makeKeyboardEvent({ key: 'a', ctrlKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'w' })).toBe(false);
  });

  it('matches Ctrl+Shift+Tab correctly', () => {
    const event = makeKeyboardEvent({ key: 'Tab', ctrlKey: true, shiftKey: true });
    expect(matchesBinding(event, { ctrl: true, shift: true, key: 'Tab' })).toBe(true);
  });

  it('matches case-insensitively (event key "W" matches binding key "w")', () => {
    const event = makeKeyboardEvent({ key: 'W', ctrlKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'w' })).toBe(true);
  });

  it('matches case-insensitively (event key "w" matches binding key "W")', () => {
    const event = makeKeyboardEvent({ key: 'w', ctrlKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'W' })).toBe(true);
  });

  it('matches Ctrl+Enter correctly', () => {
    const event = makeKeyboardEvent({ key: 'Enter', ctrlKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'Enter' })).toBe(true);
  });

  it('treats undefined modifier flags as false', () => {
    // binding has no ctrl/shift/alt → all should be treated as false
    const event = makeKeyboardEvent({ key: 'F5' });
    expect(matchesBinding(event, { key: 'F5' })).toBe(true);
  });

  it('does not match extra modifiers not in the binding', () => {
    const event = makeKeyboardEvent({ key: 'w', ctrlKey: true, altKey: true });
    expect(matchesBinding(event, { ctrl: true, key: 'w' })).toBe(false);
  });
});

// ─── Hook Integration Tests with Custom Bindings ─────────────────────────────

describe('useKeyboardShortcuts', () => {
  const closeTab = vi.fn();
  const setActiveTab = vi.fn();

  function mockStore(
    tabs: ReturnType<typeof makeTab>[],
    activeTabId: string | null,
    customBindings?: KeyboardShortcutsConfig
  ) {
    vi.mocked(useAppStore).mockReturnValue({
      tabs,
      activeTabId,
      closeTab,
      setActiveTab,
    } as never);
    vi.mocked(usePreferencesStore).mockReturnValue({
      preferences: { keyboardShortcuts: customBindings },
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

  // ─── GH-86: Custom binding integration via hook ───────────────────────────

  it('uses a custom close-tab binding from preferences (Ctrl+Q instead of Ctrl+W)', () => {
    const config: KeyboardShortcutsConfig = { 'close-tab': { ctrl: true, key: 'q' } };
    mockStore([makeTab('t1'), makeTab('t2')], 't1', config);
    renderHook(() => useKeyboardShortcuts());

    // Default Ctrl+W should NOT close the tab anymore
    dispatchKey('w', { ctrlKey: true });
    expect(closeTab).not.toHaveBeenCalled();

    // Custom Ctrl+Q should close the tab
    dispatchKey('q', { ctrlKey: true });
    expect(closeTab).toHaveBeenCalledWith('t1');
  });

  it('respects a disabled (null) close-tab binding — Ctrl+W does nothing', () => {
    const config: KeyboardShortcutsConfig = { 'close-tab': null };
    mockStore([makeTab('t1'), makeTab('t2')], 't1', config);
    renderHook(() => useKeyboardShortcuts());

    dispatchKey('w', { ctrlKey: true });
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('uses a custom next-tab binding from preferences (Ctrl+] instead of Ctrl+Tab)', () => {
    const config: KeyboardShortcutsConfig = { 'next-tab': { ctrl: true, key: ']' } };
    mockStore([makeTab('t1'), makeTab('t2'), makeTab('t3')], 't1', config);
    renderHook(() => useKeyboardShortcuts());

    // Default Ctrl+Tab should NOT switch tabs
    dispatchKey('Tab', { ctrlKey: true });
    expect(setActiveTab).not.toHaveBeenCalled();

    // Custom Ctrl+] should switch to next tab
    dispatchKey(']', { ctrlKey: true });
    expect(setActiveTab).toHaveBeenCalledWith('t2');
  });

  it('falls back to default binding when config exists but does not include the action', () => {
    // Config only has 'new-request' override — 'close-tab' should use its default Ctrl+W
    const config: KeyboardShortcutsConfig = { 'new-request': { ctrl: true, key: 'k' } };
    mockStore([makeTab('t1'), makeTab('t2')], 't1', config);
    renderHook(() => useKeyboardShortcuts());

    dispatchKey('w', { ctrlKey: true });
    expect(closeTab).toHaveBeenCalledWith('t1');
  });
});

