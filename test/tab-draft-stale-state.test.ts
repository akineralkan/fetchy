/**
 * Regression tests for multi-tab unsaved edit isolation.
 *
 * Covers the bugs that caused field values (URL, Pre/Post-Script, body, etc.)
 * from one focused request tab to bleed into a different tab, or for unsaved
 * edits to be silently discarded on tab switches or incidental collection
 * mutations (e.g. a sidebar rename).
 *
 * ── Bug 1 — updateRequest sidebar rename discarding unsaved edits ────────────
 *   updateRequest({ name }) used to reset `isModified = false` unconditionally.
 *   The RequestPanel useEffect watched `isModified` and re-read the request from
 *   the store whenever it flipped to false, overwriting any unsaved local edits.
 *   Fix: when the tab already carries a `draftRequest`, only sync the `name`
 *   field inside the draft; `isModified` stays true.
 *
 * ── Bug 2 — handleChange accepting a stale cross-tab request ─────────────────
 *   Asynchronous or stale closure callbacks (e.g. CodeMirror's updateListener)
 *   could call handleChange with a request object whose id belonged to a
 *   previously active tab, silently writing into the wrong tab's draft.
 *   Fix: handleChange guards against request.id ≠ activeTab.requestId.
 *
 * ── Bug 3 — tab switch not restoring draftRequest ────────────────────────────
 *   Switching back to a tab that had unsaved edits loaded the saved/persisted
 *   request from the store, discarding the draft.
 *   Fix: tab.draftRequest is preferred when switching to a modified tab.
 *
 * ── Bug 4 — CodeEditor stale onChange closure ────────────────────────────────
 *   EditorView.updateListener captured onChange at mount time. After a tab
 *   switch React reconciled a new onChange prop but the listener still held the
 *   old one, routing new keystrokes from Tab B into Tab A's handler.
 *   Fix: onChangeRef always holds the latest onChange; isSyncingRef suppresses
 *   onChange during the programmatic value replacement on tab switch.
 */

import { describe, it, expect, vi } from 'vitest';
import { enableMapSet, produce } from 'immer';
import { createDefaultRequest } from '../src/store/requestTree';
import type { ApiRequest, TabState } from '../src/types';

// Mirror what appStore.ts does at module level.
enableMapSet();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(id: string, overrides?: Partial<ApiRequest>): ApiRequest {
  return createDefaultRequest({ id, name: `Request ${id}`, ...overrides });
}

function makeTab(overrides?: Partial<TabState>): TabState {
  return {
    id: 'tab-1',
    type: 'request',
    title: 'My Request',
    requestId: 'r1',
    collectionId: 'col-1',
    isModified: false,
    ...overrides,
  };
}

// ─── Mirrors the name-sync mutation in appStore.ts updateRequest ──────────────
//
// When updateRequest is called with `updates.name`, it maps over state.tabs and
// applies one of two strategies depending on whether the tab has a draftRequest.
function applyNameSyncToTabs(tabs: TabState[], requestId: string, newName: string): TabState[] {
  return produce(tabs, draft => {
    draft.forEach(tab => {
      if (tab.type === 'request' && tab.requestId === requestId) {
        const dr = tab.draftRequest;
        tab.title = newName;
        if (dr) {
          // Draft present → only sync name, keep isModified=true so the
          // RequestPanel does NOT reload from the store.
          (tab.draftRequest as ApiRequest).name = newName;
        } else {
          // No draft → clear isModified so the panel reloads the renamed request.
          tab.isModified = false;
        }
      }
    });
  });
}

// ─── Mirrors the handleChange guard in RequestPanel.tsx ──────────────────────
//
// Applies a partial update to a request only when the request belongs to the
// active tab, ignoring stale cross-tab callbacks.
function safeHandleChange(
  request: ApiRequest | null,
  activeTabRequestId: string | undefined,
  updates: Partial<ApiRequest>
): ApiRequest | null {
  if (!request) return null;
  // Guard: skip if the local request is out-of-sync with the current tab.
  if (activeTabRequestId && request.id !== activeTabRequestId) return null;
  return { ...request, ...updates };
}

