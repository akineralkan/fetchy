import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import RequestPanel from './RequestPanel';
import ResponsePanel from './ResponsePanel';
import WelcomeScreen from './WelcomeScreen';
import ResizeHandle from './ResizeHandle';
import OpenApiEditor from './OpenApiEditor';
import CollectionConfigPanel from './CollectionConfigPanel';
import { useAppStore } from '../store/appStore';
import { ApiResponse, ApiRequest, RequestHistoryItem } from '../types';
import type { ImportSource } from './ImportModal';

interface TabResponseData {
  response: ApiResponse | null;
  sentRequest: ApiRequest | null;
  isLoading: boolean;
}

interface RestModeViewProps {
  onImport: (type?: ImportSource) => void;
  onImportRequest: () => void;
  onImportCollection: () => void;
  onImportEnvironment: () => void;
}

export default function RestModeView({
  onImport,
  onImportRequest,
  onImportCollection,
  onImportEnvironment,
}: RestModeViewProps) {
  const {
    tabs,
    activeTabId,
    sidebarWidth,
    sidebarCollapsed,
    openTab,
    setSidebarWidth,
    requestPanelWidth,
    setRequestPanelWidth,
    panelLayout,
  } = useAppStore();

  const [tabResponses, setTabResponses] = useState<Record<string, TabResponseData>>({});
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  const [urlBarContainer, setUrlBarContainer] = useState<HTMLDivElement | null>(null);

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

  const activeTab = tabs.find(t => t.id === activeTabId);
  const hasActiveRequest = activeTab?.type === 'request';
  const hasActiveOpenApi = activeTab?.type === 'openapi';
  const hasActiveCollection = activeTab?.type === 'collection';

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
    openTab({
      type: 'request',
      title: `${item.request.method} ${item.request.name || 'History'}`,
      isHistoryItem: true,
      historyRequest: item.request,
      historyResponse: item.response,
    });
  }, [openTab]);

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
      const containerHeight = mainPanelRef.current.offsetHeight - 40;
      const pixelHeight = (requestPanelWidth / 100) * containerHeight;
      const newPixelHeight = Math.max(150, Math.min(containerHeight - 150, pixelHeight + delta));
      const newPercentage = (newPixelHeight / containerHeight) * 100;
      setRequestPanelWidth(newPercentage);
    }
  }, [requestPanelWidth, setRequestPanelWidth, panelLayout]);

  return (
    <>
      {/* Sidebar */}
      <div
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        className="shrink-0 transition-all duration-200 overflow-hidden"
      >
        <Sidebar
          onImport={() => onImport()}
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

        {/* URL bar portal target – spans full width above the split */}
        {hasActiveRequest && (
          <div ref={setUrlBarContainer} className="shrink-0" />
        )}

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
                urlBarContainer={urlBarContainer}
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
        ) : hasActiveCollection ? (
          <div className="flex-1 overflow-hidden">
            <CollectionConfigPanel collectionId={activeTab?.collectionId!} />
          </div>
        ) : (
          <WelcomeScreen
            onImportRequest={onImportRequest}
            onImportCollection={onImportCollection}
            onImportEnvironment={onImportEnvironment}
          />
        )}
      </div>
    </>
  );
}
