import { useState, useCallback, useEffect, useRef } from 'react';
import { HelpCircle, Settings, RefreshCw, PanelLeftClose, PanelLeftOpen, Rows, Columns } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import WelcomeScreen from './components/WelcomeScreen';
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
import ThemeToggle from './components/ThemeToggle';
import ResizeHandle from './components/ResizeHandle';
import Tooltip from './components/Tooltip';
import OpenApiEditor from './components/OpenApiEditor';
import { useAppStore } from './store/appStore';
import { usePreferencesStore } from './store/preferencesStore';
import { useWorkspacesStore } from './store/workspacesStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ApiResponse, RequestHistoryItem, ApiRequest } from './types';

interface TabResponseData {
  response: ApiResponse | null;
  sentRequest: ApiRequest | null;
  isLoading: boolean;
}

function App() {
  const {
    tabs,
    activeTabId,
    sidebarWidth,
    sidebarCollapsed,
    toggleSidebar,
    collections,
    addCollection,
    addRequest,
    openTab,
    setSidebarWidth,
    requestPanelWidth,
    setRequestPanelWidth,
    panelLayout,
    togglePanelLayout,
  } = useAppStore();
  const { loadPreferences } = usePreferencesStore();
  const { workspaces, activeWorkspaceId, isLoading: workspacesLoading, loadWorkspaces } = useWorkspacesStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const [tabResponses, setTabResponses] = useState<Record<string, TabResponseData>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<ImportSource>('postman');
  const [showImportRequestModal, setShowImportRequestModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWorkspacesModal, setShowWorkspacesModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const mainPanelRef = useRef<HTMLDivElement>(null);
  const prevTabIdsRef = useRef<Set<string>>(new Set());

  // Derive per-tab response data for the active tab
  const currentTabData = activeTabId ? tabResponses[activeTabId] : undefined;
  const response = currentTabData?.response ?? null;
  const sentRequest = currentTabData?.sentRequest ?? null;
  const isLoading = currentTabData?.isLoading ?? false;

  // Per-tab setters that capture activeTabId at creation time
  const setResponse = useCallback((resp: ApiResponse | null) => {
    const tabId = activeTabId;
    if (!tabId) return;
    setTabResponses(prev => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { response: null, sentRequest: null, isLoading: false }),
        response: resp,
      },
    }));
  }, [activeTabId]);

  const setSentRequest = useCallback((req: ApiRequest | null) => {
    const tabId = activeTabId;
    if (!tabId) return;
    setTabResponses(prev => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { response: null, sentRequest: null, isLoading: false }),
        sentRequest: req,
      },
    }));
  }, [activeTabId]);

  const setIsLoading = useCallback((loading: boolean) => {
    const tabId = activeTabId;
    if (!tabId) return;
    setTabResponses(prev => ({
      ...prev,
      [tabId]: {
        ...(prev[tabId] ?? { response: null, sentRequest: null, isLoading: false }),
        isLoading: loading,
      },
    }));
  }, [activeTabId]);

  // Clean up response data when tabs are closed
  useEffect(() => {
    const currentTabIds = new Set(tabs.map(t => t.id));
    const removedIds: string[] = [];
    prevTabIdsRef.current.forEach(id => {
      if (!currentTabIds.has(id)) removedIds.push(id);
    });
    if (removedIds.length > 0) {
      setTabResponses(prev => {
        const next = { ...prev };
        removedIds.forEach(id => delete next[id]);
        return next;
      });
    }
    prevTabIdsRef.current = currentTabIds;
  }, [tabs]);

  // Load preferences and workspaces on mount
  useEffect(() => {
    loadPreferences();
    loadWorkspaces();
  }, [loadPreferences, loadWorkspaces]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const hasActiveRequest = activeTab?.type === 'request';
  const hasActiveOpenApi = activeTab?.type === 'openapi';

  // Load history response/request when switching to a history tab
  useEffect(() => {
    if (activeTab?.isHistoryItem && activeTabId && !tabResponses[activeTabId]) {
      setTabResponses(prev => ({
        ...prev,
        [activeTabId]: {
          response: activeTab.historyResponse ?? null,
          sentRequest: activeTab.historyRequest ?? null,
          isLoading: false,
        },
      }));
    }
  }, [activeTabId, activeTab?.isHistoryItem, activeTab?.historyResponse, activeTab?.historyRequest, tabResponses]);

  const handleHistoryItemClick = useCallback((item: RequestHistoryItem) => {
    // Open a new tab for the history item
    openTab({
      type: 'request',
      title: `${item.request.method} ${item.request.name || 'History'}`,
      isHistoryItem: true,
      historyRequest: item.request,
      historyResponse: item.response,
    });

    // Response will be loaded by the history tab effect when the tab becomes active
  }, [openTab]);

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

  // Resize handlers
  const handleSidebarResize = useCallback((delta: number) => {
    const newWidth = Math.max(200, Math.min(600, sidebarWidth + delta));
    setSidebarWidth(newWidth);
  }, [sidebarWidth, setSidebarWidth]);

  const handleRequestPanelResize = useCallback((delta: number) => {
    if (!mainPanelRef.current) return;

    if (panelLayout === 'horizontal') {
      const containerWidth = mainPanelRef.current.offsetWidth;
      const pixelWidth = (requestPanelWidth / 100) * containerWidth;
      const newPixelWidth = Math.max(200, Math.min(containerWidth - 200, pixelWidth + delta));
      const newPercentage = (newPixelWidth / containerWidth) * 100;
      setRequestPanelWidth(newPercentage);
    } else {
      // Vertical layout
      const containerHeight = mainPanelRef.current.offsetHeight - 40; // Subtract TabBar height
      const pixelHeight = (requestPanelWidth / 100) * containerHeight;
      const newPixelHeight = Math.max(150, Math.min(containerHeight - 150, pixelHeight + delta));
      const newPercentage = (newPixelHeight / containerHeight) * 100;
      setRequestPanelWidth(newPercentage);
    }
  }, [requestPanelWidth, setRequestPanelWidth, panelLayout]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      handler: handleNewRequest,
      description: 'New request',
    },
    {
      key: 'i',
      ctrl: true,
      handler: () => handleImport(),
      description: 'Import',
    },
    {
      key: 'e',
      ctrl: true,
      handler: () => setShowEnvironmentModal(true),
      description: 'Environments',
    },
    {
      key: '/',
      ctrl: true,
      handler: () => setShowShortcutsModal(true),
      description: 'Keyboard shortcuts',
    },
  ]);

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
    return <CreateWorkspaceScreen onCreated={() => window.location.reload()} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-fetchy-bg overflow-hidden">
      {/* Top bar */}
      <div className="h-12 bg-fetchy-sidebar border-b border-fetchy-border flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="./logo.jpg" alt="Fetchy" className="h-8 w-8 rounded" />
          <div className="text-xl font-bold text-fetchy-accent">Fetchy</div>
          <span className="text-xs text-fetchy-text-muted italic">Local by design. Reliable by nature</span>
          <span className="text-xs text-fetchy-text-muted">v{__APP_VERSION__}</span>
        </div>
        <div className="flex items-center gap-2">
          <EnvironmentDropdown onOpenSettings={() => setShowEnvironmentModal(true)} />
          <WorkspaceDropdown onOpenSettings={() => setShowWorkspacesModal(true)} />
          <Tooltip content="Settings">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            >
              <Settings size={18} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
          className="shrink-0 transition-all duration-200 overflow-hidden"
        >
          <Sidebar
            onImport={() => handleImport()}
            onHistoryItemClick={handleHistoryItemClick}
          />
        </div>

        {/* Sidebar resize handle */}
        {!sidebarCollapsed && (
          <ResizeHandle
            direction="horizontal"
            onResize={handleSidebarResize}
          />
        )}

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden" ref={mainPanelRef}>
          {/* Tab bar */}
          <TabBar />

          {/* Request/Response area */}
          {hasActiveRequest ? (
            <div className={`flex-1 flex overflow-hidden ${panelLayout === 'vertical' ? 'flex-col' : ''}`}>
              {/* Request panel */}
              <div
                style={panelLayout === 'horizontal'
                  ? { width: `${requestPanelWidth}%` }
                  : { height: `${requestPanelWidth}%` }
                }
                className="shrink-0 overflow-hidden"
              >
                <RequestPanel
                  setResponse={setResponse}
                  setSentRequest={setSentRequest}
                  setIsLoading={setIsLoading}
                  isLoading={isLoading}
                />
              </div>

              {/* Request/Response resize handle */}
              <ResizeHandle
                direction={panelLayout === 'horizontal' ? 'horizontal' : 'vertical'}
                onResize={handleRequestPanelResize}
              />

              {/* Response panel */}
              <div className="flex-1 overflow-hidden">
                <ResponsePanel
                  response={response}
                  sentRequest={sentRequest}
                  isLoading={isLoading}
                />
              </div>
            </div>
          ) : hasActiveOpenApi ? (
            <div className="flex-1 overflow-hidden">
              <OpenApiEditor documentId={activeTab?.openApiDocId} />
            </div>
          ) : (
            <WelcomeScreen
              onImportRequest={handleImportRequest}
              onImportCollection={handleImportCollection}
              onImportEnvironment={handleImportEnvironment}
            />
          )}
        </div>
      </div>

      {/* Bottom bar with toggle buttons */}
      <div className="h-10 bg-fetchy-sidebar border-t border-fetchy-border flex items-center px-4 gap-2 shrink-0">
        <Tooltip content={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </Tooltip>

        {hasActiveRequest && (
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

        <Tooltip content="Check for Updates">
          <button
            onClick={() => setShowUpdateModal(true)}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <RefreshCw size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Keyboard Shortcuts (Ctrl+/)">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <HelpCircle size={18} />
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
    </div>
  );
}

export default App;
