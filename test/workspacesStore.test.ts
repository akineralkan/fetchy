/**
 * Tests for workspacesStore.ts
 *
 * Covers (browser / non-Electron mode):
 *  - Initial state
 *  - loadWorkspaces: reads from localStorage
 *  - loadWorkspaces: sets isLoading=false when nothing stored
 *  - addWorkspace: creates a workspace, auto-activates if first
 *  - addWorkspace: does not change active id if one already exists
 *  - removeWorkspace: removes a workspace by id
 *  - getWorkspace: returns workspace by id / null for unknown
 *  - activeWorkspace: returns the active workspace object
 *  - updateWorkspace: changes workspace name/directories
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspacesStore } from '../src/store/workspacesStore';

// ─── Mock persistence ─────────────────────────────────────────────────────────
vi.mock('../src/store/persistence', async () => {
  const actual = await vi.importActual<typeof import('../src/store/persistence')>('../src/store/persistence');
  return {
    ...actual,
    suppressPersistence: vi.fn(),
    cancelPendingPersistence: vi.fn(),
    registerActiveWorkspaceIdProvider: vi.fn(),
    isElectron: false,
  };
});

// ─── Mock appStore's rehydrateWorkspace ───────────────────────────────────────
vi.mock('../src/store/appStore', () => ({
  rehydrateWorkspace: vi.fn(),
  useAppStore: vi.fn(),
}));

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageStore: Record<string, string> = {};

beforeEach(() => {
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { localStorageStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  });

  // Stub crypto.randomUUID
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Date.now()}`) });

  // Reset store
  useWorkspacesStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    isLoading: true,
    isElectron: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('workspacesStore – initial state', () => {
  it('starts with empty workspaces array', () => {
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(0);
  });

  it('starts with null activeWorkspaceId', () => {
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBeNull();
  });

  it('isElectron is false in test environment', () => {
    expect(useWorkspacesStore.getState().isElectron).toBe(false);
  });
});

describe('workspacesStore – loadWorkspaces (browser mode)', () => {
  it('sets isLoading=false when nothing stored', async () => {
    const { loadWorkspaces } = useWorkspacesStore.getState();
    await loadWorkspaces();
    expect(useWorkspacesStore.getState().isLoading).toBe(false);
  });

  it('loads workspaces from localStorage', async () => {
    localStorageStore['fetchy-workspaces'] = JSON.stringify({
      workspaces: [
        { id: 'ws-1', name: 'Main', homeDirectory: '/home/main', secretsDirectory: '/secrets', createdAt: 1000 },
      ],
      activeWorkspaceId: 'ws-1',
    });
    const { loadWorkspaces } = useWorkspacesStore.getState();
    await loadWorkspaces();
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(1);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe('ws-1');
  });

  it('handles malformed JSON gracefully', async () => {
    localStorageStore['fetchy-workspaces'] = 'INVALID{{{';
    const { loadWorkspaces } = useWorkspacesStore.getState();
    await loadWorkspaces();
    expect(useWorkspacesStore.getState().isLoading).toBe(false);
  });
});

describe('workspacesStore – addWorkspace (browser mode)', () => {
  it('adds a workspace to the list', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('First WS', '/home/first', '/secrets/first');
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(1);
    expect(useWorkspacesStore.getState().workspaces[0].name).toBe('First WS');
  });

  it('auto-activates the first workspace', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('First WS', '/home/first', '/secrets/first');
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(ws.id);
  });

  it('does not change active workspace when one already exists', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    const first = await addWorkspace('First', '/h/first', '/s/first');
    await addWorkspace('Second', '/h/second', '/s/second');
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(first.id);
  });

  it('persists to localStorage', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('WS', '/h', '/s');
    expect(localStorageStore['fetchy-workspaces']).toBeTruthy();
  });
});

describe('workspacesStore – removeWorkspace (browser mode)', () => {
  it('removes the workspace from the list', async () => {
    const { addWorkspace, removeWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Temp', '/h', '/s');
    await removeWorkspace(ws.id);
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(0);
  });

  it('does not crash when removing a non-existent workspace', async () => {
    const { removeWorkspace } = useWorkspacesStore.getState();
    await expect(removeWorkspace('fake-id')).resolves.not.toThrow();
  });
});

describe('workspacesStore – getWorkspace', () => {
  it('returns the workspace by id', async () => {
    const { addWorkspace, getWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Find Me', '/h', '/s');
    expect(getWorkspace(ws.id)?.name).toBe('Find Me');
  });

  it('returns null for unknown id', () => {
    const { getWorkspace } = useWorkspacesStore.getState();
    expect(getWorkspace('nonexistent')).toBeNull();
  });
});

describe('workspacesStore – activeWorkspace', () => {
  it('returns null when no active workspace', () => {
    const { activeWorkspace } = useWorkspacesStore.getState();
    expect(activeWorkspace()).toBeNull();
  });

  it('returns the active workspace object', async () => {
    const { addWorkspace, activeWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('Active WS', '/h', '/s');
    expect(activeWorkspace()?.name).toBe('Active WS');
  });
});

describe('workspacesStore – updateWorkspace (browser mode)', () => {
  it('updates the workspace name', async () => {
    const { addWorkspace, updateWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Old Name', '/h', '/s');
    await updateWorkspace(ws.id, { name: 'New Name' });
    expect(useWorkspacesStore.getState().workspaces[0].name).toBe('New Name');
  });

  it('does not crash for unknown workspace id', async () => {
    const { updateWorkspace } = useWorkspacesStore.getState();
    await expect(updateWorkspace('fake', { name: 'X' })).resolves.not.toThrow();
  });
});

// --------------------------------------------------------------------------
// workspacesStore – switchWorkspace
// --------------------------------------------------------------------------

describe('workspacesStore – switchWorkspace (browser mode)', () => {
  it('switches the active workspace and updates localStorage', async () => {
    const { addWorkspace, switchWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('Workspace A');
    await addWorkspace('Workspace B');
    const { workspaces } = useWorkspacesStore.getState();
    const wsA = workspaces[0];
    const wsB = workspaces[1];
    await switchWorkspace(wsA.id);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(wsA.id);
    await switchWorkspace(wsB.id);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(wsB.id);
  });

  it('is a no-op when switching to the already active workspace', async () => {
    const { addWorkspace, switchWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('Only Workspace');
    const { workspaces } = useWorkspacesStore.getState();
    const ws = workspaces[0];
    await switchWorkspace(ws.id);
    const firstActiveId = useWorkspacesStore.getState().activeWorkspaceId;
    await switchWorkspace(ws.id);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(firstActiveId);
  });
});

// --------------------------------------------------------------------------
// workspacesStore – exportWorkspace (browser mode)
// --------------------------------------------------------------------------

describe('workspacesStore – exportWorkspace (browser mode)', () => {
  it('returns success: false with a user-facing message', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('Export Test');
    const { workspaces, exportWorkspace } = useWorkspacesStore.getState();
    const result = await exportWorkspace(workspaces[0].id);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns a message indicating desktop-only availability', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('Export Desktop');
    const { workspaces, exportWorkspace } = useWorkspacesStore.getState();
    const result = await exportWorkspace(workspaces[0].id);
    expect(result.error?.toLowerCase()).toContain('desktop');
  });
});

// --------------------------------------------------------------------------
// workspacesStore – importWorkspaceFromFile (browser mode)
// --------------------------------------------------------------------------

describe('workspacesStore – importWorkspaceFromFile (browser mode)', () => {
  it('returns success: false with a user-facing message', async () => {
    const { importWorkspaceFromFile } = useWorkspacesStore.getState();
    const result = await importWorkspaceFromFile();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns a message indicating desktop-only availability', async () => {
    const { importWorkspaceFromFile } = useWorkspacesStore.getState();
    const result = await importWorkspaceFromFile();
    expect(result.error?.toLowerCase()).toContain('desktop');
  });
});

// --------------------------------------------------------------------------
// workspacesStore – removeWorkspace activates next workspace
// --------------------------------------------------------------------------

describe('workspacesStore – removeWorkspace active switch', () => {
  it('switches to next workspace when active one is removed', async () => {
    const { addWorkspace, removeWorkspace } = useWorkspacesStore.getState();
    const wsA = await addWorkspace('A', '/hA', '/sA');
    await addWorkspace('B', '/hB', '/sB');
    // wsA is active (first workspace auto-activated)
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(wsA.id);
    await removeWorkspace(wsA.id);
    // Should now have workspace B active
    const remaining = useWorkspacesStore.getState().workspaces;
    expect(remaining).toHaveLength(1);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(remaining[0].id);
  });

  it('sets activeWorkspaceId to null when last workspace is removed', async () => {
    const { addWorkspace, removeWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Only', '/h', '/s');
    await removeWorkspace(ws.id);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBeNull();
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(0);
  });

  it('keeps activeWorkspaceId unchanged when removing non-active workspace', async () => {
    const { addWorkspace, removeWorkspace } = useWorkspacesStore.getState();
    const wsA = await addWorkspace('A', '/hA', '/sA');
    const wsB = await addWorkspace('B', '/hB', '/sB');
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(wsA.id);
    await removeWorkspace(wsB.id);
    expect(useWorkspacesStore.getState().activeWorkspaceId).toBe(wsA.id);
    expect(useWorkspacesStore.getState().workspaces).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// workspacesStore – updateWorkspace directory changes
// --------------------------------------------------------------------------

describe('workspacesStore – updateWorkspace with directory changes', () => {
  it('updates homeDirectory', async () => {
    const { addWorkspace, updateWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Test WS', '/old/home', '/secrets');
    await updateWorkspace(ws.id, { homeDirectory: '/new/home' });
    expect(useWorkspacesStore.getState().workspaces[0].homeDirectory).toBe('/new/home');
  });

  it('updates secretsDirectory', async () => {
    const { addWorkspace, updateWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Test WS', '/home', '/old/secrets');
    await updateWorkspace(ws.id, { secretsDirectory: '/new/secrets' });
    expect(useWorkspacesStore.getState().workspaces[0].secretsDirectory).toBe('/new/secrets');
  });

  it('persists updated workspace to localStorage', async () => {
    const { addWorkspace, updateWorkspace } = useWorkspacesStore.getState();
    const ws = await addWorkspace('Persist', '/h', '/s');
    await updateWorkspace(ws.id, { name: 'Updated' });
    const stored = JSON.parse(localStorageStore['fetchy-workspaces'] ?? '{}');
    expect(stored.workspaces[0].name).toBe('Updated');
  });
});

// --------------------------------------------------------------------------
// workspacesStore – addWorkspace generates unique IDs
// --------------------------------------------------------------------------

describe('workspacesStore – addWorkspace id generation', () => {
  it('generates unique IDs for each workspace', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    const ws1 = await addWorkspace('WS1', '/h1', '/s1');
    const ws2 = await addWorkspace('WS2', '/h2', '/s2');
    expect(ws1.id).not.toBe(ws2.id);
  });

  it('sets createdAt timestamp on new workspace', async () => {
    const { addWorkspace } = useWorkspacesStore.getState();
    const before = Date.now();
    const ws = await addWorkspace('Timed', '/h', '/s');
    const after = Date.now();
    expect(ws.createdAt).toBeGreaterThanOrEqual(before);
    expect(ws.createdAt).toBeLessThanOrEqual(after);
  });
});

// --------------------------------------------------------------------------
// workspacesStore – getWorkspace edge cases
// --------------------------------------------------------------------------

describe('workspacesStore – getWorkspace with multiple workspaces', () => {
  it('finds correct workspace among many', async () => {
    const { addWorkspace, getWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('First', '/h1', '/s1');
    const ws2 = await addWorkspace('Second', '/h2', '/s2');
    await addWorkspace('Third', '/h3', '/s3');
    expect(getWorkspace(ws2.id)?.name).toBe('Second');
  });
});

// --------------------------------------------------------------------------
// workspacesStore – switchWorkspace persists to localStorage
// --------------------------------------------------------------------------

describe('workspacesStore – switchWorkspace persistence', () => {
  it('persists the new activeWorkspaceId to localStorage', async () => {
    const { addWorkspace, switchWorkspace } = useWorkspacesStore.getState();
    await addWorkspace('A', '/hA', '/sA');
    const wsB = await addWorkspace('B', '/hB', '/sB');
    await switchWorkspace(wsB.id);
    const stored = JSON.parse(localStorageStore['fetchy-workspaces'] ?? '{}');
    expect(stored.activeWorkspaceId).toBe(wsB.id);
  });
});
