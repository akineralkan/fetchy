import { useState, useCallback, useEffect } from 'react';
import { Settings, RefreshCw, PanelLeftClose, PanelLeftOpen, Rows, Columns, BookOpen, Star, Github, Keyboard, Info, Library } from 'lucide-react';
import ImportModal, { type ImportSource } from './components/ImportModal';
import ImportRequestModal from './components/ImportRequestModal';
import ExportModal from './components/ExportModal';
import EnvironmentModal from './components/EnvironmentModal';
import EnvironmentDropdown from './components/EnvironmentDropdown';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import SettingsModal from './components/SettingsModal';
import WorkspacesModal from './components/WorkspacesModal';
import WorkspaceDropdown from './components/WorkspaceDropdown';
import CreateWorkspaceScreen from './components/CreateWorkspaceScreen';
import UpdateModal from './components/UpdateModal';
import AboutModal from './components/AboutModal';
import UpdateBanner from './components/UpdateBanner';
import ThemeToggle from './components/ThemeToggle';
import Tooltip from './components/Tooltip';
import ModeDropdown from './components/ModeDropdown';
import ComingSoonView from './components/ComingSoonView';
import RestModeView from './components/RestModeView';
import PublicApisModal from './components/PublicApisModal';
import { useAppStore, rehydrateWorkspace } from './store/appStore';
import { invalidateWriteCache } from './store/persistence';
import { usePreferencesStore } from './store/preferencesStore';
import { useWorkspacesStore } from './store/workspacesStore';
import { useKeyboardShortcuts, getEffectiveBinding, ShortcutHandler } from './hooks/useKeyboardShortcuts';
import { AppMode } from './types';

// macOS uses titleBarStyle: 'hiddenInset', which floats the traffic light
// (close/minimize/maximize) buttons over the top-left of the content area
// instead of reserving their own native title bar row. The top bar below
// adds extra left padding and a drag region specifically for mac so the
// logo/title never sits underneath those buttons.
const isMac = (window as any).electronAPI?.platform === 'darwin';