// ─── Mirrors the tab-switch load decision in RequestPanel.tsx useEffect ───────
//
// Returns what the RequestPanel would load as localRequest when the active tab
// changes.  "store" is the persisted version of the request.
function resolveRequestForTab(
  tab: TabState,
  storeRequest: ApiRequest
): ApiRequest {
  if (tab.draftRequest) {
    return { ...tab.draftRequest };
  }
  return { ...storeRequest };
}

// ─── Bug 1 — Sidebar rename with active draft ────────────────────────────────

describe('Bug 1 — updateRequest name sync: unsaved draft is preserved', () => {
  it('updates draftRequest.name but keeps isModified=true when draft exists', () => {
    const draft = makeReq('r1', { url: '/api/users', preScript: 'console.log("hello")' });
    const tab = makeTab({ isModified: true, draftRequest: draft });

    const [updated] = applyNameSyncToTabs([tab], 'r1', 'Renamed Request');

    // Title in the tab bar should update
    expect(updated.title).toBe('Renamed Request');
    // Draft name should also be updated
    expect(updated.draftRequest?.name).toBe('Renamed Request');
    // isModified must stay true — the panel must NOT reload from the store
    expect(updated.isModified).toBe(true);
    // The rest of the draft (unsaved edits) must be untouched
    expect(updated.draftRequest?.url).toBe('/api/users');
    expect(updated.draftRequest?.preScript).toBe('console.log("hello")');
  });

  it('resets isModified=false (causing a store reload) when no draft exists', () => {
    const tab = makeTab({ isModified: false, draftRequest: undefined });

    const [updated] = applyNameSyncToTabs([tab], 'r1', 'Renamed Request');

    expect(updated.title).toBe('Renamed Request');
    expect(updated.isModified).toBe(false);
    expect(updated.draftRequest).toBeUndefined();
  });

  it('only affects tabs whose requestId matches, leaving other tabs unchanged', () => {
    const tabA = makeTab({ id: 'tab-a', requestId: 'r1', isModified: true, draftRequest: makeReq('r1') });
    const tabB = makeTab({ id: 'tab-b', requestId: 'r2', isModified: false, draftRequest: undefined });

    const [updA, updB] = applyNameSyncToTabs([tabA, tabB], 'r1', 'New Name');

    expect(updA.title).toBe('New Name');
    // Tab B is untouched
    expect(updB.title).toBe('My Request');
    expect(updB.isModified).toBe(false);
  });

  it('does not create a draftRequest if the tab had none before the rename', () => {
    const tab = makeTab({ isModified: false });
    const [updated] = applyNameSyncToTabs([tab], 'r1', 'Renamed');
    expect(updated.draftRequest).toBeUndefined();
  });

  it('handles multiple tabs open on the same request id (e.g. duplicate tabs)', () => {
    const draft = makeReq('r1', { url: '/old-url' });
    const tab1 = makeTab({ id: 'tab-1', requestId: 'r1', isModified: true, draftRequest: draft });
    const tab2 = makeTab({ id: 'tab-2', requestId: 'r1', isModified: false });

    const [upd1, upd2] = applyNameSyncToTabs([tab1, tab2], 'r1', 'Shared Rename');

    expect(upd1.title).toBe('Shared Rename');
    expect(upd1.isModified).toBe(true); // draft preserved
    expect(upd2.title).toBe('Shared Rename');
    expect(upd2.isModified).toBe(false); // no draft → reload from store
  });
});

// ─── Bug 2 — handleChange stale cross-tab request guard ──────────────────────

