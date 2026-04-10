import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, FileText, X, Terminal, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { ApiRequest, ApiResponse, HttpMethod, KeyValue } from '../types';
import { executeRequest } from '../utils/httpClient';
import { resolveRequestVariables, generateCurl, generateJavaScript, generatePython, generateJava, generateDotNet, generateGo, generateRust, generateCpp } from '../utils/helpers';
import { resolveInheritedAuth } from '../utils/authInheritance';
import { v4 as uuidv4 } from 'uuid';
import { parseCurlCommand } from '../utils/curlParser';
import { computeKeyColWidth } from '../utils/kvTableUtils';
import VariableInput from './VariableInput';
import Tooltip from './Tooltip';
import { AIRequestToolbar, AIGenerateRequestModal } from './AIAssistant';
import BodyEditor from './request/BodyEditor';
import AuthEditor from './request/AuthEditor';
import ScriptsEditor from './request/ScriptsEditor';
import UrlBar from './request/UrlBar';

interface RequestPanelProps {
  setResponse: (response: ApiResponse | null) => void;
  setSentRequest?: (request: ApiRequest | null) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
  urlBarContainer?: HTMLDivElement | null;
}

export default function RequestPanel({ setResponse, setSentRequest, setIsLoading, isLoading, urlBarContainer }: RequestPanelProps) {
  const {
    tabs,
    activeTabId,
    getRequest,
    updateRequest,
    updateTab,
    collections,
    getActiveEnvironment,
    addToHistory,
    addCollection,
    addRequest,
  } = useAppStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const [request, setLocalRequest] = useState<ApiRequest | null>(null);
  const [activeSection, setActiveSection] = useState<'params' | 'headers' | 'body' | 'auth' | 'preScript' | 'script'>('params');
  const [batchEditModal, setBatchEditModal] = useState<{ open: boolean; field: 'headers' | 'params' | null }>({ open: false, field: null });
  const [batchEditText, setBatchEditText] = useState('');
  const [codeModal, setCodeModal] = useState<{ open: boolean; activeLanguage: string; copied: boolean }>({ open: false, activeLanguage: 'curl', copied: false });
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [curlImportFlash, setCurlImportFlash] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Tracks the previously-loaded tab identity so we can detect real tab switches versus
  // incidental collection updates that should NOT overwrite unsaved edits.
  const prevTabKeyRef = useRef<string | null>(null);

  // Load request data when the active tab changes or when external collection updates arrive.
  //
  // Rules:
  //  1. Tab switched  → prefer tab.draftRequest (unsaved edits) if present, else load from store.
  //  2. Same tab, not modified (e.g. sidebar rename applied)  → reload from store so the new name
  //     is picked up (the appStore also updates draftRequest.name in this case).
  //  3. Same tab, isModified=true → skip reload; local edits are already correct.
  useEffect(() => {
    const tabKey = `${activeTab?.collectionId ?? ''}:${activeTab?.requestId ?? ''}`;
    const tabChanged = prevTabKeyRef.current !== tabKey;
    prevTabKeyRef.current = tabKey;

    if (activeTab?.isHistoryItem && activeTab?.historyRequest) {
      setLocalRequest({ ...activeTab.historyRequest });
      return;
    }

    if (!activeTab?.collectionId || !activeTab?.requestId) return;

    if (tabChanged) {
      // Switching to a (different) tab – restore draft if the user had unsaved changes.
      if (activeTab.draftRequest) {
        setLocalRequest({ ...activeTab.draftRequest });
      } else {
        const req = getRequest(activeTab.collectionId, activeTab.requestId);
        if (req) setLocalRequest({ ...req });
      }
    } else if (!activeTab.isModified) {
      // Same tab, nothing modified – allow reload so external changes (e.g. sidebar
      // rename, workspace sync) are reflected immediately.
      const req = getRequest(activeTab.collectionId, activeTab.requestId);
      if (req) setLocalRequest({ ...req });
    }
    // Same tab + isModified: skip reload and keep the user's unsaved edits.
  }, [activeTab?.requestId, activeTab?.collectionId, activeTab?.isHistoryItem, activeTab?.historyRequest, activeTab?.isModified, getRequest, collections]);

  const handleShowCode = useCallback((language: string = 'curl') => {
    if (!request) return;
    setCodeModal({ open: true, activeLanguage: language, copied: false });
  }, [request]);

  const getCodeForLanguage = (language: string): string => {
    if (!request) return '';

    const collection = collections.find(c => c.id === activeTab?.collectionId);
    const environment = getActiveEnvironment();
    const allVariables = [
      ...(collection?.variables || []),
      ...(environment?.variables || []),
    ];

    switch (language) {
      case 'curl':
        return generateCurl(request, allVariables);
      case 'javascript':
        return generateJavaScript(request, allVariables);
      case 'python':
        return generatePython(request, allVariables);
      case 'java':
        return generateJava(request, allVariables);
      case 'dotnet':
        return generateDotNet(request, allVariables);
      case 'go':
        return generateGo(request, allVariables);
      case 'rust':
        return generateRust(request, allVariables);
      case 'cpp':
        return generateCpp(request, allVariables);
      default:
        return '';
    }
  };

  const handleCopyCode = () => {
    const code = getCodeForLanguage(codeModal.activeLanguage);
    navigator.clipboard.writeText(code);
    setCodeModal({ ...codeModal, copied: true });
    setTimeout(() => setCodeModal({ ...codeModal, copied: false }), 2000);
  };

  const handleSave = useCallback(() => {
    if (!request) return;
    if (!activeTab?.isModified && !activeTab?.isHistoryItem) return;

    // If this is a history item, save to special "Request History Rollback" collection
    if (activeTab?.isHistoryItem) {
      // Find or create the "Request History Rollback" collection
      let rollbackCollection = collections.find(c => c.name === 'Request History Rollback');

      if (!rollbackCollection) {
        rollbackCollection = addCollection('Request History Rollback', 'Saved requests from history');
      }

      // Add the request to the rollback collection
      const newRequest = addRequest(rollbackCollection.id, null, request);

      // Update the tab to no longer be a history item and link to the new request
      updateTab(activeTab.id, {
        isHistoryItem: false,
        historyRequest: undefined,
        historyResponse: undefined,
        collectionId: rollbackCollection.id,
        requestId: newRequest.id,
        isModified: false,
        title: newRequest.name,
      });
    } else if (activeTab?.collectionId) {
      // Normal save for regular requests
      updateRequest(activeTab.collectionId, request.id, request);
      // Clear the draft and mark as clean.
      updateTab(activeTab.id, { isModified: false, draftRequest: undefined, title: request.name });
    }
  }, [request, activeTab, updateRequest, updateTab, collections, addCollection, addRequest]);

  const handleChange = useCallback((updates: Partial<ApiRequest>) => {
    if (request) {
      // Safety guard: skip the update if the local request is out-of-sync with the
      // active tab (e.g. a stale closure from a CodeMirror callback fires after a
      // rapid tab switch but before React has reconciled the new state).
      if (activeTab?.requestId && request.id !== activeTab.requestId) return;

      const updated = { ...request, ...updates };
      setLocalRequest(updated);
      if (activeTab) {
        // Store the full updated request as a draft so it survives tab switches and
        // incidental collection updates without being saved to the collection.
        updateTab(activeTab.id, { isModified: true, draftRequest: updated });
      }
    }
  }, [request, activeTab, updateTab]);

  // Detect cURL paste on the URL bar and auto-populate the request
  const handleUrlPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').trim();
    // Quick check: does it look like a cURL command?
    if (/^curl\s/i.test(text.replace(/^\s*/, ''))) {
      try {
        const parsed = parseCurlCommand(text);
        if (parsed && parsed.url && request) {
          e.preventDefault(); // Only prevent default if we successfully parsed
          // Merge the parsed cURL into the current request, preserving the request id/name
          handleChange({
            method: parsed.method,
            url: parsed.url,
            headers: parsed.headers,
            params: parsed.params,
            body: parsed.body,
            auth: parsed.auth,
          });
          // Flash a brief visual confirmation
          setCurlImportFlash(true);
          setTimeout(() => setCurlImportFlash(false), 2000);
        }
      } catch {
        // Parsing failed — do nothing, let normal paste happen
      }
    }
    // For anything else (non-cURL or failed parse), normal paste behavior is preserved
  }, [request, handleChange]);

  // Rebuild URL query string from params array (no encoding for display)
  const rebuildUrlFromParams = useCallback((params: KeyValue[]) => {
    if (!request) return;
    const baseUrl = request.url.split('?')[0];
    const enabledWithKey = params.filter(p => p.enabled && p.key);
    if (enabledWithKey.length > 0) {
      const qs = enabledWithKey
        .map(p => `${p.key}=${p.value}`)
        .join('&');
      handleChange({ url: `${baseUrl}?${qs}`, params });
    } else {
      handleChange({ url: baseUrl, params });
    }
  }, [request, handleChange]);

  // Get inherited auth by walking the full ancestor chain (folder → parent → … → collection)
  const getInheritedAuth = useCallback(() => {
    if (!activeTab?.collectionId) return null;
    const collection = collections.find(c => c.id === activeTab.collectionId);
    if (!collection) return null;
    return resolveInheritedAuth(collection, activeTab.folderId ?? undefined);
  }, [activeTab?.collectionId, activeTab?.folderId, collections]);

  const handleSend = useCallback(async () => {
    if (!request || isLoading) return;

    // Create a fresh AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setResponse(null);

    const collection = collections.find(c => c.id === activeTab?.collectionId);
    const environment = getActiveEnvironment();
    const inheritedAuth = getInheritedAuth();

    try {
      const response = await executeRequest({
        request,
        collectionVariables: collection?.variables || [],
        environmentVariables: environment?.variables || [],
        inheritedAuth,
        collectionPreScript: collection?.preScript,
        collectionScript: collection?.script,
        signal: controller.signal,
      });

      // Resolve variables AFTER executeRequest so that prescripts have already
      // updated the environment (via fetchy.environment.set / pm.environment.set).
      // Re-read the environment from the store to pick up prescript changes.
      const postScriptEnv = getActiveEnvironment();
      const resolvedRequest = resolveRequestVariables(
        request,
        collection?.variables || [],
        postScriptEnv?.variables || []
      );

      setSentRequest?.(resolvedRequest);
      setResponse(response);
      // Save to history with resolved variables so actual values are shown
      addToHistory({ request: resolvedRequest, response });
    } catch (error) {
      // Don't show error UI if the request was intentionally aborted
      if (controller.signal.aborted) return;
      console.error('Request failed:', error);
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        time: 0,
        size: 0,
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [request, isLoading, handleSave, setIsLoading, setResponse, setSentRequest, collections, activeTab, getActiveEnvironment, getInheritedAuth, addToHistory]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, [setIsLoading]);

  // Keyboard shortcuts for save (Ctrl+S) and send (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.shiftKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSend, handleCancel, isLoading]);

  // ─── AI handlers ─────────────────────────────────────────────────────────────
  const handleAIApplyRequest = useCallback(
    (generated: {
      method: string;
      url: string;
      headers: Array<{ key: string; value: string; enabled: boolean }>;
      params: Array<{ key: string; value: string; enabled: boolean }>;
      body: { type: string; raw?: string };
      name: string;
    }) => {
      if (!request) return;
      handleChange({
        method: (generated.method || request.method) as HttpMethod,
        url: generated.url || request.url,
        headers: generated.headers.map((h) => ({ id: uuidv4(), ...h })),
        params: generated.params.map((p) => ({ id: uuidv4(), ...p })),
        body: {
          type: generated.body.type as ApiRequest['body']['type'],
          raw: generated.body.raw || '',
        },
        name: generated.name || request.name,
      });
    },
    [request, handleChange]
  );

  const handleAIApplyScript = useCallback(
    (script: string, type: 'pre-request' | 'test') => {
      if (!request) return;
      if (type === 'pre-request') {
        handleChange({ preScript: script });
        setActiveSection('preScript');
      } else {
        handleChange({ script });
        setActiveSection('script');
      }
    },
    [request, handleChange]
  );

  const handleAIApplyName = useCallback(
    (name: string) => {
      if (!request) return;
      handleChange({ name });
    },
    [request, handleChange]
  );

  const addKeyValue = (field: 'headers' | 'params') => {
    if (!request) return;
    const newKv: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
    const newItems = [...request[field], newKv];
    if (field === 'params') {
      rebuildUrlFromParams(newItems);
    } else {
      handleChange({ [field]: newItems });
    }
  };

  const updateKeyValue = (field: 'headers' | 'params', id: string, updates: Partial<KeyValue>) => {
    if (!request) return;
    const newItems = request[field].map(kv => kv.id === id ? { ...kv, ...updates } : kv);
    if (field === 'params') {
      rebuildUrlFromParams(newItems);
    } else {
      handleChange({ [field]: newItems });
    }
  };

  const removeKeyValue = (field: 'headers' | 'params', id: string) => {
    if (!request) return;
    const newItems = request[field].filter(kv => kv.id !== id);
    if (field === 'params') {
      rebuildUrlFromParams(newItems);
    } else {
      handleChange({ [field]: newItems });
    }
  };

  const openBatchEdit = (field: 'headers' | 'params') => {
    if (!request) return;
    // Convert key-value pairs to text format (key: value per line)
    const text = request[field]
      .map(kv => `${kv.enabled ? '' : '# '}${kv.key}: ${kv.value}`)
      .join('\n');
    setBatchEditText(text);
    setBatchEditModal({ open: true, field });
  };

  const applyBatchEdit = () => {
    if (!request || !batchEditModal.field) return;

    // Parse text back to key-value pairs
    const lines = batchEditText.split('\n').filter(line => line.trim());
    const newItems: KeyValue[] = lines.map(line => {
      const disabled = line.startsWith('# ');
      const cleanLine = disabled ? line.slice(2) : line;
      const colonIndex = cleanLine.indexOf(':');
      const key = colonIndex > -1 ? cleanLine.slice(0, colonIndex).trim() : cleanLine.trim();
      const value = colonIndex > -1 ? cleanLine.slice(colonIndex + 1).trim() : '';
      return {
        id: uuidv4(),
        key,
        value,
        enabled: !disabled,
      };
    });

    if (batchEditModal.field === 'params') {
      rebuildUrlFromParams(newItems);
    } else {
      handleChange({ [batchEditModal.field]: newItems });
    }
    setBatchEditModal({ open: false, field: null });
    setBatchEditText('');
  };


  if (!request) {
    return (
      <div className="h-full flex items-center justify-center text-fetchy-text-muted">
        <p>Select a request to edit</p>
      </div>
    );
  }

  const renderKeyValueTable = (field: 'headers' | 'params') => {
    const items = request[field];

    // Size the Key column to fit the longest key, giving remaining space to Value.
    const keyColWidth = computeKeyColWidth(items.map(i => i.key));

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-end gap-2 p-2 border-b border-fetchy-border">
          <Tooltip content="Bulk Edit">
            <button
              onClick={() => openBatchEdit(field)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border rounded"
            >
              <FileText size={14} /> Bulk Edit
            </button>
          </Tooltip>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full kv-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: `${keyColWidth}px` }} />
              <col />
              <col style={{ width: '32px' }} />
            </colgroup>
            <thead className="sticky top-0 bg-fetchy-bg">
              <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                <th className="w-8 p-2"></th>
                <th className="p-2">Key</th>
                <th className="p-2">Value</th>
                <th className="w-8 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-fetchy-border/50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateKeyValue(field, item.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-fetchy-accent"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => updateKeyValue(field, item.id, { key: e.target.value })}
                      placeholder="Key"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                    />
                  </td>
                  <td className="p-0">
                    <VariableInput
                      value={item.value}
                      onChange={(value) => updateKeyValue(field, item.id, { value })}
                      placeholder="Value"
                      className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeKeyValue(field, item.id)}
                      className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => addKeyValue(field)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-fetchy-text-muted hover:text-fetchy-text"
          >
            <Plus size={14} /> Add {field === 'headers' ? 'Header' : 'Parameter'}
          </button>
        </div>
      </div>
    );
  };

  const urlBar = (
    <UrlBar
      method={request.method}
      url={request.url}
      params={request.params || []}
      isLoading={isLoading}
      curlImportFlash={curlImportFlash}
      onChange={handleChange}
      onPaste={handleUrlPaste}
      onSend={handleSend}
      onCancel={handleCancel}
      onShowCode={handleShowCode}
    />
  );

  return (
    <div className="h-full flex flex-col bg-fetchy-bg">
      {/* URL bar – portaled above both panels when container is available */}
      {urlBarContainer ? createPortal(urlBar, urlBarContainer) : urlBar}

      {/* Section tabs with Save button */}
      <div className="flex items-center border-b border-fetchy-border shrink-0">
        <div className="flex flex-1">
          {([
            { id: 'params', label: 'Params', count: request.params.filter(p => p.enabled).length },
            { id: 'headers', label: 'Headers', count: request.headers.filter(h => h.enabled).length },
            { id: 'body', label: 'Body', hasContent: request.body.type !== 'none' },
            { id: 'auth', label: 'Auth' },
            { id: 'preScript', label: 'Pre-Script' },
            { id: 'script', label: 'Post-Script' },
          ]).map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`relative px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-fetchy-accent text-fetchy-accent bg-fetchy-accent/25'
                  : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border/50'
              }`}
            >
              {section.label}
              {section.count !== undefined && section.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-fetchy-accent/20 text-fetchy-accent rounded">
                  {section.count}
                </span>
              )}
              {section.status && section.status !== 'none' ? (
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  section.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
              ) : section.hasContent ? (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-fetchy-accent/60"></span>
              ) : null}
            </button>
          ))}
        </div>
        <Tooltip content={activeTab?.isHistoryItem ? "Save to Request History Rollback" : "Save Request"}>
          <button
            onClick={handleSave}
            disabled={!activeTab?.isModified && !activeTab?.isHistoryItem}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab?.isModified || activeTab?.isHistoryItem
                ? 'text-fetchy-accent hover:bg-fetchy-accent/10'
                : 'text-fetchy-text-muted opacity-40 cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            {activeTab?.isHistoryItem ? 'Save to Rollback' : 'Save'}
          </button>
        </Tooltip>
      </div>

      {/* AI Request Toolbar */}
      <div className="px-3 py-1.5 border-b border-fetchy-border shrink-0">
        <AIRequestToolbar
          request={request}
          onOpenGenerateRequest={() => setShowAIGenerateModal(true)}
          onApplyScript={handleAIApplyScript}
          onApplyName={handleAIApplyName}
        />
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'params' && renderKeyValueTable('params')}
        {activeSection === 'headers' && renderKeyValueTable('headers')}
        {activeSection === 'body' && (
          <BodyEditor
            body={request.body}
            onChange={(body) => handleChange({ body })}
          />
        )}
        {activeSection === 'auth' && (
          <AuthEditor
            auth={request.auth}
            inheritedAuth={getInheritedAuth()}
            onChange={(auth) => handleChange({ auth })}
          />
        )}
        {activeSection === 'preScript' && (
          <ScriptsEditor
            type="pre"
            value={request.preScript || ''}
            onChange={(preScript) => handleChange({ preScript })}
          />
        )}
        {activeSection === 'script' && (
          <ScriptsEditor
            type="post"
            value={request.script || ''}
            onChange={(script) => handleChange({ script })}
          />
        )}
      </div>

      {/* Batch Edit Modal */}
      {batchEditModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-fetchy-border">
              <h2 className="text-lg font-semibold">
                Bulk Edit {batchEditModal.field === 'headers' ? 'Headers' : 'Parameters'}
              </h2>
              <button
                onClick={() => setBatchEditModal({ open: false, field: null })}
                className="p-1 hover:bg-fetchy-border rounded"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-fetchy-text-muted mb-3">
                Edit {batchEditModal.field} in bulk. One per line in <code className="bg-fetchy-border px-1 rounded">key: value</code> format.
                Prefix with <code className="bg-fetchy-border px-1 rounded"># </code> to disable.
              </p>
              <textarea
                value={batchEditText}
                onChange={(e) => setBatchEditText(e.target.value)}
                className="flex-1 w-full min-h-[300px] bg-fetchy-bg border border-fetchy-border rounded p-3 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-fetchy-accent"
                placeholder={`Content-Type: application/json\nAuthorization: Bearer token\n# X-Disabled-Header: value`}
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-fetchy-border">
              <button
                onClick={() => setBatchEditModal({ open: false, field: null })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={applyBatchEdit}
                className="btn btn-primary"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generation Modal */}
      {codeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-fetchy-bg border border-fetchy-border rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-fetchy-border">
              <h2 className="text-lg font-semibold text-fetchy-text flex items-center gap-2">
                <Terminal size={20} className="text-fetchy-accent" />
                Code Generation
              </h2>
              <button
                onClick={() => setCodeModal({ open: false, activeLanguage: 'curl', copied: false })}
                className="text-fetchy-text-muted hover:text-fetchy-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Language Tabs */}
            <div className="flex border-b border-fetchy-border overflow-x-auto">
              {[
                { id: 'curl', label: 'cURL' },
                { id: 'javascript', label: 'JavaScript' },
                { id: 'python', label: 'Python' },
                { id: 'java', label: 'Java' },
                { id: 'dotnet', label: '.NET Core' },
                { id: 'go', label: 'Go' },
                { id: 'rust', label: 'Rust' },
                { id: 'cpp', label: 'C++' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setCodeModal({ ...codeModal, activeLanguage: lang.id, copied: false })}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    codeModal.activeLanguage === lang.id
                      ? 'border-fetchy-accent text-fetchy-accent'
                      : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-fetchy-text-muted mb-3">
                {codeModal.activeLanguage === 'curl' && 'Copy and paste this cURL command into your terminal'}
                {codeModal.activeLanguage === 'javascript' && 'JavaScript code using native fetch API'}
                {codeModal.activeLanguage === 'python' && 'Python code using requests library (pip install requests)'}
                {codeModal.activeLanguage === 'java' && 'Java code using HttpClient (Java 11+)'}
                {codeModal.activeLanguage === 'dotnet' && '.NET Core code using HttpClient'}
                {codeModal.activeLanguage === 'go' && 'Go code using net/http package'}
                {codeModal.activeLanguage === 'rust' && 'Rust code using reqwest crate (cargo add reqwest tokio)'}
                {codeModal.activeLanguage === 'cpp' && 'C++ code using libcurl (requires libcurl library)'}
              </p>
              <div className="flex-1 bg-[var(--input-bg)] border border-fetchy-border rounded p-4 overflow-auto">
                <pre className="text-sm text-fetchy-text font-mono whitespace-pre-wrap break-all">
                  {getCodeForLanguage(codeModal.activeLanguage)}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-fetchy-border">
              <button
                onClick={() => setCodeModal({ open: false, activeLanguage: 'curl', copied: false })}
                className="btn btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleCopyCode}
                className="btn btn-primary flex items-center gap-2"
              >
                {codeModal.copied ? (
                  <>
                    <Check size={16} /> Copied!
                  </>
                ) : (
                  <>
                    <FileText size={16} /> Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Request Modal */}
      <AIGenerateRequestModal
        isOpen={showAIGenerateModal}
        onClose={() => setShowAIGenerateModal(false)}
        onApply={handleAIApplyRequest}
      />
    </div>
  );
}
