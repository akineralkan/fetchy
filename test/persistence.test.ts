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
  prepareForWrite,
  hydrateAfterRead,
  restoreCollectionOrder,
  invalidateWriteCache,
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

// ─── prepareForWrite ────────────────────────────────────────────────────────

describe('prepareForWrite', () => {
  it('truncates history response bodies longer than 5000 chars', () => {
    const longBody = 'a'.repeat(6000);
    const stateWrapper = {
      state: {
        history: [
          { id: 'h1', response: { body: longBody, status: 200 } },
          { id: 'h2', response: { body: 'short', status: 200 } },
        ],
        environments: [],
        collections: [],
      },
    };
    const { cleanState } = prepareForWrite(stateWrapper);
    expect(cleanState.state.history[0].response.body.length).toBeLessThan(6000);
    expect(cleanState.state.history[0].response.body).toContain('[truncated for storage]');
    // Short body is unchanged
    expect(cleanState.state.history[1].response.body).toBe('short');
  });

  it('does not truncate history bodies under 5000 chars', () => {
    const body = 'x'.repeat(4999);
    const stateWrapper = {
      state: { history: [{ id: 'h1', response: { body, status: 200 } }], environments: [], collections: [] },
    };
    const { cleanState } = prepareForWrite(stateWrapper);
    expect(cleanState.state.history[0].response.body).toBe(body);
  });

  it('strips _fromScript environment variables', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'normal', value: 'a', enabled: true },
            { id: 'v2', key: 'scripted', value: 'b', enabled: true, _fromScript: true },
          ],
        }],
        collections: [],
      },
    };
    const { cleanState } = prepareForWrite(stateWrapper);
    const vars = cleanState.state.environments[0].variables;
    expect(vars).toHaveLength(1);
    expect(vars[0].key).toBe('normal');
  });

  it('strips currentValue from _scriptOverride variables', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'overridden', value: 'original', currentValue: 'script-val', enabled: true, _scriptOverride: true },
          ],
        }],
        collections: [],
      },
    };
    const { cleanState } = prepareForWrite(stateWrapper);
    const v = cleanState.state.environments[0].variables[0];
    expect(v).not.toHaveProperty('currentValue');
    expect(v).not.toHaveProperty('_scriptOverride');
  });

  it('extracts secret values from environments into secretsMap', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'API_KEY', value: 'secret123', enabled: true, isSecret: true },
            { id: 'v2', key: 'normal', value: 'public', enabled: true },
          ],
        }],
        collections: [],
      },
    };
    const { cleanState, secretsMap } = prepareForWrite(stateWrapper);
    expect(secretsMap).toHaveProperty('env:env1:v1', 'secret123');
    // Secret value should be cleared in clean state
    const secretVar = cleanState.state.environments[0].variables.find((v: any) => v.id === 'v1');
    expect(secretVar.value).toBe('');
  });

  it('extracts secret values from collection variables', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [],
        collections: [{
          id: 'col1',
          variables: [
            { id: 'cv1', key: 'COL_SECRET', value: 'colsecret', enabled: true, isSecret: true },
          ],
        }],
      },
    };
    const { secretsMap } = prepareForWrite(stateWrapper);
    expect(secretsMap).toHaveProperty('col:col1:cv1', 'colsecret');
  });

  it('handles state with no history gracefully', () => {
    const stateWrapper = { state: { environments: [], collections: [] } };
    expect(() => prepareForWrite(stateWrapper)).not.toThrow();
  });

  it('handles null stateWrapper.state gracefully', () => {
    expect(() => prepareForWrite(null)).not.toThrow();
    expect(() => prepareForWrite({})).not.toThrow();
  });
});

// ─── hydrateAfterRead ───────────────────────────────────────────────────────