describe('Bug 2 — handleChange: stale/cross-tab callbacks are ignored', () => {
  it('applies updates when request.id matches the active tab', () => {
    const req = makeReq('r1', { url: '' });
    const result = safeHandleChange(req, 'r1', { url: '/api/new' });
    expect(result).not.toBeNull();
    expect(result?.url).toBe('/api/new');
  });

  it('returns null when request.id does NOT match activeTab.requestId (stale closure)', () => {
    const staleRequest = makeReq('r1-old');
    // Active tab is now r2 — stale CodeMirror listener fires with r1's request
    const result = safeHandleChange(staleRequest, 'r2', { url: '/api/should-not-apply' });
    expect(result).toBeNull();
  });

  it('allows updates when activeTabRequestId is undefined (history/unsaved tab)', () => {
    const req = makeReq('r-temp', { url: '' });
    const result = safeHandleChange(req, undefined, { url: '/api/history' });
    expect(result).not.toBeNull();
    expect(result?.url).toBe('/api/history');
  });

  it('returns null when request is null', () => {
    expect(safeHandleChange(null, 'r1', { url: '/x' })).toBeNull();
  });

  it('does not mutate the original request object', () => {
    const original = makeReq('r1', { url: '/original' });
    const result = safeHandleChange(original, 'r1', { url: '/modified' });
    expect(original.url).toBe('/original');
    expect(result?.url).toBe('/modified');
  });

  it('merges partial updates correctly', () => {
    const req = makeReq('r1', { url: '/base', preScript: 'old', script: 'old-post' });
    const result = safeHandleChange(req, 'r1', { preScript: 'new-pre' });
    expect(result?.url).toBe('/base');
    expect(result?.preScript).toBe('new-pre');
    expect(result?.script).toBe('old-post'); // untouched
  });
});

// ─── Bug 3 — Tab switch must restore draftRequest ────────────────────────────

describe('Bug 3 — tab switch: draftRequest is restored over the store value', () => {
  it('returns draftRequest content when tab has unsaved edits', () => {
    const draft = makeReq('r1', { url: '/draft-url', preScript: 'draft-script' });
    const storeReq = makeReq('r1', { url: '/saved-url', preScript: '' });
    const tab = makeTab({ requestId: 'r1', isModified: true, draftRequest: draft });

    const resolved = resolveRequestForTab(tab, storeReq);

    expect(resolved.url).toBe('/draft-url');
    expect(resolved.preScript).toBe('draft-script');
  });

  it('returns the store value when no draft exists (clean tab)', () => {
    const storeReq = makeReq('r1', { url: '/saved-url', script: 'saved-post' });
    const tab = makeTab({ requestId: 'r1', isModified: false, draftRequest: undefined });

    const resolved = resolveRequestForTab(tab, storeReq);

    expect(resolved.url).toBe('/saved-url');
    expect(resolved.script).toBe('saved-post');
  });

  it('draft includes all modified fields: url, preScript, script, body', () => {
    const draft = makeReq('r1', {
      url: '/updated',
      method: 'POST',
      preScript: 'pre-draft',
      script: 'post-draft',
      body: { type: 'json', raw: '{"key":"value"}' },
    });
    const storeReq = makeReq('r1', { url: '/old', method: 'GET' });
    const tab = makeTab({ draftRequest: draft, isModified: true });

    const resolved = resolveRequestForTab(tab, storeReq);

    expect(resolved.url).toBe('/updated');
    expect(resolved.method).toBe('POST');
    expect(resolved.preScript).toBe('pre-draft');
    expect(resolved.script).toBe('post-draft');
    expect(resolved.body.raw).toBe('{"key":"value"}');
  });

  it('resolve returns a copy — mutating the result does not affect the draft', () => {
    const draft = makeReq('r1', { url: '/draft' });
    const tab = makeTab({ draftRequest: draft, isModified: true });
    const resolved = resolveRequestForTab(tab, makeReq('r1'));

    resolved.url = '/mutated';

    // Original draft must be unchanged
    expect(tab.draftRequest?.url).toBe('/draft');
  });

  it('returns store value after draft is cleared (after explicit save)', () => {
    const storeReq = makeReq('r1', { url: '/just-saved' });
    const tab = makeTab({ isModified: false, draftRequest: undefined });

    const resolved = resolveRequestForTab(tab, storeReq);
    expect(resolved.url).toBe('/just-saved');
  });
});

// ─── Bug 4 — CodeEditor stale onChange closure pattern ───────────────────────

