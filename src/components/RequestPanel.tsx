import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Save, Plus, Trash2, FileText, X, Link, Terminal, Check, Code, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { ApiRequest, ApiResponse, HttpMethod, KeyValue } from '../types';
import { executeRequest } from '../utils/httpClient';
import { resolveRequestVariables, generateCurl, generateJavaScript, generatePython, generateJava, generateDotNet, generateGo, generateRust, generateCpp } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { parseCurlCommand } from '../utils/curlParser';
import VariableInput from './VariableInput';
import VariableTextarea from './VariableTextarea';
import Tooltip from './Tooltip';
import CodeEditor, { CodeEditorHandle } from './CodeEditor';
import { AIRequestToolbar, AIGenerateRequestModal } from './AIAssistant';

interface RequestPanelProps {
  setResponse: (response: ApiResponse | null) => void;
  setSentRequest?: (request: ApiRequest | null) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
  urlBarContainer?: HTMLDivElement | null;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

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
  const preScriptEditorRef = useRef<CodeEditorHandle>(null);
  const postScriptEditorRef = useRef<CodeEditorHandle>(null);
  const [batchEditText, setBatchEditText] = useState('');
  const [codeModal, setCodeModal] = useState<{ open: boolean; activeLanguage: string; copied: boolean }>({ open: false, activeLanguage: 'curl', copied: false });
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [curlImportFlash, setCurlImportFlash] = useState(false);

  // Load request data when tab changes or when collections update
  // BUG FIX: Added 'collections' to dependency array to prevent stale data issue
  // Without it, when a user edits the request name in the sidebar, the local state here
  // doesn't update. Then when saving, it would overwrite with the old name from local state.
  // By including 'collections', the local state refreshes whenever the store updates,
  // ensuring we always have the latest request data including name changes from sidebar.
  useEffect(() => {
    // If this is a history item tab, load the history request data
    if (activeTab?.isHistoryItem && activeTab?.historyRequest) {
      setLocalRequest({ ...activeTab.historyRequest });
    } else if (activeTab?.collectionId && activeTab?.requestId) {
      const req = getRequest(activeTab.collectionId, activeTab.requestId);
      if (req) {
        setLocalRequest({ ...req });
      }
    }
  }, [activeTab?.requestId, activeTab?.collectionId, activeTab?.isHistoryItem, activeTab?.historyRequest, getRequest, collections]);

