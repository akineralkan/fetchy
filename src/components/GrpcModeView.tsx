import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import RequestPanel from './RequestPanel';
import ResponsePanel from './ResponsePanel';
import ResizeHandle from './ResizeHandle';
import CollectionConfigPanel from './CollectionConfigPanel';
import { useAppStore } from '../store/appStore';
import { ApiResponse, ApiRequest, RequestHistoryItem } from '../types';

interface TabResponseData {
  response: ApiResponse | null;
  sentRequest: ApiRequest | null;
  isLoading: boolean;
}

export default function GrpcModeView() {
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

  const currentTabData = activeTabId ? tabResponses[activeTabId] : undefined;
  const response = currentTabData?.response ?? null;
  const sentRequest = currentTabData?.sentRequest ?? null;
  const isLoading = currentTabData?.isLoading ?? false;

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
  const hasActiveCollection = activeTab?.type === 'collection';

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
      title: `${item.request.name || 'History'}`,
      isHistoryItem: true,
      historyRequest: item.request,
      historyResponse: item.response,
    });
  }, [openTab]);

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
          onImport={() => {}}
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
                forcedAppMode="grpc"
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
        ) : hasActiveCollection && activeTab?.collectionId ? (
          <div className="flex-1 overflow-hidden">
            <CollectionConfigPanel collectionId={activeTab.collectionId} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-fetchy-bg text-fetchy-text-muted">
            <p className="text-sm">Open a request from the sidebar to get started with gRPC.</p>
          </div>
        )}
      </div>
    </>
  );
}
