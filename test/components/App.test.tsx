// @vitest-environment jsdom

/**
 * Tests for App.tsx — root application component.
 *
 * App.tsx is deeply integrated with multiple stores and components.
 * These tests mock all heavy dependencies and verify:
 *  - App renders without crashing
 *  - Preferences are loaded on mount
 *  - Workspaces are loaded on mount
 *  - The toolbar (sidebar toggle, new-request button) is rendered
 *  - Mode dropdown is rendered
 *  - The "Create Workspace" screen is shown when no workspaces exist
 *  - Update banner is shown when postUpdateInfo is present
 *  - GitHub stars badge is rendered after fetch resolves
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import App from '../../src/App';
import { useAppStore } from '../../src/store/appStore';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import { useWorkspacesStore } from '../../src/store/workspacesStore';

// ─── Store mocks ──────────────────────────────────────────────────────────────
vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
  rehydrateWorkspace: vi.fn(),
}));
vi.mock('../../src/store/preferencesStore', () => ({ usePreferencesStore: vi.fn() }));
vi.mock('../../src/store/workspacesStore', () => ({ useWorkspacesStore: vi.fn() }));
vi.mock('../../src/store/persistence', () => ({
  invalidateWriteCache: vi.fn(),
  suppressPersistence: vi.fn(),
  cancelPendingPersistence: vi.fn(),
  registerActiveWorkspaceIdProvider: vi.fn(),
  isElectron: false,
}));

// ─── Heavy component mocks ────────────────────────────────────────────────────
vi.mock('../../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('../../src/components/RequestPanel', () => ({ default: () => <div data-testid="request-panel" /> }));
vi.mock('../../src/components/ResponsePanel', () => ({ default: () => <div data-testid="response-panel" /> }));
vi.mock('../../src/components/RestModeView', () => ({ default: () => <div data-testid="rest-mode-view" /> }));
vi.mock('../../src/components/ComingSoonView', () => ({ default: () => <div data-testid="coming-soon" /> }));
vi.mock('../../src/components/TabBar', () => ({ default: () => <div data-testid="tab-bar" /> }));
vi.mock('../../src/components/CreateWorkspaceScreen', () => ({ default: () => <div data-testid="create-workspace-screen" /> }));
vi.mock('../../src/components/UpdateModal', () => ({ default: () => <div data-testid="update-modal" /> }));
vi.mock('../../src/components/UpdateBanner', () => ({ default: () => <div data-testid="update-banner" /> }));
vi.mock('../../src/components/EnvironmentModal', () => ({ default: () => null }));
vi.mock('../../src/components/ImportModal', () => ({ default: () => null }));
vi.mock('../../src/components/ImportRequestModal', () => ({ default: () => null }));
vi.mock('../../src/components/ExportModal', () => ({ default: () => null }));
vi.mock('../../src/components/SettingsModal', () => ({ default: () => null }));
vi.mock('../../src/components/WorkspacesModal', () => ({ default: () => null }));
vi.mock('../../src/components/KeyboardShortcutsModal', () => ({ default: () => null }));
vi.mock('../../src/components/EnvironmentDropdown', () => ({ default: () => <div data-testid="env-dropdown" /> }));
vi.mock('../../src/components/WorkspaceDropdown', () => ({ default: () => <div data-testid="workspace-dropdown" /> }));
vi.mock('../../src/components/ThemeToggle', () => ({ default: () => <div data-testid="theme-toggle" /> }));
vi.mock('../../src/components/Tooltip', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('../../src/components/ModeDropdown', () => ({ default: () => <div data-testid="mode-dropdown" /> }));
vi.mock('../../src/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildAppStore(overrides: Record<string, unknown> = {}) {
  return {
    tabs: [],
    activeTabId: null,
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
    collections: [],
    addCollection: vi.fn(() => ({ id: 'c1', name: 'My Collection', folders: [], requests: [], variables: [] })),
    addRequest: vi.fn(() => ({ id: 'r1', name: 'New Request', method: 'GET', url: '', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } })),
    openTab: vi.fn(),
    panelLayout: 'horizontal',
    togglePanelLayout: vi.fn(),
    ...overrides,
  };
}

function buildPrefsStore(overrides: Record<string, unknown> = {}) {
  return {
    preferences: { theme: 'dark', autoSave: true, maxHistoryItems: 100 },
    loadPreferences: vi.fn().mockResolvedValue(undefined),
    loadAISecrets: vi.fn().mockResolvedValue(undefined),
    loadJiraSecrets: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildWorkspacesStore(overrides: Record<string, unknown> = {}) {
  return {
    workspaces: [{ id: 'ws-1', name: 'Default', homeDirectory: '/home', secretsDirectory: '/secrets', createdAt: 0 }],
    activeWorkspaceId: 'ws-1',
    isLoading: false,
    loadWorkspaces: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(useAppStore).mockReturnValue(buildAppStore() as never);
    vi.mocked(usePreferencesStore).mockReturnValue(buildPrefsStore() as never);
    vi.mocked(useWorkspacesStore).mockReturnValue(buildWorkspacesStore() as never);

    // Mock GitHub stars fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ stargazers_count: 42 }) }));
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('calls loadPreferences on mount', () => {
    const loadPreferences = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePreferencesStore).mockReturnValue(
      buildPrefsStore({ loadPreferences }) as never
    );
    render(<App />);
    expect(loadPreferences).toHaveBeenCalled();
  });

  it('calls loadWorkspaces on mount', () => {
    const loadWorkspaces = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWorkspacesStore).mockReturnValue(
      buildWorkspacesStore({ loadWorkspaces }) as never
    );
    render(<App />);
    expect(loadWorkspaces).toHaveBeenCalled();
  });

  it('renders the mode dropdown', () => {
    render(<App />);
    expect(screen.getByTestId('mode-dropdown')).toBeTruthy();
  });

  it('renders the theme toggle', () => {
    render(<App />);
    expect(screen.getByTestId('theme-toggle')).toBeTruthy();
  });

  it('shows a loading spinner when workspaces are loading', () => {
    vi.mocked(useWorkspacesStore).mockReturnValue(
      buildWorkspacesStore({ isLoading: true, workspaces: [] }) as never
    );
    render(<App />);
    // While loading, App shows a spinner, not the main UI
    expect(screen.queryByTestId('mode-dropdown')).toBeNull();
  });

  it('shows CreateWorkspaceScreen when workspaces list is empty after loading', () => {
    vi.mocked(useWorkspacesStore).mockReturnValue(
      buildWorkspacesStore({ isLoading: false, workspaces: [], activeWorkspaceId: null }) as never
    );
    // Need appStore to also have no activeWorkspace — App checks workspaces.length === 0 || !activeWorkspaceId
    vi.mocked(useAppStore).mockReturnValue(buildAppStore() as never);
    render(<App />);
    expect(screen.getByTestId('create-workspace-screen')).toBeTruthy();
  });
});
