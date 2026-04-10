import React, { useState, useRef } from 'react';
import { X, Layers, Bot, Eye, EyeOff, Check, Loader2, AlertCircle, ShieldAlert, Info, Link2, Plus, Trash2, Search } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { useAppStore } from '../store/appStore';
import { useWorkspacesStore } from '../store/workspacesStore';
import { PROVIDER_META, sendAIRequest } from '../utils/aiProvider';
import type { AIProvider, AISettings, JiraFieldMapping } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspaces: () => void;
  initialTab?: 'general' | 'ai' | 'integrations';
}

export default function SettingsModal({ isOpen, onClose, onOpenWorkspaces, initialTab }: SettingsModalProps) {
  const { preferences, savePreferences, aiSettings: ai, updateAISettings, jiraSettings, jiraPat, updateJiraSettings, updateJiraPat } = usePreferencesStore();
  const { panelLayout, setPanelLayout } = useAppStore();
  const { workspaces, activeWorkspaceId } = useWorkspacesStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'integrations'>(initialTab ?? 'general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showJiraPat, setShowJiraPat] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [jiraTestStatus, setJiraTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [jiraTestMessage, setJiraTestMessage] = useState('');
  const [fieldMeta, setFieldMeta] = useState<Record<string, { name: string; required: boolean; type: string; custom: string | null; allowedValues: Array<{ id: string; name?: string; value?: string }> | null }> | null>(null);
  const [fieldMetaLoading, setFieldMetaLoading] = useState(false);
  const [fieldMetaError, setFieldMetaError] = useState('');
  const [insightSearch, setInsightSearch] = useState<{ mappingId: string; query: string; loading: boolean; results: Array<{ displayName: string; value: string }>; error: string } | null>(null);
  const insightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const providerMeta = PROVIDER_META[ai.provider];

  const updateAI = (updates: Partial<AISettings>) => {
    updateAISettings(updates);
  };

  const handleProviderChange = (provider: AIProvider) => {
    const meta = PROVIDER_META[provider];
    updateAI({
      provider,
      model: meta.defaultModel,
      baseUrl: provider === 'ollama' ? 'http://localhost:11434' : '',
      apiKey: provider === ai.provider ? ai.apiKey : '',
    });
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    setTestMessage('');
    const result = await sendAIRequest(
      { ...ai, enabled: true },
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Connection successful!" and nothing else.' },
      ]
    );
    if (result.success) {
      setTestStatus('success');
      setTestMessage(result.content.slice(0, 100));
    } else {
      setTestStatus('error');
      setTestMessage(result.error || 'Unknown error');
    }
    setTimeout(() => setTestStatus('idle'), 5000);
  };

  const handleJiraTestConnection = async () => {
    setJiraTestStatus('loading');
    setJiraTestMessage('');
    try {
      if (window.electronAPI?.jiraTestConnection) {
        const result = await window.electronAPI.jiraTestConnection({ baseUrl: jiraSettings.baseUrl, pat: jiraPat });
        if (result.success) {
          setJiraTestStatus('success');
          setJiraTestMessage(result.message);
        } else {
          setJiraTestStatus('error');
          setJiraTestMessage(result.message);
        }
      } else {
        setJiraTestStatus('error');
        setJiraTestMessage('Jira integration requires the desktop app');
      }
    } catch (error) {
      setJiraTestStatus('error');
      setJiraTestMessage('Connection failed');
    }
    setTimeout(() => setJiraTestStatus('idle'), 5000);
  };

  const handleAddFieldMapping = () => {
    const newMapping: JiraFieldMapping = {
      id: Date.now().toString(),
      fieldName: '',
      customFieldId: '',
      fieldType: 'text',
      defaultValue: '',
    };
    updateJiraSettings({ fieldMappings: [...jiraSettings.fieldMappings, newMapping] });
  };

  const handleUpdateFieldMapping = (id: string, updates: Partial<JiraFieldMapping>) => {
    updateJiraSettings({
      fieldMappings: jiraSettings.fieldMappings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  };

  const handleRemoveFieldMapping = (id: string) => {
    updateJiraSettings({ fieldMappings: jiraSettings.fieldMappings.filter((m) => m.id !== id) });
  };

  const handleMapRequiredFields = () => {
    if (!fieldMeta) return;
    const existingIds = new Set(jiraSettings.fieldMappings.map((m) => m.customFieldId));
    const newMappings: JiraFieldMapping[] = [];

    for (const [id, meta] of Object.entries(fieldMeta)) {
      if (!id.startsWith('customfield_') || !meta.required || existingIds.has(id)) continue;
      // Auto-detect field type from Jira schema type
      let fieldType: 'text' | 'option' | 'array' | 'insight' | 'raw' = 'text';
      if (meta.type === 'option') fieldType = 'option';
      else if (meta.type === 'array') fieldType = 'array';
      else if (meta.type === 'any') fieldType = 'insight';
      else if (meta.allowedValues && meta.allowedValues.length > 0) fieldType = 'option';

      newMappings.push({
        id: `${Date.now()}-${id}`,
        fieldName: meta.name,
        customFieldId: id,
        fieldType,
        defaultValue: '',
      });
    }

    if (newMappings.length > 0) {
      updateJiraSettings({ fieldMappings: [...jiraSettings.fieldMappings, ...newMappings] });
    }
  };

  const handleAddFieldFromMeta = (id: string, meta: { name: string; type: string; allowedValues: Array<{ id: string; name?: string; value?: string }> | null }) => {
    const existingIds = new Set(jiraSettings.fieldMappings.map((m) => m.customFieldId));
    if (existingIds.has(id)) return;
    let fieldType: 'text' | 'option' | 'array' | 'insight' | 'raw' = 'text';
    if (meta.type === 'option') fieldType = 'option';
    else if (meta.type === 'array') fieldType = 'array';
    else if (meta.type === 'any') fieldType = 'insight';
    else if (meta.allowedValues && meta.allowedValues.length > 0) fieldType = 'option';
    updateJiraSettings({
      fieldMappings: [...jiraSettings.fieldMappings, {
        id: `${Date.now()}-${id}`,
        fieldName: meta.name,
        customFieldId: id,
        fieldType,
        defaultValue: '',
      }],
    });
  };

  const handleFetchFieldMeta = async () => {
    if (!window.electronAPI?.jiraGetCreateMeta || !jiraSettings.baseUrl || !jiraSettings.projectKey) return;
    setFieldMetaLoading(true);
    setFieldMetaError('');
    setFieldMeta(null);
    try {
      const result = await window.electronAPI.jiraGetCreateMeta({
        baseUrl: jiraSettings.baseUrl,
        projectKey: jiraSettings.projectKey,
        issueType: jiraSettings.issueType || 'Bug',
      });
      if (result.success && result.fields) {
        setFieldMeta(result.fields);
      } else {
        setFieldMetaError(result.error || 'Failed to fetch field metadata');
      }
    } catch {
      setFieldMetaError('Failed to fetch field metadata');
    } finally {
      setFieldMetaLoading(false);
    }
  };

  const handleSearchInsight = async (mappingId: string, customFieldId: string, query: string) => {
    if (!window.electronAPI?.jiraSearchInsightObjects || !jiraSettings.baseUrl || !customFieldId) return;
    const trimmed = query.trim();
    setInsightSearch((prev) => prev ? { ...prev, mappingId, query, loading: true, error: '' } : { mappingId, query, loading: true, results: [], error: '' });
    try {
      const result = await window.electronAPI.jiraSearchInsightObjects({
        baseUrl: jiraSettings.baseUrl,
        customFieldId,
        query: trimmed,
      });
      if (result.success) {
        const cleaned = (result.objects || []).map((o) => {
          const cleanDisplay = o.displayName.replace(/<\/?b>/gi, '');
          const cleanValue = o.value.replace(/<\/?b>/gi, '');
          // Extract the Insight key from values like "DSA (GCE-38216)" → "GCE-38216"
          // Try multiple patterns: "(KEY)" at end, or standalone "KEY-123" pattern
          const keyMatch = cleanValue.match(/\(([A-Z]+-\d+)\)/) || cleanDisplay.match(/\(([A-Z]+-\d+)\)/);
          const insightKey = keyMatch ? keyMatch[1] : cleanValue;
          return { displayName: cleanDisplay, value: insightKey };
        });
        setInsightSearch((prev) => prev ? { ...prev, loading: false, results: cleaned } : null);
      } else {
        setInsightSearch((prev) => prev ? { ...prev, loading: false, error: result.error || 'Search failed' } : null);
      }
    } catch {
      setInsightSearch((prev) => prev ? { ...prev, loading: false, error: 'Search failed' } : null);
    }
  };

  const handleSelectInsightObject = (mappingId: string, objectKey: string) => {
    const mapping = jiraSettings.fieldMappings.find((m) => m.id === mappingId);
    if (!mapping) return;
    // Extract key from "Name (KEY-123)" format if not already extracted
    const keyMatch = objectKey.match(/\(([A-Z]+-\d+)\)/);
    const cleanKey = keyMatch ? keyMatch[1] : objectKey;
    const current = mapping.defaultValue;
    const keys = current ? current.split(',').map((k) => k.trim()).filter(Boolean) : [];
    if (!keys.includes(cleanKey)) {
      keys.push(cleanKey);
    }
    handleUpdateFieldMapping(mappingId, { defaultValue: keys.join(', ') });
  };

  if (!isOpen) return null;
  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-fetchy-modal rounded-lg shadow-xl w-[620px] max-h-[80vh] overflow-hidden border border-fetchy-border'>
        <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
          <h2 className='text-lg font-semibold text-white'>Settings</h2>
          <button onClick={onClose} className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'><X size={18} /></button>
        </div>
        {/* Tabs */}
        <div className='flex border-b border-[#2d2d44]'>
          <button onClick={() => setActiveTab('general')} className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'general' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}>General</button>
          <button onClick={() => setActiveTab('ai')} className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'ai' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}><Bot size={14} />AI Assistant</button>
          <button onClick={() => setActiveTab('integrations')} className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'integrations' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}><Link2 size={14} />Integrations</button>
        </div>
        <div className='p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-160px)]'>
          {activeTab === 'general' ? (
            <>
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-white uppercase tracking-wider'>Workspace</h3>
            <div className='flex items-center justify-between p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
              <div className='flex items-center gap-2 min-w-0'>
                <Layers size={16} className='text-purple-400 shrink-0' />
                <div className='min-w-0'>
                  <p className='text-sm text-white truncate'>{activeWorkspace ? activeWorkspace.name : 'Default (no workspace)'}</p>
                  {activeWorkspace && (<p className='text-xs text-gray-500 font-mono truncate'>{activeWorkspace.homeDirectory}</p>)}
                </div>
              </div>
              <button onClick={() => { onClose(); onOpenWorkspaces(); }} className='shrink-0 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors ml-3'>
                Manage Workspaces
              </button>
            </div>
            <p className='text-xs text-gray-500'>Workspaces control where your collections, environments and secret variables are stored. Use <strong className='text-gray-400'>Manage Workspaces</strong> to switch, add, remove, export or import workspaces.</p>
          </div>
          <div className='border-t border-[#2d2d44]' />
          <div className='space-y-4'>
            <h3 className='text-sm font-medium text-white uppercase tracking-wider'>General Settings</h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Max History Items</label><p className='text-xs text-gray-500'>Number of request history items to keep</p></div>
                <input type='number' min={10} max={500} value={preferences.maxHistoryItems} onChange={(e) => savePreferences({ maxHistoryItems: parseInt(e.target.value) || 100 })} className='w-20 px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500' />
              </div>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Panel Layout</label><p className='text-xs text-gray-500'>Position of response panel relative to request</p></div>
                <select value={panelLayout} onChange={(e) => setPanelLayout(e.target.value as 'horizontal' | 'vertical')} className='px-3 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'>
                  <option value='horizontal'>Right</option>
                  <option value='vertical'>Down</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── Proxy Settings (#25) ─── */}
          <div className='border-t border-[#2d2d44]' />
          <div className='space-y-4'>
            <h3 className='text-sm font-medium text-white uppercase tracking-wider'>Proxy Settings</h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Proxy Mode</label><p className='text-xs text-gray-500'>How HTTP requests should connect to the internet</p></div>
                <select
                  value={preferences.proxy?.mode ?? 'system'}
                  onChange={(e) => savePreferences({ proxy: { ...preferences.proxy || { mode: 'system', url: '' }, mode: e.target.value as 'none' | 'system' | 'manual' } })}
                  className='px-3 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                >
                  <option value='none'>No Proxy</option>
                  <option value='system'>System / Environment</option>
                  <option value='manual'>Manual</option>
                </select>
              </div>
              {preferences.proxy?.mode === 'manual' && (
                <>
                  <div>
                    <label className='text-xs text-gray-400 mb-1 block'>Proxy URL</label>
                    <input
                      type='text'
                      value={preferences.proxy?.url ?? ''}
                      onChange={(e) => savePreferences({ proxy: { ...preferences.proxy || { mode: 'manual', url: '' }, url: e.target.value } })}
                      placeholder='http://proxy.example.com:8080'
                      className='w-full px-3 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className='text-xs text-gray-400 mb-1 block'>Username (optional)</label>
                      <input
                        type='text'
                        value={preferences.proxy?.username ?? ''}
                        onChange={(e) => savePreferences({ proxy: { ...preferences.proxy || { mode: 'manual', url: '' }, username: e.target.value || undefined } })}
                        placeholder='proxy-user'
                        className='w-full px-3 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                      />
                    </div>
                    <div>
                      <label className='text-xs text-gray-400 mb-1 block'>Password (optional)</label>
                      <input
                        type='password'
                        value={preferences.proxy?.password ?? ''}
                        onChange={(e) => savePreferences({ proxy: { ...preferences.proxy || { mode: 'manual', url: '' }, password: e.target.value || undefined } })}
                        placeholder='••••••••'
                        className='w-full px-3 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                      />
                    </div>
                  </div>
                </>
              )}
              {preferences.proxy?.mode === 'system' && (
                <p className='text-xs text-gray-500'>
                  Uses <code className='text-gray-400'>HTTP_PROXY</code> / <code className='text-gray-400'>HTTPS_PROXY</code> environment variables when set.
                </p>
              )}
            </div>
          </div>
            </>
          ) : activeTab === 'ai' ? (
            /* ─── AI Settings Tab ─── */
            <div className='space-y-5'>
              {/* Enable toggle */}
              <div className='flex items-center justify-between'>
                <div>
                  <label className='text-sm text-gray-300 font-medium'>Enable AI Assistant</label>
                  <p className='text-xs text-gray-500'>Use AI to generate requests, scripts, docs and more</p>
                </div>
                <input type='checkbox' checked={ai.enabled} onChange={(e) => updateAI({ enabled: e.target.checked })} className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500' />
              </div>

              <div className='border-t border-[#2d2d44]' />

              {/* Provider selection */}
              <div className='space-y-2'>
                <label className='text-sm text-gray-300 font-medium'>AI Provider</label>
                <div className='grid grid-cols-1 gap-2'>
                  {(Object.keys(PROVIDER_META) as AIProvider[]).map((key) => {
                    const meta = PROVIDER_META[key];
                    return (
                      <button
                        key={key}
                        onClick={() => handleProviderChange(key)}
                        className={`flex items-start gap-3 p-3 rounded border text-left transition-colors ${ai.provider === key ? 'border-purple-500 bg-purple-500/10' : 'border-[#2d2d44] bg-[#0f0f1a] hover:border-[#3d3d54]'}`}
                      >
                        <div className='flex-1 min-w-0'>
                          <p className={`text-sm font-medium ${ai.provider === key ? 'text-purple-300' : 'text-white'}`}>{meta.label}</p>
                          <p className='text-xs text-gray-500'>{meta.description}</p>
                        </div>
                        {ai.provider === key && <Check size={16} className='text-purple-400 mt-0.5 shrink-0' />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API Key */}
              {providerMeta.requiresApiKey && (
                <div className='space-y-1.5'>
                  <label className='text-sm text-gray-300 font-medium'>API Key</label>
                  <div className='relative'>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={ai.apiKey}
                      onChange={(e) => updateAI({ apiKey: e.target.value })}
                      placeholder={`Enter your ${providerMeta.label} API key`}
                      className='w-full px-3 py-2 pr-10 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                    />
                    <button onClick={() => setShowApiKey(!showApiKey)} className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300'>
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className='text-xs text-gray-500'>
                    {ai.persistToFile
                      ? 'Your API key is stored in the workspace secrets folder.'
                      : 'Your API key is kept in memory only and will be lost when the app restarts.'}
                  </p>
                </div>
              )}

              {/* Persist to secrets file toggle */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div>
                    <label className='text-sm text-gray-300 font-medium'>Store in secrets file</label>
                    <p className='text-xs text-gray-500'>Persist AI settings so they survive app restarts</p>
                  </div>
                  <div className='relative group'>
                    <ShieldAlert size={14} className='text-yellow-500 cursor-help' />
                    <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-[#1a1a2e] border border-yellow-500/30 rounded text-xs text-yellow-300 shadow-lg z-50'>
                      <p className='font-semibold flex items-center gap-1'><Info size={12} /> Security Notice</p>
                      <p className='mt-1'>When enabled, your API keys and AI configuration are stored in the workspace's <strong className='text-yellow-200'>secrets folder</strong> ({activeWorkspace ? `${activeWorkspace.name}/.secrets/` : '.secrets/'}).</p>
                      <p className='mt-1'>Make sure this folder is secured, never shared publicly, and is included in your <strong className='text-yellow-200'>.gitignore</strong> to prevent accidental commits.</p>
                      <p className='mt-1'>When disabled, settings are kept in memory only and will be cleared on app restart.</p>
                    </div>
                  </div>
                </div>
                <input type='checkbox' checked={ai.persistToFile ?? false} onChange={(e) => updateAI({ persistToFile: e.target.checked })} className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500' />
              </div>

              {ai.persistToFile && (
                <div className='p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-300 text-xs flex items-start gap-2'>
                  <ShieldAlert size={14} className='shrink-0 mt-0.5' />
                  <div>
                    <p className='font-medium'>API keys are stored in the secrets folder</p>
                    <p className='mt-0.5 text-yellow-400/80'>Ensure the secrets folder is kept secure, never committed to version control, and not shared with others.</p>
                  </div>
                </div>
              )}

              {/* Base URL */}
              {(providerMeta.requiresBaseUrl || ai.provider === 'ollama') && (
                <div className='space-y-1.5'>
                  <label className='text-sm text-gray-300 font-medium'>Base URL</label>
                  <input
                    type='text'
                    value={ai.baseUrl}
                    onChange={(e) => updateAI({ baseUrl: e.target.value })}
                    placeholder={providerMeta.baseUrlPlaceholder || 'https://api.example.com'}
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                  />
                </div>
              )}

              {/* Model selection */}
              <div className='space-y-1.5'>
                <label className='text-sm text-gray-300 font-medium'>Model</label>
                {providerMeta.models.length > 0 ? (
                  <select
                    value={ai.model || providerMeta.defaultModel}
                    onChange={(e) => updateAI({ model: e.target.value })}
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                  >
                    {providerMeta.models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type='text'
                    value={ai.model}
                    onChange={(e) => updateAI({ model: e.target.value })}
                    placeholder='Enter model name'
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                  />
                )}
              </div>

              {/* Advanced settings */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <label className='text-sm text-gray-300'>Temperature</label>
                    <p className='text-xs text-gray-500'>Higher = more creative, Lower = more precise</p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      type='range'
                      min={0}
                      max={1}
                      step={0.1}
                      value={ai.temperature}
                      onChange={(e) => updateAI({ temperature: parseFloat(e.target.value) })}
                      className='w-24 accent-purple-500'
                    />
                    <span className='text-sm text-gray-400 w-8 text-right'>{ai.temperature}</span>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <div>
                    <label className='text-sm text-gray-300'>Max Tokens</label>
                    <p className='text-xs text-gray-500'>Maximum length of AI responses</p>
                  </div>
                  <input
                    type='number'
                    min={256}
                    max={16384}
                    step={256}
                    value={ai.maxTokens}
                    onChange={(e) => updateAI({ maxTokens: parseInt(e.target.value) || 2048 })}
                    className='w-24 px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                  />
                </div>
              </div>

              {/* Test connection */}
              <div className='border-t border-[#2d2d44] pt-4'>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'loading' || (!ai.apiKey && providerMeta.requiresApiKey)}
                    className='px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                  >
                    {testStatus === 'loading' ? <Loader2 size={14} className='animate-spin' /> : <Bot size={14} />}
                    Test Connection
                  </button>
                  {testStatus === 'success' && (
                    <div className='flex items-center gap-1.5 text-green-400 text-sm'>
                      <Check size={14} />
                      <span className='truncate max-w-[280px]'>{testMessage}</span>
                    </div>
                  )}
                  {testStatus === 'error' && (
                    <div className='flex items-center gap-1.5 text-red-400 text-sm'>
                      <AlertCircle size={14} />
                      <span className='truncate max-w-[280px]'>{testMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'integrations' ? (
            /* ─── Integrations Tab ─── */
            <div className='space-y-5'>
              {/* Jira Section Header */}
              <div>
                <h3 className='text-sm font-medium text-white uppercase tracking-wider'>Jira Integration</h3>
                <p className='text-xs text-gray-500 mt-1'>Connect to Jira to create bug reports directly from AI-generated reports</p>
              </div>

              {/* Enable toggle */}
              <div className='flex items-center justify-between'>
                <div>
                  <label className='text-sm text-gray-300 font-medium'>Enable Jira Integration</label>
                  <p className='text-xs text-gray-500'>Show "Create Jira Bug" button in bug reports</p>
                </div>
                <input type='checkbox' checked={jiraSettings.enabled} onChange={(e) => updateJiraSettings({ enabled: e.target.checked })} className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500' />
              </div>

              <div className='border-t border-[#2d2d44]' />

              {/* Base URL */}
              <div className='space-y-1.5'>
                <label className='text-sm text-gray-300 font-medium'>Jira Base URL</label>
                <input
                  type='text'
                  value={jiraSettings.baseUrl}
                  onChange={(e) => updateJiraSettings({ baseUrl: e.target.value })}
                  placeholder='https://your-jira-instance.atlassian.net'
                  className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                />
              </div>

              {/* PAT */}
              <div className='space-y-1.5'>
                <label className='text-sm text-gray-300 font-medium'>Personal Access Token (PAT)</label>
                <div className='relative'>
                  <input
                    type={showJiraPat ? 'text' : 'password'}
                    value={jiraPat}
                    onChange={(e) => updateJiraPat(e.target.value)}
                    placeholder='Enter your Jira PAT'
                    className='w-full px-3 py-2 pr-10 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                  />
                  <button onClick={() => setShowJiraPat(!showJiraPat)} className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300'>
                    {showJiraPat ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className='text-xs text-gray-500'>Your PAT is stored encrypted in the workspace secrets folder</p>
              </div>

              {/* Project Key */}
              <div className='space-y-1.5'>
                <label className='text-sm text-gray-300 font-medium'>Project Key</label>
                <input
                  type='text'
                  value={jiraSettings.projectKey}
                  onChange={(e) => updateJiraSettings({ projectKey: e.target.value })}
                  placeholder='e.g. SIGDSAWEB'
                  className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                />
              </div>

              <div className='border-t border-[#2d2d44]' />

              {/* Fetch Field Metadata */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <label className='text-sm text-gray-300 font-medium'>Field Discovery</label>
                    <p className='text-xs text-gray-500'>Fetch all fields and allowed values from Jira</p>
                  </div>
                  <button
                    onClick={handleFetchFieldMeta}
                    disabled={fieldMetaLoading || !jiraSettings.baseUrl || !jiraPat || !jiraSettings.projectKey}
                    className='px-3 py-1.5 text-xs bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {fieldMetaLoading ? <Loader2 size={12} className='animate-spin' /> : <Search size={12} />}
                    Fetch Fields
                  </button>
                </div>
                {fieldMetaError && (
                  <div className='text-red-400 text-xs flex items-center gap-1'>
                    <AlertCircle size={12} />
                    {fieldMetaError}
                  </div>
                )}
                {fieldMeta && (
                  <div className='space-y-3'>
                    <div className='bg-[#0a0a15] border border-[#2d2d44] rounded p-3 max-h-[250px] overflow-auto space-y-2'>
                      <p className='text-[10px] text-gray-500 uppercase tracking-wider mb-2'>
                        Custom fields for {jiraSettings.projectKey} / {jiraSettings.issueType || 'Bug'}
                      </p>
                      {Object.entries(fieldMeta)
                        .filter(([id]) => id.startsWith('customfield_'))
                        .sort(([, a], [, b]) => (a.required === b.required ? 0 : a.required ? -1 : 1))
                        .map(([id, meta]) => (
                          <div key={id} className='text-xs border-b border-[#2d2d44]/50 pb-2 last:border-0'>
                            <div className='flex items-center gap-2'>
                              <button
                                onClick={() => handleAddFieldFromMeta(id, meta)}
                                disabled={jiraSettings.fieldMappings.some((m) => m.customFieldId === id)}
                                className='p-0.5 text-gray-500 hover:text-purple-400 hover:bg-[#2d2d44] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0'
                                title={jiraSettings.fieldMappings.some((m) => m.customFieldId === id) ? 'Already mapped' : `Add ${meta.name} to mappings`}
                              >
                                <Plus size={10} />
                              </button>
                              <code className='text-blue-300 font-mono text-[11px]'>{id}</code>
                              <span className='text-gray-300'>{meta.name}</span>
                              {meta.required && (
                                <span className='text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded'>required</span>
                              )}
                              <span className='text-[9px] text-gray-500 ml-auto'>{meta.type}</span>
                            </div>
                            {meta.allowedValues && meta.allowedValues.length > 0 && (
                              <div className='mt-1 flex flex-wrap gap-1'>
                                {meta.allowedValues.map((v, i) => (
                                  <span key={i} className='text-[10px] px-1.5 py-0.5 bg-[#1a1a2e] text-green-300 rounded border border-[#2d2d44]'>
                                    {v.name || v.value || v.id}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                    <button
                      onClick={handleMapRequiredFields}
                      className='px-3 py-1.5 text-xs bg-purple-600/80 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1.5'
                    >
                      <Plus size={12} /> Map Required Fields
                    </button>
                  </div>
                )}
              </div>

              <div className='border-t border-[#2d2d44]' />

              {/* Custom Field Mappings */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <label className='text-sm text-gray-300 font-medium'>Custom Field Mappings</label>
                    <p className='text-xs text-gray-500'>Map Jira custom fields by their field ID</p>
                  </div>
                  <button
                    onClick={handleAddFieldMapping}
                    className='px-2 py-1 text-xs bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors flex items-center gap-1'
                  >
                    <Plus size={12} /> Add Field
                  </button>
                </div>
                {/* Column headers */}
                <div className='flex items-center gap-2 text-xs text-gray-500 mb-1'>
                  <span className='w-[20%] min-w-0'>Name</span>
                  <span className='w-[33%] min-w-0'>Custom Field ID</span>
                  <span className='w-[15%] min-w-0'>Type</span>
                  <span className='w-[25%] min-w-0'>Default Value</span>
                  <span className='w-7 flex-shrink-0' />
                </div>
                <div className='space-y-2'>
                  {jiraSettings.fieldMappings.map((mapping) => (
                    <React.Fragment key={mapping.id}>
                    <div className='flex items-center gap-2'>
                      <input
                        type='text'
                        value={mapping.fieldName}
                        onChange={(e) => handleUpdateFieldMapping(mapping.id, { fieldName: e.target.value })}
                        placeholder='Field name'
                        className='w-[20%] min-w-0 px-2 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                      />
                      <input
                        type='text'
                        value={mapping.customFieldId}
                        onChange={(e) => handleUpdateFieldMapping(mapping.id, { customFieldId: e.target.value })}
                        placeholder='customfield_12345'
                        className='w-[33%] min-w-0 px-2 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500 font-mono'
                      />
                      <select
                        value={mapping.fieldType || 'text'}
                        onChange={(e) => handleUpdateFieldMapping(mapping.id, { fieldType: e.target.value as 'text' | 'option' | 'array' | 'insight' | 'raw' })}
                        className='w-[15%] min-w-0 px-2 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                      >
                        <option value='text'>Text</option>
                        <option value='option'>Select</option>
                        <option value='array'>Multi</option>
                        <option value='insight'>Insight</option>
                        <option value='raw'>Raw JSON</option>
                      </select>
                      <div className={`${mapping.fieldType === 'insight' ? 'w-[25%]' : 'w-[25%]'} min-w-0 flex items-center gap-1`}>
                        <input
                          type='text'
                          value={mapping.defaultValue}
                          onChange={(e) => handleUpdateFieldMapping(mapping.id, { defaultValue: e.target.value })}
                          placeholder={mapping.fieldType === 'array' ? 'Val1, Val2' : mapping.fieldType === 'insight' ? 'GCE-12345, GCE-67890' : mapping.fieldType === 'raw' ? '[{"key":"VAL"}]' : 'Value'}
                          title={mapping.fieldType === 'array' ? 'Comma-separated values for multi-select fields' : mapping.fieldType === 'insight' ? 'Comma-separated Insight object keys (e.g. GCE-38216)' : mapping.fieldType === 'raw' ? 'Raw JSON value sent as-is to Jira API' : undefined}
                          className='flex-1 min-w-0 px-2 py-1.5 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'
                        />
                        {mapping.fieldType === 'insight' && (
                          <button
                            onClick={() => handleSearchInsight(mapping.id, mapping.customFieldId, '')}
                            className='p-1.5 text-gray-400 hover:text-purple-400 hover:bg-[#2d2d44] rounded transition-colors shrink-0'
                            title='Search Insight objects'
                          >
                            <Search size={14} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveFieldMapping(mapping.id)}
                        className='w-7 flex-shrink-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#2d2d44] rounded transition-colors'
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Insight search results dropdown */}
                    {insightSearch && insightSearch.mappingId === mapping.id && (
                      <div className='ml-[20%] mr-7 mb-2 bg-[#0f0f1a] border border-[#2d2d44] rounded overflow-hidden'>
                        <div className='flex items-center gap-2 p-2 border-b border-[#2d2d44]'>
                          <input
                            type='text'
                            value={insightSearch.query}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInsightSearch((prev) => prev ? { ...prev, query: val } : null);
                              if (insightDebounceRef.current) clearTimeout(insightDebounceRef.current);
                              insightDebounceRef.current = setTimeout(() => {
                                handleSearchInsight(mapping.id, mapping.customFieldId, val);
                              }, 300);
                            }}
                            placeholder='Type to filter...'
                            className='flex-1 px-2 py-1 bg-[#1a1a2e] border border-[#2d2d44] rounded text-white text-xs focus:outline-none focus:border-purple-500'
                            autoFocus
                          />
                          <button
                            onClick={() => setInsightSearch(null)}
                            className='p-1 text-gray-400 hover:text-white rounded'
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {insightSearch.error && (
                          <div className='px-2 py-1 text-xs text-red-400'>{insightSearch.error}</div>
                        )}
                        {insightSearch.results.length > 0 && (
                          <div className='max-h-[150px] overflow-auto'>
                            {insightSearch.results.map((obj, i) => (
                              <button
                                key={`${obj.value}-${i}`}
                                onClick={() => { handleSelectInsightObject(mapping.id, obj.value); }}
                                className='w-full text-left px-3 py-1.5 text-xs hover:bg-[#1a1a2e] transition-colors flex items-center justify-between gap-2'
                              >
                                <span className='text-gray-300 truncate'>{obj.displayName}</span>
                                <span className='text-purple-400 font-mono text-[10px] shrink-0'>{obj.value}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {!insightSearch.loading && insightSearch.results.length === 0 && !insightSearch.error && (
                          <div className='px-3 py-2 text-xs text-gray-500'>No results</div>
                        )}
                      </div>
                    )}
                    </React.Fragment>
                  ))}
                  {jiraSettings.fieldMappings.length === 0 && (
                    <p className='text-xs text-gray-500 italic'>No custom fields configured. Use "Fetch Fields" above to discover required fields.</p>
                  )}
                </div>
              </div>

              {/* Test connection */}
              <div className='border-t border-[#2d2d44] pt-4'>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={handleJiraTestConnection}
                    disabled={jiraTestStatus === 'loading' || !jiraSettings.baseUrl || !jiraPat}
                    className='px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                  >
                    {jiraTestStatus === 'loading' ? <Loader2 size={14} className='animate-spin' /> : <Link2 size={14} />}
                    Test Connection
                  </button>
                  {jiraTestStatus === 'success' && (
                    <div className='flex items-center gap-1.5 text-green-400 text-sm'>
                      <Check size={14} />
                      <span className='truncate max-w-[280px]'>{jiraTestMessage}</span>
                    </div>
                  )}
                  {jiraTestStatus === 'error' && (
                    <div className='flex items-center gap-1.5 text-red-400 text-sm'>
                      <AlertCircle size={14} />
                      <span className='truncate max-w-[280px]'>{jiraTestMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className='flex justify-end gap-2 p-4 border-t border-[#2d2d44]'>
          <button onClick={onClose} className='px-4 py-2 text-gray-300 hover:text-white transition-colors'>Close</button>
        </div>
      </div>
    </div>
  );
}