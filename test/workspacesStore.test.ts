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