  const handleShowCode = useCallback((language: string = 'curl') => {
    if (!request) return;
    setCodeModal({ open: true, activeLanguage: language, copied: false });
    setShowCodeDropdown(false);
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
      updateTab(activeTab.id, { isModified: false, title: request.name });
    }
  }, [request, activeTab, updateRequest, updateTab, collections, addCollection, addRequest]);

  const handleChange = useCallback((updates: Partial<ApiRequest>) => {
    if (request) {
      const updated = { ...request, ...updates };
      setLocalRequest(updated);
      if (activeTab) {
        updateTab(activeTab.id, { isModified: true });
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

  // Get inherited auth from collection or folder
  const getInheritedAuth = useCallback(() => {
    if (!activeTab?.collectionId) return null;
    const collection = collections.find(c => c.id === activeTab.collectionId);
    if (!collection) return null;

    // If request is in a folder, check folder auth first
    if (activeTab.folderId) {
      const findFolderAuth = (folders: typeof collection.folders, folderId: string): typeof collection.auth | null => {
        for (const folder of folders) {
          if (folder.id === folderId) {
            if (folder.auth && folder.auth.type !== 'none' && folder.auth.type !== 'inherit') {
              return folder.auth;
            }
            return null;
          }
          const result = findFolderAuth(folder.folders, folderId);
          if (result !== null) return result;
        }
        return null;
      };
      const folderAuth = findFolderAuth(collection.folders, activeTab.folderId);
      if (folderAuth) return folderAuth;
    }

    // Fall back to collection auth
    if (collection.auth && collection.auth.type !== 'none' && collection.auth.type !== 'inherit') {
      return collection.auth;
    }
    return null;
  }, [activeTab?.collectionId, activeTab?.folderId, collections]);

  const handleSend = useCallback(async () => {
    if (!request || isLoading) return;

    setIsLoading(true);
    setResponse(null);

    const collection = collections.find(c => c.id === activeTab?.collectionId);
    const environment = getActiveEnvironment();
    const inheritedAuth = getInheritedAuth();

    // Resolve variables for history and sentRequest display
    const resolvedRequest = resolveRequestVariables(
      request,
      collection?.variables || [],
      environment?.variables || []
    );

    setSentRequest?.(resolvedRequest);

    try {
      const response = await executeRequest({
        request,
        collectionVariables: collection?.variables || [],
        environmentVariables: environment?.variables || [],
        inheritedAuth,
      });

      setResponse(response);
      // Save to history with resolved variables so actual values are shown
      addToHistory({ request: resolvedRequest, response });
    } catch (error) {
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
      setIsLoading(false);
    }
  }, [request, isLoading, setIsLoading, setResponse, setSentRequest, collections, activeTab, getActiveEnvironment, getInheritedAuth, addToHistory]);

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSend]);

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

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 p-2 border-b border-fetchy-border">
          <button
            onClick={() => addKeyValue(field)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border rounded"
          >
            <Plus size={14} /> Add {field === 'headers' ? 'Header' : 'Parameter'}
          </button>
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
          <table className="w-full kv-table">
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
        </div>
      </div>
    );
  };

  const renderBody = () => {
    const bodyTypes = [
      { value: 'none', label: 'None' },
      { value: 'json', label: 'JSON' },
      { value: 'raw', label: 'Raw' },
      { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
      { value: 'form-data', label: 'Form Data' },
    ];

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-fetchy-border">
          {bodyTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleChange({ body: { ...request.body, type: type.value as any } })}
              className={`px-3 py-1 text-sm rounded ${
                request.body.type === type.value
                  ? 'bg-fetchy-accent text-white'
                  : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {request.body.type === 'none' && (
            <div className="h-full flex items-center justify-center text-fetchy-text-muted">
              <p>This request does not have a body</p>
            </div>
          )}

          {request.body.type === 'json' && (
            <CodeEditor
              value={request.body.raw || ''}
              onChange={(value: string) => handleChange({ body: { ...request.body, raw: value } })}
              language="json"
            />
          )}

          {request.body.type === 'raw' && (
            <VariableTextarea
              value={request.body.raw || ''}
              onChange={(value: string) => handleChange({ body: { ...request.body, raw: value } })}
              placeholder="Enter request body..."
            />
          )}

          {request.body.type === 'x-www-form-urlencoded' && (
            <div className="p-2">
              <table className="w-full kv-table">
                <thead>
                  <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Value</th>
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(request.body.urlencoded || []).map((item) => (
                    <tr key={item.id} className="border-b border-fetchy-border/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, enabled: e.target.checked } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          className="w-4 h-4 accent-fetchy-accent"
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, key: e.target.value } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          placeholder="Key"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                        />
                      </td>
                      <td className="p-0">
                        <VariableInput
                          value={item.value}
                          onChange={(value) => {
                            const updated = (request.body.urlencoded || []).map(u =>
                              u.id === item.id ? { ...u, value: value } : u
                            );
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
                          placeholder="Value"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            const updated = (request.body.urlencoded || []).filter(u => u.id !== item.id);
                            handleChange({ body: { ...request.body, urlencoded: updated } });
                          }}
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
                onClick={() => {
                  const newItem: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
                  handleChange({ body: { ...request.body, urlencoded: [...(request.body.urlencoded || []), newItem] } });
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-fetchy-text-muted hover:text-fetchy-text"
              >
                <Plus size={14} /> Add Field
              </button>
            </div>
          )}

          {request.body.type === 'form-data' && (
            <div className="p-2">
              <table className="w-full kv-table">
                <thead>
                  <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Value</th>
                    <th className="w-8 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(request.body.formData || []).map((item) => (
                    <tr key={item.id} className="border-b border-fetchy-border/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, enabled: e.target.checked } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          className="w-4 h-4 accent-fetchy-accent"
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, key: e.target.value } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          placeholder="Key"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                        />
                      </td>
                      <td className="p-0">
                        <VariableInput
                          value={item.value}
                          onChange={(value) => {
                            const updated = (request.body.formData || []).map(f =>
                              f.id === item.id ? { ...f, value: value } : f
                            );
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
                          placeholder="Value"
                          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            const updated = (request.body.formData || []).filter(f => f.id !== item.id);
                            handleChange({ body: { ...request.body, formData: updated } });
                          }}
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
                onClick={() => {
                  const newItem: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
                  handleChange({ body: { ...request.body, formData: [...(request.body.formData || []), newItem] } });
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-fetchy-text-muted hover:text-fetchy-text"
              >
                <Plus size={14} /> Add Field
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAuth = () => {
    const authTypes = [
      { value: 'inherit', label: 'Inherit' },
      { value: 'none', label: 'No Auth' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'bearer', label: 'Bearer Token' },
      { value: 'api-key', label: 'API Key' },
    ];

    const inheritedAuth = getInheritedAuth();
    const getAuthTypeLabel = (type: string) => {
      const found = authTypes.find(t => t.value === type);
      return found ? found.label : type;
    };

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-fetchy-border">
          {authTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleChange({ auth: { ...request.auth, type: type.value as any } })}
              className={`px-3 py-1 text-sm rounded ${
                request.auth.type === type.value
                  ? 'bg-fetchy-accent text-white'
                  : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-auto">
          {request.auth.type === 'inherit' && (
            <div className="space-y-4">
              {inheritedAuth ? (
                <div className="p-4 bg-fetchy-card rounded-lg border border-fetchy-border">
                  <div className="flex items-center gap-2 text-fetchy-text mb-2">
                    <Link size={16} className="text-fetchy-accent" />
                    <span className="font-medium">Inheriting auth from parent</span>
                  </div>
                  <div className="text-sm text-fetchy-text-muted space-y-1">
                    <p><span className="font-medium">Type:</span> {getAuthTypeLabel(inheritedAuth.type)}</p>
                    {inheritedAuth.type === 'basic' && (
                      <p><span className="font-medium">Username:</span> {inheritedAuth.basic?.username || '(not set)'}</p>
                    )}
                    {inheritedAuth.type === 'bearer' && (
                      <p><span className="font-medium">Token:</span> {inheritedAuth.bearer?.token ? '••••••••' : '(not set)'}</p>
                    )}
                    {inheritedAuth.type === 'api-key' && (
                      <>
                        <p><span className="font-medium">Key:</span> {inheritedAuth.apiKey?.key || '(not set)'}</p>
                        <p><span className="font-medium">Add to:</span> {inheritedAuth.apiKey?.addTo === 'header' ? 'Header' : 'Query Params'}</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-fetchy-text-muted text-center py-8">
                  <p>No auth configured in parent collection or folder</p>
                  <p className="text-xs mt-2">Configure auth at the collection or folder level to inherit it here</p>
                </div>
              )}
            </div>
          )}

          {request.auth.type === 'none' && (
            <div className="text-fetchy-text-muted text-center py-8">
              <p>This request does not require authentication</p>
            </div>
          )}

          {request.auth.type === 'basic' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Username</label>
                <VariableInput
                  value={request.auth.basic?.username || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, basic: { ...request.auth.basic, username: value, password: request.auth.basic?.password || '' } }
                  })}
                  className="w-full"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Password</label>
                <VariableInput
                  value={request.auth.basic?.password || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, basic: { ...request.auth.basic, username: request.auth.basic?.username || '', password: value } }
                  })}
                  className="w-full"
                  placeholder="Enter password"
                />
              </div>
            </div>
          )}

          {request.auth.type === 'bearer' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Token</label>
                <VariableInput
                  value={request.auth.bearer?.token || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, bearer: { token: value } }
                  })}
                  className="w-full"
                  placeholder="Enter bearer token"
                />
              </div>
            </div>
          )}

          {request.auth.type === 'api-key' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Key</label>
                <VariableInput
                  value={request.auth.apiKey?.key || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: value, value: request.auth.apiKey?.value || '', addTo: request.auth.apiKey?.addTo || 'header' } }
                  })}
                  className="w-full"
                  placeholder="e.g., X-API-Key"
                />
              </div>
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Value</label>
                <VariableInput
                  value={request.auth.apiKey?.value || ''}
                  onChange={(value) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: request.auth.apiKey?.key || '', value: value, addTo: request.auth.apiKey?.addTo || 'header' } }
                  })}
                  className="w-full"
                  placeholder="Enter API key value"
                />
              </div>
              <div>
                <label className="block text-sm text-fetchy-text-muted mb-1">Add to</label>
                <select
                  value={request.auth.apiKey?.addTo || 'header'}
                  onChange={(e) => handleChange({
                    auth: { ...request.auth, apiKey: { ...request.auth.apiKey, key: request.auth.apiKey?.key || '', value: request.auth.apiKey?.value || '', addTo: e.target.value as 'header' | 'query' } }
                  })}
                  className="w-full"
                >
                  <option value="header">Header</option>
                  <option value="query">Query Params</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const urlBar = (
      <div className="px-4 py-3 border-b border-fetchy-border flex items-center gap-2 bg-fetchy-bg relative">

        <select
          value={request.method}
          onChange={(e) => handleChange({ method: e.target.value as HttpMethod })}
          className="w-28 font-medium"
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>

        <VariableInput
          value={request.url}
          onChange={(url) => {
            // Parse query params from URL and sync to Params tab
            const qIndex = url.indexOf('?');
            if (qIndex >= 0) {
              const queryString = url.substring(qIndex + 1);
              const pairs = queryString.split('&');
              const parsed: KeyValue[] = pairs
                .filter(p => p.length > 0)
                .map(pair => {
                  const eqIndex = pair.indexOf('=');
                  const key = eqIndex >= 0 ? pair.substring(0, eqIndex) : pair;
                  const value = eqIndex >= 0 ? pair.substring(eqIndex + 1) : '';
                  return { id: uuidv4(), key: decodeURIComponent(key), value: decodeURIComponent(value), enabled: true };
                });
              // Keep any existing params that are disabled (user manually toggled off)
              const disabledParams = (request.params || []).filter(p => !p.enabled);
              handleChange({ url, params: [...parsed, ...disabledParams] });
            } else {
              handleChange({ url });
            }
          }}
          onPaste={handleUrlPaste}
          className="flex-1 text-sm"
          placeholder="Enter request URL or paste a cURL command"
        />

        {/* cURL import flash indicator */}
        {curlImportFlash && (
          <div className="absolute top-full left-0 right-0 z-50 flex justify-center mt-1 pointer-events-none">
            <div className="px-3 py-1.5 bg-green-500/90 text-white text-xs font-medium rounded-md shadow-lg flex items-center gap-1.5 animate-fade-in">
              <Terminal size={12} /> cURL imported successfully
            </div>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={isLoading || !request.url}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send size={16} /> Send
            </>
          )}
        </button>

        <div className="relative">
          <Tooltip content="Generate Code">
            <button
              onClick={() => setShowCodeDropdown(!showCodeDropdown)}
              disabled={!request.url}
              className="btn btn-secondary flex items-center gap-1.5 disabled:opacity-50 pr-2"
            >
              <Code size={16} className="text-purple-400" />
              <span className="font-medium">Code</span>
              <ChevronDown size={14} className="text-fetchy-text-muted" />
            </button>
          </Tooltip>

          {showCodeDropdown && request.url && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCodeDropdown(false)}
              />
              <div className="absolute top-full right-0 mt-1 w-48 bg-fetchy-bg border border-fetchy-border rounded-lg shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto">
                {[
                  { id: 'curl', label: 'cURL', icon: '⚡' },
                  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
                  { id: 'python', label: 'Python', icon: '🐍' },
                  { id: 'java', label: 'Java', icon: '☕' },
                  { id: 'dotnet', label: '.NET Core', icon: '🔷' },
                  { id: 'go', label: 'Go', icon: '🐹' },
                  { id: 'rust', label: 'Rust', icon: '🦀' },
                  { id: 'cpp', label: 'C++', icon: '⚙️' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => handleShowCode(lang.id)}
                    className="w-full px-4 py-2 text-left text-sm text-fetchy-text hover:bg-fetchy-border transition-colors flex items-center gap-2"
                  >
                    <span className="text-base">{lang.icon}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
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
            { id: 'body', label: 'Body' },
            { id: 'auth', label: 'Auth' },
            { id: 'preScript', label: 'Pre-Script' },
            { id: 'script', label: 'Post-Script', status: activeTab?.scriptExecutionStatus },
          ]).map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`relative px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-fetchy-accent text-fetchy-accent'
                  : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
              }`}
            >
              {section.label}
              {section.count !== undefined && section.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-fetchy-accent/20 text-fetchy-accent rounded">
                  {section.count}
                </span>
              )}
              {section.status && section.status !== 'none' && (
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  section.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
              )}
            </button>
          ))}
        </div>
        <Tooltip content={activeTab?.isHistoryItem ? "Save to Request History Rollback" : "Save Request"}>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border transition-colors flex items-center gap-1"
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
        {activeSection === 'body' && renderBody()}
        {activeSection === 'auth' && renderAuth()}
        {activeSection === 'preScript' && (
          <div className="h-full flex">
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                ref={preScriptEditorRef}
                value={request.preScript || ''}
                onChange={(preScript) => handleChange({ preScript })}
                language="javascript"
              />
            </div>
            <ScriptSnippetsPanel type="pre" onInsert={(code) => preScriptEditorRef.current?.insertAtCursor(code)} />
          </div>
        )}
        {activeSection === 'script' && (
          <div className="h-full flex">
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                ref={postScriptEditorRef}
                value={request.script || ''}
                onChange={(script) => handleChange({ script })}
                language="javascript"
              />
            </div>
            <ScriptSnippetsPanel type="post" onInsert={(code) => postScriptEditorRef.current?.insertAtCursor(code)} />
          </div>
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

// ─── Script Snippets Panel ────────────────────────────────────────────────────

interface Snippet {
  label: string;
  description: string;
  code: string;
}

const PRE_SCRIPT_SNIPPETS: Snippet[] = [
  {
    label: 'Set Env Variable',
    description: 'Set a value in the active environment',
    code: "fetchy.environment.set('key', 'value');",
  },
  {
    label: 'Get Env Variable',
    description: 'Read a value from the active environment',
    code: "const value = fetchy.environment.get('key');",
  },
  {
    label: 'Get All Variables',
    description: 'Get an array of all environment variables',
    code: "const vars = fetchy.environment.all();\nconsole.log(vars);",
  },
  {
    label: 'Log Output',
    description: 'Print a message to the Console tab',
    code: "console.log('message');",
  },
  {
    label: 'Random UUID',
    description: 'Generate a UUID and store it as an env variable',
    code: "const uuid = crypto.randomUUID();\nfetchy.environment.set('uuid', uuid);\nconsole.log('UUID:', uuid);",
  },
  {
    label: 'Unix Timestamp',
    description: 'Store the current Unix timestamp as an env variable',
    code: "const ts = String(Date.now());\nfetchy.environment.set('timestamp', ts);\nconsole.log('Timestamp:', ts);",
  },
  {
    label: 'Random Number',
    description: 'Generate a random integer in a range',
    code: "const rand = String(Math.floor(Math.random() * 1000));\nfetchy.environment.set('randomNum', rand);",
  },
  {
    label: 'Dynamic Auth Token',
    description: 'Use an existing env var as bearer in a header',
    code: "// Make sure 'token' is set in your environment\n// fetchy.environment.set('token', '<your-token-here>');",
  },
];

const POST_SCRIPT_SNIPPETS: Snippet[] = [
  {
    label: 'Log Response',
    description: 'Print the full response body to the Console tab',
    code: "console.log(fetchy.response.data);",
  },
  {
    label: 'Get Response Status',
    description: 'Read the HTTP status code',
    code: "const status = fetchy.response.status;\nconsole.log('Status:', status);",
  },
  {
    label: 'Get Response Header',
    description: 'Read a specific response header',
    code: "const ct = fetchy.response.headers['content-type'];\nconsole.log('Content-Type:', ct);",
  },
  {
    label: 'Extract & Store Field',
    description: 'Pull a field from the JSON response and save it as an env variable',
    code: "const value = fetchy.response.data.field;\nfetchy.environment.set('key', value);",
  },
  {
    label: 'Store Token',
    description: 'Save an access token from the response body',
    code: "const token = fetchy.response.data.access_token\n  || fetchy.response.data.token;\nif (token) {\n  fetchy.environment.set('token', token);\n  console.log('Token saved.');\n}",
  },
  {
    label: 'Check Status 200',
    description: 'Log a message only when the request succeeds',
    code: "if (fetchy.response.status === 200) {\n  console.log('Request succeeded!');\n} else {\n  console.log('Unexpected status:', fetchy.response.status);\n}",
  },
  {
    label: 'Set Env Variable',
    description: 'Set a value in the active environment',
    code: "fetchy.environment.set('key', 'value');",
  },
  {
    label: 'Get Env Variable',
    description: 'Read a value from the active environment',
    code: "const value = fetchy.environment.get('key');",
  },
  {
    label: 'Log All Env Vars',
    description: 'Print every environment variable to the Console',
    code: "const vars = fetchy.environment.all();\nconsole.log(vars);",
  },
];

interface ScriptSnippetsPanelProps {
  type: 'pre' | 'post';
  onInsert: (code: string) => void;
}

function ScriptSnippetsPanel({ type, onInsert }: ScriptSnippetsPanelProps) {
  const snippets = type === 'pre' ? PRE_SCRIPT_SNIPPETS : POST_SCRIPT_SNIPPETS;
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`h-full border-l border-fetchy-border bg-fetchy-card flex flex-col transition-all duration-200 ${
        expanded ? 'w-56' : 'w-8'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-fetchy-border shrink-0">
        {expanded && (
          <span className="text-xs font-semibold text-fetchy-text-muted uppercase tracking-wide truncate">
            Snippets
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-0.5 rounded hover:bg-fetchy-border text-fetchy-text-muted hover:text-fetchy-text transition-colors"
          title={expanded ? 'Collapse snippets' : 'Expand snippets'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`transition-transform ${expanded ? '' : 'rotate-180'}`}
          >
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Snippet list */}
      {expanded && (
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {snippets.map((snippet) => (
            <button
              key={snippet.label}
              onClick={() => onInsert(snippet.code)}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-fetchy-border transition-colors group"
              title={snippet.description}
            >
              <span className="block font-medium text-fetchy-accent group-hover:text-fetchy-accent truncate">
                {snippet.label}
              </span>
              <span className="block text-fetchy-text-muted truncate mt-0.5 text-[10px]">
                {snippet.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