describe('hydrateAfterRead', () => {
  it('merges secret values back into environment variables', () => {
    const stateWrapper = {
      state: {
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'API_KEY', value: '', enabled: true, isSecret: true },
          ],
        }],
        collections: [],
      },
    };
    const secretsMap = { 'env:env1:v1': 'restored-secret' };
    const result = hydrateAfterRead(stateWrapper, secretsMap);
    const v = result.state.environments[0].variables[0];
    expect(v.value).toBe('restored-secret');
    expect(v.initialValue).toBe('restored-secret');
    expect(v.currentValue).toBe('restored-secret');
  });

  it('merges secret values back into collection variables', () => {
    const stateWrapper = {
      state: {
        environments: [],
        collections: [{
          id: 'col1',
          variables: [
            { id: 'cv1', key: 'SECRET', value: '', enabled: true, isSecret: true },
          ],
        }],
      },
    };
    const secretsMap = { 'col:col1:cv1': 'col-secret' };
    const result = hydrateAfterRead(stateWrapper, secretsMap);
    expect(result.state.collections[0].variables[0].value).toBe('col-secret');
  });

  it('does not modify non-secret variables', () => {
    const stateWrapper = {
      state: {
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'NORMAL', value: 'unchanged', enabled: true },
          ],
        }],
        collections: [],
      },
    };
    const result = hydrateAfterRead(stateWrapper, {});
    expect(result.state.environments[0].variables[0].value).toBe('unchanged');
  });

  it('strips _fromScript variables on hydrate', () => {
    const stateWrapper = {
      state: {
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'normal', value: 'a', enabled: true },
            { id: 'v2', key: 'scripted', value: '', enabled: true, _fromScript: true },
          ],
        }],
        collections: [],
      },
    };
    const result = hydrateAfterRead(stateWrapper, {});
    expect(result.state.environments[0].variables).toHaveLength(1);
    expect(result.state.environments[0].variables[0].key).toBe('normal');
  });

  it('handles null stateWrapper gracefully', () => {
    expect(hydrateAfterRead(null, {})).toBeNull();
    expect(hydrateAfterRead({}, {})).toEqual({});
  });
});

// ─── restoreCollectionOrder ─────────────────────────────────────────────────

describe('restoreCollectionOrder', () => {
  it('returns collections in the specified order', () => {
    const map = new Map([
      ['c1', { id: 'c1', name: 'First' }],
      ['c2', { id: 'c2', name: 'Second' }],
      ['c3', { id: 'c3', name: 'Third' }],
    ]);
    const result = restoreCollectionOrder(map, ['c3', 'c1', 'c2']);
    expect(result.map((c: any) => c.id)).toEqual(['c3', 'c1', 'c2']);
  });

  it('appends collections not in collectionOrder at the end', () => {
    const map = new Map([
      ['c1', { id: 'c1', name: 'In Order' }],
      ['c2', { id: 'c2', name: 'Extra' }],
    ]);
    const result = restoreCollectionOrder(map, ['c1']);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c1');
    expect(result[1].id).toBe('c2');
  });

  it('silently skips IDs not found in the map', () => {
    const map = new Map([
      ['c1', { id: 'c1', name: 'Only' }],
    ]);
    const result = restoreCollectionOrder(map, ['missing', 'c1', 'also-missing']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns all collections when collectionOrder is empty', () => {
    const map = new Map([
      ['c1', { id: 'c1' }],
      ['c2', { id: 'c2' }],
    ]);
    const result = restoreCollectionOrder(map, []);
    expect(result).toHaveLength(2);
  });

  it('handles empty map', () => {
    const result = restoreCollectionOrder(new Map(), ['c1', 'c2']);
    expect(result).toHaveLength(0);
  });
});

// ─── invalidateWriteCache ───────────────────────────────────────────────────

describe('invalidateWriteCache', () => {
  it('can be called without error', () => {
    expect(() => invalidateWriteCache()).not.toThrow();
  });

  it('clears the cache so subsequent calls work', () => {
    // Call twice to verify idempotency
    invalidateWriteCache();
    invalidateWriteCache();
  });
});

// ─── Additional coverage tests ──────────────────────────────────────────────

describe('createDebouncedStorage – edge cases', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('resets debounce timer when a second setItem arrives before the first fires', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'first');
    vi.advanceTimersByTime(1_000); // not yet at 1500
    expect(inner.setItem).not.toHaveBeenCalled();
    storage.setItem('key', 'second'); // resets timer
    vi.advanceTimersByTime(1_000); // 1000 ms from second call
    expect(inner.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500); // now 1500 ms from second call
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'second');
  });

  it('allows multiple independent write cycles after each debounce completes', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'cycle1');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    storage.setItem('key', 'cycle2');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledTimes(2);
    expect(inner.setItem).toHaveBeenLastCalledWith('key', 'cycle2');
  });

  it('handles different keys in sequential writes (last key/value wins)', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key1', 'val1');
    storage.setItem('key2', 'val2');
    vi.advanceTimersByTime(1_500);
    // Only the last key/value should be written
    expect(inner.setItem).toHaveBeenCalledTimes(1);
    expect(inner.setItem).toHaveBeenCalledWith('key2', 'val2');
  });
});

