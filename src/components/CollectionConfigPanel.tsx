import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { KeyValue, RequestAuth } from '../types';
import { v4 as uuidv4 } from 'uuid';
import CodeEditor, { CodeEditorHandle } from './CodeEditor';
import VariableInput from './VariableInput';
import Tooltip from './Tooltip';

interface CollectionConfigPanelProps {
  collectionId: string;
}

type ActiveSection = 'variables' | 'auth' | 'preScript' | 'script';

export default function CollectionConfigPanel({ collectionId }: CollectionConfigPanelProps) {
  const { collections, updateCollection } = useAppStore();
  const collection = collections.find(c => c.id === collectionId);

  const [activeSection, setActiveSection] = useState<ActiveSection>('variables');
  const [localVariables, setLocalVariables] = useState<KeyValue[]>([]);
  const [localAuth, setLocalAuth] = useState<RequestAuth>({ type: 'none' });
  const [localPreScript, setLocalPreScript] = useState('');
  const [localScript, setLocalScript] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [localDescription, setLocalDescription] = useState('');

  const preScriptEditorRef = useRef<CodeEditorHandle>(null);
  const postScriptEditorRef = useRef<CodeEditorHandle>(null);

  // Load collection data when collectionId changes
  useEffect(() => {
    if (collection) {
      setLocalVariables(collection.variables ? [...collection.variables] : []);
      setLocalAuth(collection.auth || { type: 'none' });
      setLocalPreScript(collection.preScript || '');
      setLocalScript(collection.script || '');
      setLocalDescription(collection.description || '');
      setIsModified(false);
    }
  }, [collectionId, collections]);

  const markModified = useCallback(() => {
    setIsModified(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!collection || !isModified) return;
    updateCollection(collectionId, {
      variables: localVariables,
      auth: localAuth,
      preScript: localPreScript,
      script: localScript,
      description: localDescription,
    });
    setIsModified(false);
  }, [collection, collectionId, isModified, localVariables, localAuth, localPreScript, localScript, localDescription, updateCollection]);

  // Save keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!collection) {
    return (
      <div className="h-full flex items-center justify-center text-fetchy-text-muted">
        <p>Collection not found</p>
      </div>
    );
  }

  // ── Variables Section ──────────────────────────────────────────────────
  const addVariable = () => {
    const newVar: KeyValue = {
      id: uuidv4(),
      key: '',
      value: '',
      initialValue: '',
      currentValue: '',
      enabled: true,
      isSecret: false,
    };
    setLocalVariables([...localVariables, newVar]);
    markModified();
  };

  const updateVariable = (id: string, updates: Partial<KeyValue>) => {
    setLocalVariables(localVariables.map(v =>
      v.id === id ? { ...v, ...updates } : v
    ));
    markModified();
  };

  const removeVariable = (id: string) => {
    setLocalVariables(localVariables.filter(v => v.id !== id));
    markModified();
  };

  const renderVariables = () => (
    <div className="h-full flex flex-col">
      {/* Description */}
      <div className="p-3 border-b border-fetchy-border">
        <label className="block text-xs text-fetchy-text-muted mb-1 font-medium">Collection Description</label>
        <textarea
          value={localDescription}
          onChange={(e) => { setLocalDescription(e.target.value); markModified(); }}
          placeholder="Add a description for this collection..."
          className="w-full text-sm bg-fetchy-input border border-fetchy-border rounded px-3 py-2 resize-none h-16 focus:outline-none focus:border-fetchy-accent"
        />
      </div>

      {/* Variables header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-fetchy-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fetchy-text">Variables</span>
          <span className="text-xs text-fetchy-text-muted">
            ({localVariables.filter(v => v.enabled).length} active)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fetchy-text-muted italic">
            Collection variables override environment variables
          </span>
          <Tooltip content="Add Variable">
            <button onClick={addVariable} className="p-1 hover:bg-fetchy-border rounded text-fetchy-accent">
              <Plus size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Variables table */}
      <div className="flex-1 overflow-auto">
        {localVariables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-fetchy-text-muted">
            <p className="text-sm">No variables defined</p>
            <p className="text-xs mt-1">Variables can be referenced using <code className="bg-fetchy-border px-1 rounded">{'<<variableName>>'}</code></p>
            <button
              onClick={addVariable}
              className="mt-3 px-3 py-1.5 text-sm bg-fetchy-accent text-white rounded hover:bg-fetchy-accent-hover"
            >
              Add Variable
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-fetchy-card z-10">
              <tr className="border-b border-fetchy-border">
                <th className="w-8 px-2 py-2"></th>
                <th className="text-left px-2 py-2 text-fetchy-text-muted font-medium text-xs">KEY</th>
                <th className="text-left px-2 py-2 text-fetchy-text-muted font-medium text-xs">INITIAL VALUE</th>
                <th className="text-left px-2 py-2 text-fetchy-text-muted font-medium text-xs">CURRENT VALUE</th>
                <th className="w-8 px-2 py-2"></th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {localVariables.map((variable) => (
                <tr key={variable.id} className="border-b border-fetchy-border/50 hover:bg-fetchy-hover group">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={variable.enabled}
                      onChange={(e) => updateVariable(variable.id, { enabled: e.target.checked })}
                      className="rounded border-fetchy-border"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={variable.key}
                      onChange={(e) => updateVariable(variable.id, { key: e.target.value })}
                      placeholder="Variable name"
                      className="w-full bg-transparent text-sm outline-none text-fetchy-text placeholder:text-fetchy-text-muted/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={variable.initialValue || ''}
                      onChange={(e) => updateVariable(variable.id, { initialValue: e.target.value })}
                      placeholder="Initial value"
                      type={variable.isSecret ? 'password' : 'text'}
                      className="w-full bg-transparent text-sm outline-none text-fetchy-text placeholder:text-fetchy-text-muted/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={variable.currentValue || variable.value || ''}
                      onChange={(e) => updateVariable(variable.id, { currentValue: e.target.value, value: e.target.value })}
                      placeholder="Current value"
                      type={variable.isSecret ? 'password' : 'text'}
                      className="w-full bg-transparent text-sm outline-none text-fetchy-text placeholder:text-fetchy-text-muted/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Tooltip content={variable.isSecret ? 'Show value' : 'Hide value (secret)'}>
                      <button
                        onClick={() => updateVariable(variable.id, { isSecret: !variable.isSecret })}
                        className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted opacity-0 group-hover:opacity-100"
                      >
                        {variable.isSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => removeVariable(variable.id)}
                      className="p-1 hover:bg-fetchy-border rounded text-red-400 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Auth Section ───────────────────────────────────────────────────────
  const authTypes = [
    { value: 'none', label: 'No Auth' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'api-key', label: 'API Key' },
  ];

  const handleAuthChange = (updates: Partial<RequestAuth>) => {
    const newAuth = { ...localAuth, ...updates };
    setLocalAuth(newAuth as RequestAuth);
    markModified();
  };

  const renderAuth = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-fetchy-border">
        {authTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => handleAuthChange({ type: type.value as RequestAuth['type'] })}
            className={`px-3 py-1 text-sm rounded ${
              localAuth.type === type.value
                ? 'bg-fetchy-accent text-white'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {localAuth.type === 'none' && (
          <div className="text-fetchy-text-muted text-center py-8">
            <p>No authentication configured for this collection</p>
            <p className="text-xs mt-2">Requests using "Inherit" auth will use the auth configured here</p>
          </div>
        )}

        {localAuth.type === 'basic' && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Username</label>
              <VariableInput
                value={localAuth.basic?.username || ''}
                onChange={(value) => handleAuthChange({
                  basic: { username: value, password: localAuth.basic?.password || '' }
                })}
                className="w-full"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Password</label>
              <VariableInput
                value={localAuth.basic?.password || ''}
                onChange={(value) => handleAuthChange({
                  basic: { username: localAuth.basic?.username || '', password: value }
                })}
                className="w-full"
                placeholder="Enter password"
              />
            </div>
          </div>
        )}

        {localAuth.type === 'bearer' && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Token</label>
              <VariableInput
                value={localAuth.bearer?.token || ''}
                onChange={(value) => handleAuthChange({
                  bearer: { token: value }
                })}
                className="w-full"
                placeholder="Enter bearer token"
              />
            </div>
          </div>
        )}

        {localAuth.type === 'api-key' && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Key</label>
              <VariableInput
                value={localAuth.apiKey?.key || ''}
                onChange={(value) => handleAuthChange({
                  apiKey: { key: value, value: localAuth.apiKey?.value || '', addTo: localAuth.apiKey?.addTo || 'header' }
                })}
                className="w-full"
                placeholder="e.g., X-API-Key"
              />
            </div>
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Value</label>
              <VariableInput
                value={localAuth.apiKey?.value || ''}
                onChange={(value) => handleAuthChange({
                  apiKey: { key: localAuth.apiKey?.key || '', value: value, addTo: localAuth.apiKey?.addTo || 'header' }
                })}
                className="w-full"
                placeholder="Enter API key value"
              />
            </div>
            <div>
              <label className="block text-sm text-fetchy-text-muted mb-1">Add to</label>
              <select
                value={localAuth.apiKey?.addTo || 'header'}
                onChange={(e) => handleAuthChange({
                  apiKey: { key: localAuth.apiKey?.key || '', value: localAuth.apiKey?.value || '', addTo: e.target.value as 'header' | 'query' }
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

  return (
    <div className="h-full flex flex-col bg-fetchy-bg">
      {/* Collection header */}
      <div className="px-4 py-3 border-b border-fetchy-border flex items-center justify-between bg-fetchy-bg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-fetchy-accent/20 flex items-center justify-center">
            <span className="text-fetchy-accent font-bold text-sm">
              {collection.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-fetchy-text">{collection.name}</h2>
            <p className="text-xs text-fetchy-text-muted">
              {collection.requests.length} requests · {collection.folders.length} folders
            </p>
          </div>
        </div>
        {isModified && (
          <span className="text-xs text-yellow-500 font-medium">Unsaved changes</span>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex items-center border-b border-fetchy-border shrink-0">
        <div className="flex flex-1">
          {([
            { id: 'variables' as const, label: 'Variables', count: localVariables.filter(v => v.enabled).length },
            { id: 'auth' as const, label: 'Auth', badge: localAuth.type !== 'none' ? localAuth.type : undefined },
            { id: 'preScript' as const, label: 'Pre-Script', hasDot: !!localPreScript },
            { id: 'script' as const, label: 'Post-Script', hasDot: !!localScript },
          ]).map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
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
              {section.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  {section.badge}
                </span>
              )}
              {section.hasDot && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-fetchy-accent"></span>
              )}
            </button>
          ))}
        </div>
        <Tooltip content="Save Collection Settings (Ctrl+S)">
          <button
            onClick={handleSave}
            disabled={!isModified}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
              isModified
                ? 'text-fetchy-accent hover:bg-fetchy-accent/10'
                : 'text-fetchy-text-muted opacity-40 cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            Save
          </button>
        </Tooltip>
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'variables' && renderVariables()}
        {activeSection === 'auth' && renderAuth()}
        {activeSection === 'preScript' && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b border-fetchy-border">
              <p className="text-xs text-fetchy-text-muted">
                This script runs <strong>before every request</strong> in this collection, before individual request pre-scripts.
              </p>
            </div>
            <div className="flex-1 flex">
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  ref={preScriptEditorRef}
                  value={localPreScript}
                  onChange={(val) => { setLocalPreScript(val); markModified(); }}
                  language="javascript"
                />
              </div>
              <SnippetsPanel type="pre" onInsert={(code) => preScriptEditorRef.current?.insertAtCursor(code)} />
            </div>
          </div>
        )}
        {activeSection === 'script' && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b border-fetchy-border">
              <p className="text-xs text-fetchy-text-muted">
                This script runs <strong>after every request</strong> in this collection, after individual request post-scripts. Use it for common assertions or extracting shared data.
              </p>
            </div>
            <div className="flex-1 flex">
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  ref={postScriptEditorRef}
                  value={localScript}
                  onChange={(val) => { setLocalScript(val); markModified(); }}
                  language="javascript"
                />
              </div>
              <SnippetsPanel type="post" onInsert={(code) => postScriptEditorRef.current?.insertAtCursor(code)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Snippets Panel Component ────────────────────────────────────────────

const PRE_SCRIPT_SNIPPETS = [
  { label: 'Log message', description: 'Print a log message', code: 'console.log("Hello from collection pre-script");' },
  { label: 'Set env variable', description: 'Set an environment variable', code: 'fetchy.environment.set("key", "value");' },
  { label: 'Get env variable', description: 'Get an environment variable', code: 'const val = fetchy.environment.get("key");\nconsole.log(val);' },
  { label: 'Timestamp', description: 'Set current timestamp', code: 'fetchy.environment.set("timestamp", Date.now().toString());' },
  { label: 'Random ID', description: 'Generate random ID', code: 'fetchy.environment.set("randomId", Math.random().toString(36).substr(2, 9));' },
];

const POST_SCRIPT_SNIPPETS = [
  { label: 'Log response status', description: 'Log the response status', code: 'console.log("Status:", fetchy.response.status);' },
  { label: 'Log response body', description: 'Log the response body', code: 'console.log("Response:", JSON.stringify(fetchy.response.data, null, 2));' },
  { label: 'Check status 200', description: 'Assert status is 200', code: 'if (fetchy.response.status !== 200) {\n  console.log("FAIL: Expected 200, got " + fetchy.response.status);\n} else {\n  console.log("PASS: Status is 200");\n}' },
  { label: 'Extract & store', description: 'Extract value from response', code: 'const data = fetchy.response.data;\nfetchy.environment.set("extractedValue", data.someField);' },
  { label: 'Response time check', description: 'Check response time', code: 'console.log("Response completed");' },
];

function SnippetsPanel({ type, onInsert }: { type: 'pre' | 'post'; onInsert: (code: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const snippets = type === 'pre' ? PRE_SCRIPT_SNIPPETS : POST_SCRIPT_SNIPPETS;

  return (
    <div
      className={`h-full border-l border-fetchy-border bg-fetchy-card flex flex-col transition-all duration-200 ${
        expanded ? 'w-56' : 'w-8'
      }`}
    >
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