function App() {
  const {
    tabs,
    activeTabId,
    sidebarCollapsed,
    toggleSidebar,
    collections,
    addCollection,
    addRequest,
    openTab,
    panelLayout,
    togglePanelLayout,
  } = useAppStore();
  const { loadPreferences, loadAISecrets, loadJiraSecrets, preferences } = usePreferencesStore();
  const { workspaces, activeWorkspaceId, isLoading: workspacesLoading, loadWorkspaces } = useWorkspacesStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<ImportSource>('postman');
  const [showImportRequestModal, setShowImportRequestModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'ai' | 'integrations'>('general');
  const [showWorkspacesModal, setShowWorkspacesModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPublicApisModal, setShowPublicApisModal] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [postUpdateInfo, setPostUpdateInfo] = useState<any>(null);
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [activeMode, setActiveMode] = useState<AppMode>('rest');

  useEffect(() => {
    fetch('https://api.github.com/repos/akineralkan/fetchy')
      .then(res => res.json())
      .then(data => { if (typeof data.stargazers_count === 'number') setGithubStars(data.stargazers_count); })
      .catch(() => {});
  }, []);

  // ── Post-update banner (shown once after a successful update) ─────────────
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getPostUpdateInfo) return;
    api.getPostUpdateInfo().then((info: any) => {
      if (info) setPostUpdateInfo(info);
    });
  }, []);

  const dismissUpdateBanner = useCallback(() => {
    setPostUpdateInfo(null);
    const api = (window as any).electronAPI;
    api?.clearPostUpdateInfo?.();
  }, []);

  // ── App-update notification badge ────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdaterEvent) return;
    const listener = api.onUpdaterEvent((data: any) => {
      if (data.event === 'available') setUpdateAvailable(true);
      if (data.event === 'not-available') setUpdateAvailable(false);
      if (data.event === 'downloaded') setUpdateAvailable(true);
    });
    return () => api.offUpdaterEvent(listener);
  }, []);

  // Load preferences, AI secrets, Jira secrets, and workspaces on mount
  useEffect(() => {
    loadPreferences().then(() => {
      loadAISecrets();
      loadJiraSecrets();
    });
    loadWorkspaces();
  }, [loadPreferences, loadAISecrets, loadJiraSecrets, loadWorkspaces]);

  // Listen for custom event to open AI settings directly
  useEffect(() => {
    const handleOpenAISettings = () => {
      setSettingsInitialTab('ai');
      setShowSettingsModal(true);
    };
    window.addEventListener('open-ai-settings', handleOpenAISettings);
    return () => window.removeEventListener('open-ai-settings', handleOpenAISettings);
  }, []);

  // ── Listen for external storage file changes ──
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onStorageFileChanged) return;

    const listener = api.onStorageFileChanged(() => {
      // Invalidate the write cache so rehydrate reads fresh files from disk
      invalidateWriteCache();
      // Rehydrate the zustand store from disk
      useAppStore.persist.rehydrate();
    });

    return () => {
      api.offStorageFileChanged?.(listener);
    };
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const hasActiveRequest = activeTab?.type === 'request';

  const handleNewRequest = useCallback(() => {
    if (collections.length === 0) {
      const collection = addCollection('My Collection');
      const request = addRequest(collection.id, null);
      openTab({
        type: 'request',
        title: request.name,
        requestId: request.id,
        collectionId: collection.id,
      });
    } else {
      const request = addRequest(collections[0].id, null);
      openTab({
        type: 'request',
        title: request.name,
        requestId: request.id,
        collectionId: collections[0].id,
      });
    }
  }, [collections, addCollection, addRequest, openTab]);

  const handleImport = useCallback((type?: ImportSource) => {
    if (type) {
      setImportType(type);
    }
    setShowImportModal(true);
  }, []);

  const handleImportRequest = useCallback(() => {
    setShowImportRequestModal(true);
  }, []);

  const handleImportCollection = useCallback(() => {
    setImportType('postman');
    setShowImportModal(true);
  }, []);

  const handleImportEnvironment = useCallback(() => {
    setImportType('postman-env');
    setShowImportModal(true);
  }, []);

  // Set up keyboard shortcuts using configured bindings from preferences
  const customBindings = preferences.keyboardShortcuts;

  function buildShortcut(
    binding: ReturnType<typeof getEffectiveBinding>,
    handler: () => void,
    description: string
  ): ShortcutHandler | null {
    if (!binding) return null;
    return { key: binding.key, ctrl: binding.ctrl, shift: binding.shift, alt: binding.alt, handler, description };
  }

  useKeyboardShortcuts(
    [
      buildShortcut(getEffectiveBinding('new-request', customBindings), handleNewRequest, 'New request'),
      buildShortcut(getEffectiveBinding('import', customBindings), () => handleImport(), 'Import'),
      buildShortcut(getEffectiveBinding('open-environments', customBindings), () => setShowEnvironmentModal(true), 'Environments'),
      buildShortcut(getEffectiveBinding('show-shortcuts', customBindings), () => setShowShortcutsModal(true), 'Keyboard shortcuts'),
    ].filter((s): s is ShortcutHandler => s !== null)
  );

  // ── Workspace gate (after all hooks) ────────────────────────────────────────
  // Block the UI while workspaces are loading or until one is created/selected.
  if (workspacesLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-fetchy-bg">
        <RefreshCw size={24} className="animate-spin text-fetchy-text-muted" />
      </div>
    );
  }

  if (workspaces.length === 0 || !activeWorkspaceId || !activeWorkspace) {
    return <CreateWorkspaceScreen onCreated={() => rehydrateWorkspace()} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-fetchy-bg overflow-hidden">
      {/* Post-update banner */}
      {postUpdateInfo && (
        <UpdateBanner info={postUpdateInfo} onDismiss={dismissUpdateBanner} />
      )}

      {/* Top bar */}
      <div
        className={`h-12 bg-fetchy-sidebar border-b border-fetchy-border flex items-center pr-4 justify-between shrink-0 app-region-drag ${isMac ? 'pl-24' : 'pl-4'}`}
      >
        <div className="flex items-center gap-3">
          <img src="./logo.jpg" alt="Fetchy" className="h-8 w-8 rounded" />
          <div className="text-xl font-bold text-fetchy-accent">Fetchy</div>
          <span className="text-xs text-fetchy-text-muted italic">Local by design. Reliable by nature</span>
          <span className="text-xs text-fetchy-text-muted">v{__APP_VERSION__}</span>
        </div>
        <div className="flex items-center gap-2 app-region-no-drag">
          <ModeDropdown activeMode={activeMode} onModeChange={setActiveMode} />
          <div className="w-px h-5 bg-fetchy-border" />
          <EnvironmentDropdown onOpenSettings={() => setShowEnvironmentModal(true)} />
          <WorkspaceDropdown onOpenSettings={() => setShowWorkspacesModal(true)} />
          <Tooltip content="Settings">
            <button
              onClick={() => { setSettingsInitialTab('general'); setShowSettingsModal(true); }}
              className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            >
              <Settings size={18} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {activeMode === 'rest' ? (
          <RestModeView
            onImport={handleImport}
            onImportRequest={handleImportRequest}
            onImportCollection={handleImportCollection}
            onImportEnvironment={handleImportEnvironment}
          />
        ) : (
          <ComingSoonView mode={activeMode} />
        )}
      </div>

      {/* Bottom bar with toggle buttons */}
      <div className="h-10 bg-fetchy-sidebar border-t border-fetchy-border flex items-center px-4 gap-2 shrink-0">
        {activeMode === 'rest' && (
          <Tooltip content={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}>
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </Tooltip>
        )}

        {activeMode === 'rest' && hasActiveRequest && (
          <Tooltip content={panelLayout === 'horizontal' ? "Switch to Vertical Layout" : "Switch to Horizontal Layout"}>
            <button
              onClick={togglePanelLayout}
              className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            >
              {panelLayout === 'horizontal' ? <Rows size={18} /> : <Columns size={18} />}
            </button>
          </Tooltip>
        )}

        <div className="flex-1" />

        <ThemeToggle />

        <Tooltip content={updateAvailable ? 'Update Available!' : 'Check for Updates'}>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="relative p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <RefreshCw size={18} />
            {updateAvailable && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-fetchy-bg animate-pulse" />
            )}
          </button>
        </Tooltip>

        <Tooltip content="Public APIs Directory">
          <button
            onClick={() => setShowPublicApisModal(true)}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <Library size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Documentation">
          <button
            onClick={() => window.electronAPI?.openExternalUrl('https://akineralkan.github.io/fetchy/')}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <BookOpen size={18} />
          </button>
        </Tooltip>

        <Tooltip content="GitHub">
          <button
            onClick={() => window.electronAPI?.openExternalUrl('https://github.com/akineralkan/fetchy')}
            className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <Github size={18} />
            {githubStars !== null && (
              <span className="flex items-center gap-0.5 text-xs font-medium">
                <Star size={12} className="fill-current" />
                {githubStars >= 1000 ? `${(githubStars / 1000).toFixed(1)}k` : githubStars}
              </span>
            )}
          </button>
        </Tooltip>

        <Tooltip content="Keyboard Shortcuts (Ctrl+/)">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <Keyboard size={18} />
          </button>
        </Tooltip>

        <Tooltip content="About Fetchy">
          <button
            onClick={() => setShowAboutModal(true)}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <Info size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Modals */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          initialImportType={importType}
        />
      )}

      {showImportRequestModal && (
        <ImportRequestModal
          onClose={() => setShowImportRequestModal(false)}
        />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {showEnvironmentModal && (
        <EnvironmentModal onClose={() => setShowEnvironmentModal(false)} />
      )}

      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onOpenWorkspaces={() => setShowWorkspacesModal(true)}
          initialTab={settingsInitialTab}
        />
      )}

      {showWorkspacesModal && (
        <WorkspacesModal
          isOpen={showWorkspacesModal}
          onClose={() => setShowWorkspacesModal(false)}
        />
      )}

      {showUpdateModal && (
        <UpdateModal
          onClose={() => setShowUpdateModal(false)}
        />
      )}

      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}

      {showPublicApisModal && (
        <PublicApisModal onClose={() => setShowPublicApisModal(false)} />
      )}
    </div>
  );
}

export default App;