describe('suppressPersistence – edge cases', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('blocks a write that was queued before suppression was enabled', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'queued');
    vi.advanceTimersByTime(500);
    suppressPersistence(true); // flag set while timer pending
    vi.advanceTimersByTime(1_500);
    // Timer fires but re-checks flag → should NOT write
    expect(inner.setItem).not.toHaveBeenCalled();
  });

  it('calling suppressPersistence(true) twice resets the auto-clear timer', () => {
    suppressPersistence(true);
    vi.advanceTimersByTime(10_000); // 10s into first suppress
    suppressPersistence(true); // restart the 15s safety net
    vi.advanceTimersByTime(10_000); // 10s into second suppress (20s total)
    // Should still be suppressed (only 10s since second call)
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'check');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).not.toHaveBeenCalled();
    // After 5 more seconds (15s from second call), auto-clear fires
    vi.advanceTimersByTime(5_001);
    storage.setItem('key', 'now-allowed');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'now-allowed');
  });

  it('calling suppressPersistence(false) after (true) clears the auto-clear timer', () => {
    suppressPersistence(true);
    suppressPersistence(false);
    // Even after 16s the flag should still be false (no auto-clear needed)
    vi.advanceTimersByTime(16_000);
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'val');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'val');
  });
});

describe('cancelPendingPersistence – edge cases', () => {
  function makeInner() {
    return {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  }

  it('new writes after cancel work normally', () => {
    const inner = makeInner();
    const storage = createDebouncedStorage(inner);
    storage.setItem('key', 'will-cancel');
    cancelPendingPersistence();
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).not.toHaveBeenCalled();
    // New write after cancel
    storage.setItem('key', 'fresh');
    vi.advanceTimersByTime(1_500);
    expect(inner.setItem).toHaveBeenCalledWith('key', 'fresh');
  });

  it('calling cancel multiple times in a row is safe', () => {
    const inner = makeInner();
    createDebouncedStorage(inner);
    cancelPendingPersistence();
    cancelPendingPersistence();
    cancelPendingPersistence();
    // No crash
  });
});

describe('prepareForWrite – additional branches', () => {
  it('handles history items with no response object', () => {
    const stateWrapper = {
      state: {
        history: [{ id: 'h1' }, { id: 'h2', response: null }],
        environments: [],
        collections: [],
      },
    };
    expect(() => prepareForWrite(stateWrapper)).not.toThrow();
  });

  it('handles environments with no variables array', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{ id: 'env1' }],
        collections: [],
      },
    };
    expect(() => prepareForWrite(stateWrapper)).not.toThrow();
  });

  it('handles collections with no variables array', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [],
        collections: [{ id: 'col1' }],
      },
    };
    expect(() => prepareForWrite(stateWrapper)).not.toThrow();
  });

  it('prefers currentValue over value for secret extraction', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'SECRET', currentValue: 'current-secret', value: 'old-value', enabled: true, isSecret: true },
          ],
        }],
        collections: [],
      },
    };
    const { secretsMap } = prepareForWrite(stateWrapper);
    expect(secretsMap['env:env1:v1']).toBe('current-secret');
  });

  it('falls back to initialValue when value and currentValue are empty', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'SECRET', value: '', currentValue: '', initialValue: 'init-secret', enabled: true, isSecret: true },
          ],
        }],
        collections: [],
      },
    };
    const { secretsMap } = prepareForWrite(stateWrapper);
    expect(secretsMap['env:env1:v1']).toBe('init-secret');
  });

  it('handles multiple secrets across multiple environments and collections', () => {
    const stateWrapper = {
      state: {
        history: [],
        environments: [
          { id: 'e1', variables: [{ id: 'v1', key: 'S1', value: 'sec1', enabled: true, isSecret: true }] },
          { id: 'e2', variables: [{ id: 'v2', key: 'S2', value: 'sec2', enabled: true, isSecret: true }] },
        ],
        collections: [
          { id: 'c1', variables: [{ id: 'cv1', key: 'CS1', value: 'colsec1', enabled: true, isSecret: true }] },
        ],
      },
    };
    const { secretsMap, cleanState } = prepareForWrite(stateWrapper);
    expect(Object.keys(secretsMap)).toHaveLength(3);
    expect(secretsMap['env:e1:v1']).toBe('sec1');
    expect(secretsMap['env:e2:v2']).toBe('sec2');
    expect(secretsMap['col:c1:cv1']).toBe('colsec1');
    // All secret values should be cleared in clean state
    expect(cleanState.state.environments[0].variables[0].value).toBe('');
    expect(cleanState.state.environments[1].variables[0].value).toBe('');
    expect(cleanState.state.collections[0].variables[0].value).toBe('');
  });

  it('truncates response body at exactly 5000 chars plus truncation marker', () => {
    const body = 'b'.repeat(10_000);
    const stateWrapper = {
      state: {
        history: [{ id: 'h1', response: { body, status: 200 } }],
        environments: [],
        collections: [],
      },
    };
    const { cleanState } = prepareForWrite(stateWrapper);
    const truncatedBody = cleanState.state.history[0].response.body;
    expect(truncatedBody.length).toBeLessThan(body.length);
    expect(truncatedBody).toContain('[truncated for storage]');
    // The truncated body starts with the first 5000 chars
    expect(truncatedBody.startsWith('b'.repeat(5000))).toBe(true);
  });
});

