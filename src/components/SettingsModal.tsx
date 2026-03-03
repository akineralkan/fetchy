import { useState } from 'react';
import { X, Layers, Bot, Eye, EyeOff, Check, Loader2, AlertCircle, ShieldAlert, Info, GitBranch } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { useAppStore } from '../store/appStore';
import { useWorkspacesStore } from '../store/workspacesStore';
import { PROVIDER_META, sendAIRequest } from '../utils/aiProvider';
import GitSettingsTab from './GitSettingsTab';
import type { AIProvider, AISettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspaces: () => void;
  onOpenConflictResolver?: () => void;
  initialTab?: 'general' | 'ai' | 'git';
}

export default function SettingsModal({ isOpen, onClose, onOpenWorkspaces, onOpenConflictResolver, initialTab }: SettingsModalProps) {
  const { preferences, savePreferences, aiSettings: ai, updateAISettings } = usePreferencesStore();
  const { panelLayout, setPanelLayout } = useAppStore();
  const { workspaces, activeWorkspaceId } = useWorkspacesStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const { updateWorkspace } = useWorkspacesStore();

  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'git'>(initialTab ?? 'general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

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
          <button onClick={() => setActiveTab('git')} className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'git' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}><GitBranch size={14} />Git</button>
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
                <div><label className='text-sm text-gray-300'>Auto-save</label><p className='text-xs text-gray-500'>Automatically save changes to collections</p></div>
                <input type='checkbox' checked={preferences.autoSave} onChange={(e) => savePreferences({ autoSave: e.target.checked })} className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500' />
              </div>
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
          ) : activeTab === 'git' ? (
            <GitSettingsTab
              workspace={activeWorkspace}
              onWorkspaceUpdate={(id, updates) => updateWorkspace(id, updates)}
              onOpenConflictResolver={onOpenConflictResolver}
            />
          ) : null}
        </div>
        <div className='flex justify-end gap-2 p-4 border-t border-[#2d2d44]'>
          <button onClick={onClose} className='px-4 py-2 text-gray-300 hover:text-white transition-colors'>Close</button>
        </div>
      </div>
    </div>
  );
}