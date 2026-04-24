import { useState, useCallback, useEffect } from 'react';
import { Bot, X, Loader2, Copy, Check, Sparkles, FileText, MessageSquare, Bug, Download, Eye, Code2, Ticket, AlertCircle, MessageCircle, RefreshCw } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  sendAIRequest,
  buildGenerateRequestPrompt,
  buildExplainResponsePrompt,
  buildCustomChatPrompt,
  buildConvertToFetchySyntaxPrompt,
  buildScriptChatPrompt,
  buildGenerateDocsPrompt,
  buildGenerateBugReportPrompt,
  PROVIDER_META,
} from '../utils/aiProvider';
import type { ApiRequest, ApiResponse } from '../types';
import CodeEditor from './CodeEditor';

// ─── AI Generate Request Modal ──────────────────────────────────────────────

interface AIGenerateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (generated: {
    method: string;
    url: string;
    headers: Array<{ key: string; value: string; enabled: boolean }>;
    params: Array<{ key: string; value: string; enabled: boolean }>;
    body: { type: string; raw?: string };
    name: string;
  }) => void;
}

export function AIGenerateRequestModal({ isOpen, onClose, onApply }: AIGenerateRequestModalProps) {
  const { aiSettings: ai } = usePreferencesStore();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string>('');

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult('');

    const messages = buildGenerateRequestPrompt(prompt);
    const response = await sendAIRequest(ai, messages);

    if (response.success) {
      setResult(response.content);
    } else {
      setError(response.error || 'Failed to generate request');
    }
    setLoading(false);
  }, [prompt, ai]);

  const handleApply = useCallback(() => {
    try {
      // Clean the response - remove markdown fences if present
      let cleaned = result.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(cleaned);
      onApply({
        method: parsed.method || 'GET',
        url: parsed.url || '',
        headers: (parsed.headers || []).map((h: { key: string; value: string; enabled?: boolean }) => ({
          key: h.key,
          value: h.value,
          enabled: h.enabled !== false,
        })),
        params: (parsed.params || []).map((p: { key: string; value: string; enabled?: boolean }) => ({
          key: p.key,
          value: p.value,
          enabled: p.enabled !== false,
        })),
        body: parsed.body || { type: 'none' },
        name: parsed.name || 'AI Generated Request',
      });
      onClose();
      setPrompt('');
      setResult('');
    } catch {
      setError('Failed to parse AI response. Try regenerating.');
    }
  }, [result, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-fetchy-modal rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-hidden border border-fetchy-border'>
        <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
          <div className='flex items-center gap-2'>
            <Sparkles size={18} className='ai-text' />
            <h2 className='text-lg font-semibold text-white'>Generate Request with AI</h2>
          </div>
          <button onClick={onClose} className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'>
            <X size={18} />
          </button>
        </div>

        <div className='p-4 space-y-4'>
          {!ai.enabled && (
            <div className='p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-300 text-sm flex items-center justify-between'>
              <span>AI is not configured. Set up your provider and API key to get started.</span>
              <button
                onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('open-ai-settings')); }}
                className='ml-3 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors whitespace-nowrap'
              >
                Open AI Settings
              </button>
            </div>
          )}

          <div className='space-y-2'>
            <label className='text-sm text-gray-300 font-medium'>Describe the API request you want to make</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g., "GET request to fetch all users from JSONPlaceholder API with pagination"