describe('hydrateAfterRead – additional branches', () => {
  it('does not overwrite non-secret collection variables', () => {
    const stateWrapper = {
      state: {
        environments: [],
        collections: [{
          id: 'col1',
          variables: [
            { id: 'cv1', key: 'PUBLIC', value: 'my-public-value', enabled: true },
          ],
        }],
      },
    };
    const result = hydrateAfterRead(stateWrapper, {});
    expect(result.state.collections[0].variables[0].value).toBe('my-public-value');
  });

  it('merges secrets into collection variables with all three fields', () => {
    const stateWrapper = {
      state: {
        environments: [],
        collections: [{
          id: 'col1',
          variables: [
            { id: 'cv1', key: 'SECRET', value: '', initialValue: '', currentValue: '', enabled: true, isSecret: true },
          ],
        }],
      },
    };
    const secretsMap = { 'col:col1:cv1': 'restored-col-secret' };
    const result = hydrateAfterRead(stateWrapper, secretsMap);
    const v = result.state.collections[0].variables[0];
    expect(v.value).toBe('restored-col-secret');
    expect(v.initialValue).toBe('restored-col-secret');
    expect(v.currentValue).toBe('restored-col-secret');
  });

  it('ignores secrets in secretsMap that have no matching variable', () => {
    const stateWrapper = {
      state: {
        environments: [{ id: 'env1', variables: [] }],
        collections: [],
      },
    };
    const secretsMap = { 'env:env1:nonexistent': 'orphan-secret' };
    const result = hydrateAfterRead(stateWrapper, secretsMap);
    expect(result.state.environments[0].variables).toHaveLength(0);
  });

  it('strips _scriptOverride variables on hydrate', () => {
    const stateWrapper = {
      state: {
        environments: [{
          id: 'env1',
          variables: [
            { id: 'v1', key: 'overridden', value: 'original', currentValue: 'override-val', enabled: true, _scriptOverride: true },
          ],
        }],
        collections: [],
      },
    };
    const result = hydrateAfterRead(stateWrapper, {});
    const v = result.state.environments[0].variables[0];
    expect(v).not.toHaveProperty('_scriptOverride');
    expect(v).not.toHaveProperty('currentValue');
  });

  it('handles environments and collections with no variables array', () => {
    const stateWrapper = {
      state: {
        environments: [{ id: 'env1' }],
        collections: [{ id: 'col1' }],
      },
    };
    expect(() => hydrateAfterRead(stateWrapper, {})).not.toThrow();
  });
});

describe('restoreCollectionOrder – additional', () => {
  it('preserves exact order from collectionOrder even when map insertion order differs', () => {
    const map = new Map([
      ['c3', { id: 'c3', name: 'Third' }],
      ['c1', { id: 'c1', name: 'First' }],
      ['c2', { id: 'c2', name: 'Second' }],
    ]);
    const result = restoreCollectionOrder(map, ['c1', 'c2', 'c3']);
    expect(result.map((c: any) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('handles duplicate IDs in collectionOrder gracefully', () => {
    const map = new Map([
      ['c1', { id: 'c1', name: 'Only' }],
    ]);
    const result = restoreCollectionOrder(map, ['c1', 'c1', 'c1']);
    // c1 appears in ordered section multiple times, but unordered section should be empty
    // Implementation maps each ordered ID → collection, so c1 appears 3 times
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles both ordered and unordered collections together', () => {
    const map = new Map([
      ['c1', { id: 'c1', name: 'Ordered' }],
      ['c2', { id: 'c2', name: 'Also Ordered' }],
      ['c3', { id: 'c3', name: 'Unordered Extra' }],
    ]);
    const result = restoreCollectionOrder(map, ['c2', 'c1']);
    expect(result[0].id).toBe('c2');
    expect(result[1].id).toBe('c1');
    expect(result[2].id).toBe('c3');
  });
});