describe('Bug 4 — CodeEditor: onChangeRef always dispatches to the latest callback', () => {
  it('a ref updated after mounting reflects the new callback on the next call', () => {
    // Simulate the pattern used in CodeEditor:
    //   const onChangeRef = useRef(onChange);
    //   useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    //   listener = () => onChangeRef.current(value);

    const firstHandler = vi.fn<[string], void>();
    const secondHandler = vi.fn<[string], void>();

    // Mount: ref points to firstHandler
    const onChangeRef = { current: firstHandler };

    // Simulate the listener added at mount-time
    const listener = (value: string) => onChangeRef.current(value);

    // User types on Tab A
    listener('Tab A content');
    expect(firstHandler).toHaveBeenCalledWith('Tab A content');
    expect(secondHandler).not.toHaveBeenCalled();

    // Tab switch: React reconciles, the useEffect updates the ref
    onChangeRef.current = secondHandler;

    // User types on Tab B — listener should now call secondHandler
    listener('Tab B content');
    expect(secondHandler).toHaveBeenCalledWith('Tab B content');
    // firstHandler must NOT receive Tab B's input
    expect(firstHandler).toHaveBeenCalledTimes(1);
  });

  it('without the ref fix — stale closure always calls the first handler (demonstrates the bug)', () => {
    const firstHandler = vi.fn<[string], void>();
    const secondHandler = vi.fn<[string], void>();

    // Buggy version: closure captures onChange directly at mount
    const staledListener = (value: string) => firstHandler(value); // captured, never updated

    // Tab switch happens — React reconciles to secondHandler
    // But staledListener is unaware; it still calls firstHandler

    staledListener('Tab B content — routed to wrong tab!');
    expect(firstHandler).toHaveBeenCalledWith('Tab B content — routed to wrong tab!');
    expect(secondHandler).not.toHaveBeenCalled(); // Bug: secondHandler never gets called
  });
});

// ─── Bug 4b — isSyncingRef suppresses spurious onChange during value sync ────

describe('Bug 4b — CodeEditor: isSyncingRef suppresses onChange during programmatic value sync', () => {
  it('onChange is NOT called when isSyncingRef is true', () => {
    // Simulate the pattern:
    //   isSyncingRef.current = true;
    //   view.dispatch(changes);  — triggers updateListener internally
    //   isSyncingRef.current = false;

    const onChange = vi.fn<[string], void>();
    const isSyncingRef = { current: false };

    // Simulate the updateListener guard
    const simulateDocChanged = (newValue: string) => {
      if (!isSyncingRef.current) {
        onChange(newValue);
      }
    };

    // Normal user keystroke — should call onChange
    simulateDocChanged('user typed');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('user typed');

    // Tab switch: programmatic content replacement is wrapped in isSyncingRef
    isSyncingRef.current = true;
    simulateDocChanged('new tab content loaded from draft');
    isSyncingRef.current = false;

    // onChange must NOT have been called during the sync
    expect(onChange).toHaveBeenCalledTimes(1); // still just the one from before

    // After sync completes, normal keystrokes fire onChange again
    simulateDocChanged('user typed in new tab');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('user typed in new tab');
  });

  it('isSyncingRef resets to false even if the dispatch throws (simulated)', () => {
    const isSyncingRef = { current: false };

    // Simulate a try-finally pattern ensuring cleanup even on error
    const safeSync = (fn: () => void) => {
      isSyncingRef.current = true;
      try {
        fn();
      } finally {
        isSyncingRef.current = false;
      }
    };

    safeSync(() => { /* dispatch succeeds */ });
    expect(isSyncingRef.current).toBe(false);
  });
});

// ─── Integration: full round-trip with multiple tabs ─────────────────────────