or "POST to create a new user with name and email fields"'
              rows={3}
              className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm resize-none focus:outline-none ai-focus'
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || !ai.enabled}
            className='px-4 py-2 text-sm ai-btn-solid rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
          >
            {loading ? <Loader2 size={14} className='animate-spin' /> : <Sparkles size={14} />}
            {loading ? 'Generating...' : 'Generate Request'}
          </button>

          {error && <div className='text-red-400 text-sm'>{error}</div>}

          {result && (
            <div className='space-y-3'>
              <label className='text-sm text-gray-300 font-medium'>Generated Request</label>
              <div className='h-[200px] border border-[#2d2d44] rounded overflow-hidden'>
                <CodeEditor value={result} onChange={setResult} language='json' />
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={handleApply}
                  className='px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2'
                >
                  <Check size={14} /> Apply to Request
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className='px-4 py-2 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors'
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Result Modal (for explain, docs, scripts) ───────────────────────────

interface AIResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  error: string;
  result: string;
  onCopy?: () => void;
  onApply?: (content: string) => void;
  applyLabel?: string;
  language?: string;
  isMarkdown?: boolean;
  downloadFileName?: string;
  allowEdit?: boolean;
  onCreateJira?: () => void;
  jiraLoading?: boolean;
  jiraResult?: { success: boolean; issueKey?: string; issueUrl?: string; error?: string } | null;
}

function AIResultModal({ isOpen, onClose, title, icon, loading, error, result, onCopy, onApply, applyLabel, language, isMarkdown, allowEdit, downloadFileName, onCreateJira, jiraLoading, jiraResult }: AIResultModalProps) {
  const [copied, setCopied] = useState(false);
  const [mdView, setMdView] = useState<'preview' | 'source'>('preview');
  const [editedContent, setEditedContent] = useState(result);

  useEffect(() => { setEditedContent(result); }, [result]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName || 'ai-output.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-fetchy-modal rounded-lg shadow-xl w-[700px] max-h-[85vh] overflow-hidden border border-fetchy-border flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-[#2d2d44] shrink-0'>
          <div className='flex items-center gap-2'>
            {icon}
            <h2 className='text-lg font-semibold text-white'>{title}</h2>
          </div>
          <div className='flex items-center gap-2'>
            {isMarkdown && result && !loading && (
              <div className='flex items-center rounded border border-[#2d2d44] overflow-hidden text-xs'>
                <button
                  onClick={() => setMdView('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                    mdView === 'preview'
                      ? 'bg-fetchy-accent/20 text-fetchy-accent'
                      : 'text-gray-400 hover:text-white hover:bg-[#2d2d44]'
                  }`}
                >
                  <Eye size={12} />
                  Preview
                </button>
                <button
                  onClick={() => setMdView('source')}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors border-l border-[#2d2d44] ${
                    mdView === 'source'
                      ? 'bg-fetchy-accent/20 text-fetchy-accent'
                      : 'text-gray-400 hover:text-white hover:bg-[#2d2d44]'
                  }`}
                >
                  <Code2 size={12} />
                  Source
                </button>
              </div>
            )}
            <button onClick={onClose} className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-hidden flex flex-col min-h-0'>
          {loading && (
            <div className='flex items-center gap-3 py-12 justify-center text-gray-400'>
              <Loader2 size={20} className='animate-spin' />
              <span>AI is thinking...</span>
            </div>
          )}

          {error && !loading && <div className='text-red-400 text-sm p-4'>{error}</div>}

          {result && !loading && (
            <>
              {/* Content area */}
              <div className='flex-1 overflow-auto min-h-0'>
                {isMarkdown ? (
                  mdView === 'preview' ? (
                    <div className='prose prose-invert prose-sm max-w-none text-gray-300 ai-markdown-content p-4 overflow-auto h-full'>
                      <MarkdownRenderer content={result} />
                    </div>
                  ) : (
                    <div className='h-full'>
                      <CodeEditor value={result} onChange={() => {}} language='text' readOnly />
                    </div>
                  )
                ) : language ? (
                  <div className='h-[400px]'>
                    <CodeEditor
                      value={editedContent}
                      onChange={allowEdit ? setEditedContent : () => {}}
                      language={language as 'json' | 'javascript' | 'text'}
                      readOnly={!allowEdit}
                    />
                  </div>
                ) : (
                  <div className='prose prose-invert prose-sm max-w-none text-gray-300 ai-markdown-content p-4 overflow-auto h-full'>
                    <MarkdownRenderer content={result} />
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className='flex items-center gap-2 px-4 py-3 border-t border-[#2d2d44] shrink-0 bg-fetchy-modal'>
                <button
                  onClick={handleCopy}
                  className='px-3 py-1.5 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors flex items-center gap-1.5'
                >
                  {copied ? <Check size={14} className='text-green-400' /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {isMarkdown && (
                  <button
                    onClick={handleDownload}
                    className='px-3 py-1.5 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors flex items-center gap-1.5'
                  >
                    <Download size={14} />
                    Download .md
                  </button>
                )}
                {onApply && (
                  <button
                    onClick={() => onApply(editedContent)}
                    className='px-3 py-1.5 text-sm ai-btn-solid rounded transition-colors flex items-center gap-1.5'
                  >
                    <Check size={14} />
                    {applyLabel || 'Apply'}
                  </button>
                )}
                {onCreateJira && (
                  <button
                    onClick={onCreateJira}
                    disabled={jiraLoading}
                    className='px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ml-auto'
                  >
                    {jiraLoading ? <Loader2 size={14} className='animate-spin' /> : <Ticket size={14} />}
                    {jiraLoading ? 'Creating...' : 'Create Jira Bug'}
                  </button>
                )}
                {jiraResult && jiraResult.success && (
                  <div className='flex items-center gap-1.5 text-green-400 text-xs ml-2'>
                    <Check size={12} />
                    <button
                      onClick={() => {
                        if (jiraResult.issueUrl && window.electronAPI?.openExternalUrl) {
                          window.electronAPI.openExternalUrl(jiraResult.issueUrl);
                        }
                      }}
                      className='hover:text-green-300 underline'
                    >
                      {jiraResult.issueKey}
                    </button>
                  </div>
                )}
                {jiraResult && !jiraResult.success && (
                  <div className='flex items-center gap-1.5 ml-2'>
                    <div className='relative group'>
                      <AlertCircle size={14} className='text-red-400 cursor-help' />
                      <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-2 bg-[#1a1a2e] border border-red-500/30 rounded text-xs text-red-300 shadow-lg z-50 whitespace-pre-wrap break-words'>
                        {jiraResult.error}
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(jiraResult.error || '')}
                      className='p-0.5 text-red-400 hover:text-red-300 transition-colors shrink-0'
                      title='Copy error'
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Simple Markdown Renderer ───────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  // Apply inline formatting only (used inside table cells too)
  const applyInline = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, '<code class="bg-[#1a1a2e] px-1 py-0.5 rounded text-xs ai-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-gray-300 italic">$1</em>');

  // Convert a captured table block (raw markdown lines) to an HTML table
  const convertTable = (tableText: string): string => {
    const lines = tableText.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return tableText;

    const parseRow = (line: string): string[] =>
      line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

    const isSeparator = (line: string): boolean => /^\|[\s\-:|]+\|$/.test(line.trim());

    const [headerLine, ...rest] = lines;
    const dataLines = rest.filter((l) => !isSeparator(l));
    const headers = parseRow(headerLine);

    const thead = `<thead class="bg-[#13132a]"><tr>${headers
      .map(
        (h) =>
          `<th class="px-3 py-2 text-left text-xs font-semibold text-fetchy-accent uppercase tracking-wide border border-[#2d2d44] whitespace-nowrap">${applyInline(h)}</th>`
      )
      .join('')}</tr></thead>`;

    const tbody = `<tbody>${dataLines
      .map(
        (line, i) =>
          `<tr class="${i % 2 !== 0 ? 'bg-[#0d0d1e]/60' : ''}">${parseRow(line)
            .map(
              (c) =>
                `<td class="px-3 py-1.5 text-sm text-gray-300 border border-[#2d2d44] align-top">${applyInline(c)}</td>`
            )
            .join('')}</tr>`
      )
      .join('')}</tbody>`;

    return `<div class="overflow-x-auto my-4 rounded-md border border-[#2d2d44]"><table class="w-full border-collapse text-left">${thead}${tbody}</table></div>`;
  };

  // ── Step 1: extract code blocks and tables into placeholders so their
  //           content isn't mangled by the inline/paragraph passes.
  const blocks = new Map<string, string>();
  let idx = 0;
  const placeholder = (html: string): string => {
    const key = `\x00BLOCK_${idx++}\x00`;
    blocks.set(key, html);
    return key;
  };

  let src = content
    // Fenced code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, _lang, code) =>
        placeholder(
          `<pre class="bg-[#1a1a2e] p-3 rounded-md text-sm overflow-x-auto my-3 border border-[#2d2d44]"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
        )
    )
    // Markdown tables: one-or-more consecutive lines that start with |
    .replace(/((?:[ \t]*\|[^\n]+\n?)+)/gm, (match) => placeholder(convertTable(match)));

  // ── Step 2: block-level markdown (headers, lists, hr)
  src = src
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-5 mb-1.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-6 mb-2">$1</h1>')
    .replace(/^---$/gm, '<hr class="border-[#2d2d44] my-4" />')
    // Wrap consecutive list items in <ul>/<ol>
    .replace(/((?:^[-*] .+\n?)+)/gm, (match) => {
      const items = match
        .trim()
        .split('\n')
        .map((l) => `<li class="ml-5 list-disc my-0.5">${applyInline(l.replace(/^[-*] /, ''))}</li>`)
        .join('');
      return `<ul class="my-2 space-y-0.5">${items}</ul>`;
    })
    .replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
      const items = match
        .trim()
        .split('\n')
        .map((l) => `<li class="ml-5 list-decimal my-0.5">${applyInline(l.replace(/^\d+\. /, ''))}</li>`)
        .join('');
      return `<ol class="my-2 space-y-0.5">${items}</ol>`;
    });

  // ── Step 3: inline formatting
  src = applyInline(src);

  // ── Step 4: paragraphs
  src = src
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br/>');

  // ── Step 5: restore placeholders
  let html = `<p class="my-2">${src}</p>`;
  blocks.forEach((blockHtml, key) => {
    // Escape the null bytes so the regex replacement works
    html = html.split(key).join(`</p>${blockHtml}<p class="my-2">`);
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── AI Action Buttons (inline) ─────────────────────────────────────────────

interface AIActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function AIActionButton({ icon, label, onClick, loading, disabled }: AIActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className='flex items-center gap-1.5 px-2.5 py-1 text-xs ai-btn rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
      title={label}
    >
      {loading ? <Loader2 size={12} className='animate-spin' /> : icon}
      <span>{label}</span>
    </button>
  );
}

// ─── AI Script Assist Button (for Pre-Script / Post-Script tabs) ────────────

interface AIScriptAssistButtonProps {
  scriptType: 'pre' | 'post';
  scriptValue: string;
  onApply: (code: string) => void;
}

export function AIScriptAssistButton({ scriptType, scriptValue, onApply }: AIScriptAssistButtonProps) {
  const { aiSettings: ai } = usePreferencesStore();

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'convert' | 'chat' | null>(null);
  const [chatMessage, setChatMessage] = useState('');

  const [result, setResult] = useState<{ loading: boolean; error: string; content: string; mode: 'convert' | 'chat' | null }>({
    loading: false, error: '', content: '', mode: null,
  });

  const handleAsk = useCallback(async () => {
    if (!selectedMode) return;
    if (!ai.apiKey && !ai.baseUrl) {
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
      return;
    }

    setPanelOpen(false);
    const mode = selectedMode;
    const msg = chatMessage.trim();
    setChatMessage('');
    setSelectedMode(null);
    setResult({ loading: true, error: '', content: '', mode });

    const messages =
      mode === 'convert'
        ? buildConvertToFetchySyntaxPrompt(scriptValue, scriptType)
        : buildScriptChatPrompt(scriptValue, scriptType, msg || 'Help me improve this script.');

    const res = await sendAIRequest(ai, messages);
    if (res.success) {
      let content = res.content.trim();
      if (mode === 'convert') {
        // Strip markdown fences if the model adds them
        if (content.startsWith('```')) {
          content = content.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '');
        }
      }
      setResult({ loading: false, error: '', content, mode });
    } else {
      setResult({ loading: false, error: res.error || 'AI request failed', content: '', mode });
    }
  }, [selectedMode, chatMessage, scriptValue, scriptType, ai]);

  if (!ai.enabled) return null;

  const modes = [
    {
      id: 'convert' as const,
      icon: <RefreshCw size={14} />,
      label: 'Convert to Fetchy Syntax',
      description: 'Rewrite the current script using the Fetchy scripting API',
    },
    {
      id: 'chat' as const,
      icon: <MessageCircle size={14} />,
      label: 'Custom Chat',
      description: 'Ask anything — current script code is included in context automatically',
    },
  ];

  return (
    <>
      <button
        onClick={() => {
          if (!ai.apiKey && !ai.baseUrl) { window.dispatchEvent(new CustomEvent('open-ai-settings')); return; }
          setPanelOpen(true);
        }}
        className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs ai-btn-solid rounded transition-colors'
        title='AI Assist'
      >
        <Bot size={12} />
        <span>AI Assist</span>
      </button>

      {/* Selection panel */}
      {panelOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-fetchy-modal rounded-lg shadow-xl w-[480px] overflow-hidden border border-fetchy-border'>
            <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
              <div className='flex items-center gap-2'>
                <Bot size={18} className='ai-text' />
                <h2 className='text-lg font-semibold text-white'>AI Assist — {scriptType === 'pre' ? 'Pre-Script' : 'Post-Script'}</h2>
              </div>
              <button
                onClick={() => { setPanelOpen(false); setSelectedMode(null); setChatMessage(''); }}
                className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'
              >
                <X size={18} />
              </button>
            </div>
            <div className='p-4 space-y-3'>
              <p className='text-xs text-gray-500 uppercase tracking-wider font-medium'>Select an action</p>
              <div className='space-y-2'>
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                      selectedMode === mode.id
                        ? 'border-fetchy-accent bg-fetchy-accent/10'
                        : 'border-[#2d2d44] bg-[#0f0f1a] hover:border-fetchy-accent/50 hover:bg-[#1a1a2e]'
                    }`}
                  >
                    <div className='flex items-center gap-2 ai-text'>
                      {mode.icon}
                      <span className='text-sm font-medium text-white'>{mode.label}</span>
                    </div>
                    <p className='text-xs text-gray-500 mt-0.5 ml-[22px]'>{mode.description}</p>
                  </button>
                ))}
              </div>
              {selectedMode === 'chat' && (
                <div className='space-y-2 pt-1'>
                  <label className='text-sm text-gray-300 font-medium'>Your message</label>
                  <textarea
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder='e.g. "How do I extract the token from the response and save it?"'
                    rows={4}
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm resize-none focus:outline-none ai-focus'
                    autoFocus
                  />
                  <p className='text-xs text-gray-500'>The current script code is automatically included in context.</p>
                </div>
              )}
              <div className='flex gap-2 justify-end pt-1'>
                <button
                  onClick={() => { setPanelOpen(false); setSelectedMode(null); setChatMessage(''); }}
                  className='px-4 py-2 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={handleAsk}
                  disabled={!selectedMode || (selectedMode === 'chat' && !chatMessage.trim())}
                  className='px-4 py-2 text-sm ai-btn-solid rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <Sparkles size={14} />
                  Ask
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result modal */}
      {(result.loading || result.content || result.error) && (
        <AIResultModal
          isOpen={true}
          onClose={() => setResult({ loading: false, error: '', content: '', mode: null })}
          title={result.mode === 'convert' ? 'Convert to Fetchy Syntax' : 'AI Script Chat'}
          icon={result.mode === 'convert' ? <RefreshCw size={18} className='ai-text' /> : <MessageCircle size={18} className='ai-text' />}
          loading={result.loading}
          error={result.error}
          result={result.content}
          language={result.mode === 'convert' ? 'javascript' : undefined}
          isMarkdown={result.mode === 'chat'}
          allowEdit={result.mode === 'convert'}
          onApply={
            result.mode === 'convert' && result.content
              ? (content) => {
                  onApply(content);
                  setResult({ loading: false, error: '', content: '', mode: null });
                }
              : undefined
          }
          applyLabel='Apply to Script'
        />
      )}
    </>
  );
}

// ─── AI Toolbar for Response Panel ──────────────────────────────────────────

interface AIResponseToolbarProps {
  request: ApiRequest;
  response: ApiResponse;
}

export function AIResponseToolbar({ request, response }: AIResponseToolbarProps) {
  const { aiSettings: ai, jiraSettings, jiraPat } = usePreferencesStore();

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<'explain' | 'docs' | 'bugreport' | 'customchat' | null>(null);
  const [bugNote, setBugNote] = useState('');
  const [customChatMessage, setCustomChatMessage] = useState('');

  const [modal, setModal] = useState<{
    open: boolean;
    feature: 'explain' | 'docs' | 'bugreport' | 'customchat';
    loading: boolean;
    error: string;
    result: string;
  }>({ open: false, feature: 'explain', loading: false, error: '', result: '' });

  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraResult, setJiraResult] = useState<{ success: boolean; issueKey?: string; issueUrl?: string; error?: string } | null>(null);

  const handleAsk = useCallback(async () => {
    if (!selectedSnippet) return;
    if (!ai.apiKey && !ai.baseUrl) {
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
      return;
    }
    setPanelOpen(false);
    setModal({ open: true, feature: selectedSnippet, loading: true, error: '', result: '' });

    let messages;
    if (selectedSnippet === 'explain') {
      messages = buildExplainResponsePrompt(request, response);
    } else if (selectedSnippet === 'docs') {
      messages = buildGenerateDocsPrompt(request, response);
    } else if (selectedSnippet === 'customchat') {
      messages = buildCustomChatPrompt(request, response, customChatMessage.trim() || 'Analyze this request and response.');
    } else {
      messages = buildGenerateBugReportPrompt(request, response, bugNote || 'The response is not in the expected format.');
    }
    setBugNote('');
    setCustomChatMessage('');
    setSelectedSnippet(null);

    const res = await sendAIRequest(ai, messages);
    if (res.success) {
      setModal((prev) => ({ ...prev, loading: false, result: res.content }));
    } else {
      setModal((prev) => ({ ...prev, loading: false, error: res.error || 'Failed to get AI response' }));
    }
  }, [selectedSnippet, bugNote, customChatMessage, request, response, ai]);

  const jiraConfigured = jiraSettings.enabled && jiraSettings.baseUrl && jiraPat && jiraSettings.projectKey;

  // Build custom fields object from configured mappings
  // Supports multi-value arrays via comma separation: "DSA,Other" → [{value:"DSA"},{value:"Other"}]
  const buildCustomFields = useCallback(() => {
    const customFields: Record<string, unknown> = {};
    for (const mapping of jiraSettings.fieldMappings) {
      if (mapping.customFieldId && mapping.defaultValue) {
        const val = mapping.defaultValue;
        switch (mapping.fieldType) {
          case 'option':
            customFields[mapping.customFieldId] = { value: val };
            break;
          case 'array':
            customFields[mapping.customFieldId] = val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
              .map((v) => ({ name: v, value: v, key: v }));
            break;
          case 'insight':
            customFields[mapping.customFieldId] = val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
              .map((v) => ({ key: v }));
            break;
          case 'raw':
            try {
              customFields[mapping.customFieldId] = JSON.parse(val);
            } catch {
              customFields[mapping.customFieldId] = val;
            }
            break;
          default:
            customFields[mapping.customFieldId] = val;
        }
      }
    }
    return customFields;
  }, [jiraSettings.fieldMappings]);

  const handleCreateJiraBug = useCallback(async () => {
    if (!jiraConfigured || !window.electronAPI?.jiraCreateIssue) return;

    setJiraLoading(true);
    setJiraResult(null);

    // Pre-flight: validate field mappings are complete before calling API
    const incomplete = jiraSettings.fieldMappings.filter(
      (m) => m.fieldName && (!m.customFieldId || !m.defaultValue)
    );
    if (incomplete.length > 0) {
      const names = incomplete.map((m) => m.fieldName).join(', ');
      setJiraResult({
        success: false,
        error: `Incomplete field mappings: ${names}. Each mapping needs both a Custom Field ID and Default Value. Fix in Settings > Integrations.`,
      });
      setJiraLoading(false);
      return;
    }

    // Parse title from AI-generated text
    // Handles both "## Title\nText" and "Title\n\nText" (first non-empty line after "Title")
    let summary = '';
    const titleSectionMatch = modal.result.match(/(?:^|\n)#{1,3}\s*Title\s*\n+(.+)/i);
    if (titleSectionMatch) {
      summary = titleSectionMatch[1].trim();
    } else {
      // Try plain "Title\n\nActual title text" pattern
      const plainTitleMatch = modal.result.match(/(?:^|\n)Title\s*\n+(.+)/i);
      if (plainTitleMatch) {
        summary = plainTitleMatch[1].trim();
      }
    }
    if (!summary) {
      summary = `Bug: ${request.method} ${request.url}`;
    }

    const customFields = buildCustomFields();

    // Clean description for Jira:
    // 1. Remove "# Bug Report" heading
    // 2. Remove "## Title\n<title text>" section (already used as summary)
    // 3. Remove leading/trailing horizontal rules (---)
    // 4. Fix double-indented numbered lists (e.g. "1.   1." → "1.")
    let description = modal.result
      .replace(/^---\s*\n/m, '')
      .replace(/^#{1,3}\s*🐛?\s*Bug Report\s*\n+/im, '')
      .replace(/^#{1,3}\s*Title\s*\n+.+\n*/im, '')
      .replace(/\n---\s*$/m, '')
      .replace(/^(\d+)\.\s+\d+\.\s+/gm, '$1. ')
      .trim();

    try {
      const result = await window.electronAPI.jiraCreateIssue({
        baseUrl: jiraSettings.baseUrl,
        summary,
        description,
        projectKey: jiraSettings.projectKey,
        issueType: jiraSettings.issueType,
        customFields,
      });
      setJiraResult(result);
    } catch (error) {
      setJiraResult({ success: false, error: 'Failed to create Jira issue' });
    } finally {
      setJiraLoading(false);
    }
  }, [modal.result, jiraSettings, jiraPat, request, buildCustomFields]);

  if (!ai.enabled) return null;

  const providerLabel = PROVIDER_META[ai.provider]?.label || ai.provider;

  const modalTitles: Record<string, string> = {
    explain: 'AI Response Explanation',
    docs: 'AI Generated Documentation',
    bugreport: 'AI Generated Bug Report',
    customchat: 'AI Custom Chat',
  };

  const modalIcons: Record<string, React.ReactNode> = {
    explain: <MessageSquare size={18} className='ai-text' />,
    docs: <FileText size={18} className='ai-text' />,
    bugreport: <Bug size={18} className='ai-text' />,
    customchat: <MessageCircle size={18} className='ai-text' />,
  };

  const snippets = [
    { id: 'explain' as const, icon: <MessageSquare size={14} />, label: 'Explain Response', description: 'Get a clear explanation of what this response means' },
    { id: 'docs' as const, icon: <FileText size={14} />, label: 'Generate Docs', description: 'Generate API documentation for this endpoint' },
    { id: 'bugreport' as const, icon: <Bug size={14} />, label: 'Bug Report', description: 'Create a structured bug report from this response' },
    { id: 'customchat' as const, icon: <MessageCircle size={14} />, label: 'Custom Chat', description: 'Ask anything — full request & response context is included automatically' },
  ];

  return (
    <>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <span className='text-[10px] ai-text font-medium uppercase tracking-wider flex items-center gap-1'>
          <Bot size={10} /> AI
        </span>
        <AIActionButton
          icon={<Sparkles size={12} />}
          label='AI Assist'
          onClick={() => {
            if (!ai.apiKey && !ai.baseUrl) { window.dispatchEvent(new CustomEvent('open-ai-settings')); return; }
            setPanelOpen(true);
          }}
        />
        <span className='text-[10px] text-gray-500 ml-1'>via {providerLabel}</span>
      </div>

      {/* AI Assist Panel */}
      {panelOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-fetchy-modal rounded-lg shadow-xl w-[480px] overflow-hidden border border-fetchy-border'>
            <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
              <div className='flex items-center gap-2'>
                <Bot size={18} className='ai-text' />
                <h2 className='text-lg font-semibold text-white'>AI Assist</h2>
              </div>
              <button
                onClick={() => { setPanelOpen(false); setSelectedSnippet(null); setBugNote(''); }}
                className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'
              >
                <X size={18} />
              </button>
            </div>
            <div className='p-4 space-y-3'>
              <p className='text-xs text-gray-500 uppercase tracking-wider font-medium'>Select an action</p>
              <div className='space-y-2'>
                {snippets.map((snippet) => (
                  <button
                    key={snippet.id}
                    onClick={() => setSelectedSnippet(snippet.id)}
                    className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                      selectedSnippet === snippet.id
                        ? 'border-fetchy-accent bg-fetchy-accent/10 text-white'
                        : 'border-[#2d2d44] bg-[#0f0f1a] text-gray-300 hover:border-fetchy-accent/50 hover:bg-[#1a1a2e]'
                    }`}
                  >
                    <div className='flex items-center gap-2 ai-text'>
                      {snippet.icon}
                      <span className='text-sm font-medium text-white'>{snippet.label}</span>
                    </div>
                    <p className='text-xs text-gray-500 mt-0.5 ml-[22px]'>{snippet.description}</p>
                  </button>
                ))}
              </div>
              {selectedSnippet === 'bugreport' && (
                <div className='space-y-2 pt-1'>
                  <label className='text-sm text-gray-300 font-medium'>What did you expect? (optional)</label>
                  <textarea
                    value={bugNote}
                    onChange={(e) => setBugNote(e.target.value)}
                    placeholder='e.g., "Expected status 200 with a list of users, but got 500"'
                    rows={3}
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm resize-none focus:outline-none ai-focus'
                  />
                </div>
              )}
              {selectedSnippet === 'customchat' && (
                <div className='space-y-2 pt-1'>
                  <label className='text-sm text-gray-300 font-medium'>Your message</label>
                  <textarea
                    value={customChatMessage}
                    onChange={(e) => setCustomChatMessage(e.target.value)}
                    placeholder='e.g., "Why is the response missing the email field?" or "Is this a valid OAuth flow?"'
                    rows={4}
                    className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm resize-none focus:outline-none ai-focus'
                    autoFocus
                  />
                  <p className='text-xs text-gray-500'>Full request &amp; response details are automatically included in the prompt.</p>
                </div>
              )}
              <div className='flex gap-2 justify-end pt-1'>
                <button
                  onClick={() => { setPanelOpen(false); setSelectedSnippet(null); setBugNote(''); setCustomChatMessage(''); }}
                  className='px-4 py-2 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={handleAsk}
                  disabled={!selectedSnippet || (selectedSnippet === 'customchat' && !customChatMessage.trim())}
                  className='px-4 py-2 text-sm ai-btn-solid rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <Sparkles size={14} />
                  Ask
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AIResultModal
        isOpen={modal.open}
        onClose={() => { setModal((prev) => ({ ...prev, open: false })); setJiraResult(null); }}
        title={modalTitles[modal.feature] || 'AI Result'}
        icon={modalIcons[modal.feature] || <Bot size={18} className='ai-text' />}
        loading={modal.loading}
        error={modal.error}
        result={modal.result}
        isMarkdown
        downloadFileName={
          modal.feature === 'docs'
            ? `api-docs-${request.method.toLowerCase()}-${request.url.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.md`
            : modal.feature === 'bugreport'
            ? `bug-report-${request.method.toLowerCase()}-${request.url.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.md`
            : modal.feature === 'customchat'
            ? `ai-chat-${request.method.toLowerCase()}-${request.url.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.md`
            : `ai-explanation.md`
        }
        onCreateJira={modal.feature === 'bugreport' && jiraConfigured ? handleCreateJiraBug : undefined}
        jiraLoading={jiraLoading}
        jiraResult={jiraResult}
      />
    </>
  );
}
