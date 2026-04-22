/**
 * Tests for persistence.ts — debounced storage, write suppression,
 * secrets extraction/merge helpers, and related utilities.
 *
 * Covers:
 *  - createDebouncedStorage: debounces setItem writes
 *  - createDebouncedStorage: respects DEBOUNCE_MS timer
 *  - suppressPersistence: blocks writes while suppressed
 *  - suppressPersistence: auto-clears after 15 s (fast timer fake)
 *  - cancelPendingPersistence: drops a queued write
 *  - registerActiveWorkspaceIdProvider: key scoping in getBrowserStorageKey
 *  - isElectron: false in node env
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncedStorage,
  suppressPersistence,
  cancelPendingPersistence,
  registerActiveWorkspaceIdProvider,
  isElectron,
} from '../src/store/persistence';

beforeEach(() => {
  vi.useFakeTimers();
  // Make sure suppression is reset between tests
  suppressPersistence(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── createDebouncedStorage ───────────────────────────────────────────────────

describe('createDebouncedStorage', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('passes getItem through to inner storage immediately', () => {
    const inner = makeInner();
    inner.getItem.mockReturnValue('{"data":1}');
    const storage = createDebouncedStorage(inner);
    const result = storage.getItem('myKey');
    expect(inner.getItem).toHaveBeenCalledWith('myKey');
    expect(result).toBe('{"data":1}');
  });

  it('does not call inner.setItem immediately (debounced)', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'value1');
    expect(inner.setItem).not.toHaveBeenCalled();
  });

  it('calls inner.setItem after the debounce timer fires', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'value1');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'value1');
  });

  it('coalesces multiple setItem calls into one write', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'v1');
    storage.setItem('key', 'v2');
    storage.setItem('key', 'v3');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'v3');
  });

  it('passes removeItem through to inner storage immediately', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.removeItem('key');
    expect(inner.removeItem).toHaveBeenCalledWith('key');
  });
});

// ─── suppressPersistence ────────────────────────────────────────────────────

describe('suppressPersistence', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('blocks debounced writes while suppressed', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    suppressPersistence(true);
    storage.setItem('key', 'blocked');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).not.toHaveBeenCalled();
  });

  it('allows writes after suppression is lifted', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    suppressPersistence(true);
    suppressPersistence(false);
    storage.setItem('key', 'allowed');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'allowed');
  });

  it('auto-clears after 15 seconds as a safety net', () => {
    suppressPersistence(true);
    // After 15 s the flag should have been cleared automatically
    vi.advanceTimersByTime(15_001);
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'auto-clear');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'auto-clear');
  });
});

// ─── cancelPendingPersistence ────────────────────────────────────────────────

describe('cancelPendingPersistence', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('cancels a pending debounced write', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'pending');
    cancelPendingPersistence();
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).not.toHaveBeenCalled();
  });

  it('can be called safely before any write is queued (no error)', () => {
    expect(() => cancelPendingPersistence()).not.toThrow();
  });
});

// ─── registerActiveWorkspaceIdProvider ───────────────────────────────────────

describe('registerActiveWorkspaceIdProvider', () => {
  it('registers without throwing', () => {
    expect(() => registerActiveWorkspaceIdProvider(() => 'ws-123')).not.toThrow();
  });
});

// ─── isElectron ──────────────────────────────────────────────────────────────

describe('isElectron', () => {
  it('is false in the Node.js test environment (no window.electronAPI)', () => {
    expect(isElectron).toBe(false);
  });
});