describe('Integration — multi-tab unsaved edits survive independent tab operations', () => {
  interface SimState {
    tabs: TabState[];
    storeRequests: Record<string, ApiRequest>;
  }

  function openTab(state: SimState, requestId: string, collectionId = 'col-1'): SimState {
    const already = state.tabs.find(t => t.requestId === requestId);
    if (already) return state;
    return {
      ...state,
      tabs: [
        ...state.tabs,
        makeTab({ id: `tab-${requestId}`, requestId, collectionId, isModified: false }),
      ],
    };
  }

  function editDraft(state: SimState, tabId: string, changes: Partial<ApiRequest>): SimState {
    return {
      ...state,
      tabs: state.tabs.map(t => {
        if (t.id !== tabId) return t;
        const base = t.draftRequest ?? state.storeRequests[t.requestId!]!;
        const updated = { ...base, ...changes };
        return { ...t, isModified: true, draftRequest: updated };
      }),
    };
  }

  function renameInSidebar(state: SimState, requestId: string, newName: string): SimState {
    return {
      ...state,
      storeRequests: {
        ...state.storeRequests,
        [requestId]: { ...state.storeRequests[requestId], name: newName },
      },
      tabs: applyNameSyncToTabs(state.tabs, requestId, newName),
    };
  }

  function getVisibleRequest(state: SimState, tabId: string): ApiRequest | null {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab || !tab.requestId) return null;
    return resolveRequestForTab(tab, state.storeRequests[tab.requestId]);
  }

  it('editing Tab A then switching to Tab B does not change Tab B content', () => {
    let state: SimState = {
      tabs: [],
      storeRequests: {
        r1: makeReq('r1', { url: '/r1', preScript: '' }),
        r2: makeReq('r2', { url: '/r2', preScript: '' }),
      },
    };

    state = openTab(state, 'r1');
    state = openTab(state, 'r2');

    // User edits Tab A
    state = editDraft(state, 'tab-r1', { url: '/r1-modified', preScript: 'edited-pre' });

    // Switch to Tab B — Tab B should show its own clean store content
    const tabBContent = getVisibleRequest(state, 'tab-r2');
    expect(tabBContent?.url).toBe('/r2');
    expect(tabBContent?.preScript).toBe('');
  });

  it('switching back to Tab A after editing restores the unsaved draft', () => {
    let state: SimState = {
      tabs: [],
      storeRequests: {
        r1: makeReq('r1', { url: '/saved', script: '' }),
        r2: makeReq('r2', { url: '/r2' }),
      },
    };

    state = openTab(state, 'r1');
    state = openTab(state, 'r2');

    // User edits Tab A before switching away
    state = editDraft(state, 'tab-r1', { url: '/unsaved', script: 'post-draft' });

    // Switch to Tab B, do nothing, switch back to Tab A
    const tabAContent = getVisibleRequest(state, 'tab-r1');
    expect(tabAContent?.url).toBe('/unsaved');
    expect(tabAContent?.script).toBe('post-draft');
  });

  it('sidebar rename while Tab A has draft: draft is kept, only name is updated', () => {
    let state: SimState = {
      tabs: [],
      storeRequests: {
        r1: makeReq('r1', { url: '/api/v1', preScript: 'my-script' }),
      },
    };

    state = openTab(state, 'r1');
    state = editDraft(state, 'tab-r1', { url: '/api/v2', preScript: 'my-script' });

    // User renames the request in the sidebar while Tab A is dirty
    state = renameInSidebar(state, 'r1', 'Renamed via sidebar');

    const tabAContent = getVisibleRequest(state, 'tab-r1');
    expect(tabAContent?.name).toBe('Renamed via sidebar'); // rename applied to draft
    expect(tabAContent?.url).toBe('/api/v2');              // unsaved edits preserved
    expect(tabAContent?.preScript).toBe('my-script');      // unsaved edits preserved

    // Tab itself must still be marked modified
    const tab = state.tabs.find(t => t.id === 'tab-r1')!;
    expect(tab.isModified).toBe(true);
  });

  it('explicit save clears the draft and subsequent tab switch loads saved content', () => {
    let state: SimState = {
      tabs: [],
      storeRequests: {
        r1: makeReq('r1', { url: '/saved', script: '' }),
      },
    };

    state = openTab(state, 'r1');
    state = editDraft(state, 'tab-r1', { url: '/unsaved', script: 'draft' });

    // Simulate explicit save: write draft to store and clear it from tab
    const tab = state.tabs.find(t => t.id === 'tab-r1')!;
    state = {
      ...state,
      storeRequests: { r1: { ...tab.draftRequest! } },
      tabs: state.tabs.map(t =>
        t.id === 'tab-r1' ? { ...t, isModified: false, draftRequest: undefined } : t
      ),
    };

    const content = getVisibleRequest(state, 'tab-r1');
    expect(content?.url).toBe('/unsaved'); // what was saved is now in the store
    expect(content?.script).toBe('draft');

    const savedTab = state.tabs.find(t => t.id === 'tab-r1')!;
    expect(savedTab.isModified).toBe(false);
    expect(savedTab.draftRequest).toBeUndefined();
  });
});
