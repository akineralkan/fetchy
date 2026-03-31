import { useState, useCallback } from 'react';
import { Bot, X, Loader2, Copy, Check, Sparkles, FileText, Terminal, MessageSquare, Bug, Download, Eye, Code2 } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  sendAIRequest,
  buildGenerateRequestPrompt,
  buildGenerateScriptPrompt,
  buildExplainResponsePrompt,
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
  onApply?: () => void;
  applyLabel?: string;
  language?: string;
  isMarkdown?: boolean;
  downloadFileName?: string;
}

function AIResultModal({ isOpen, onClose, title, icon, loading, error, result, onCopy, onApply, applyLabel, language, isMarkdown, downloadFileName }: AIResultModalProps) {
  const [copied, setCopied] = useState(false);
  const [mdView, setMdView] = useState<'preview' | 'source'>('preview');

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
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
                    <CodeEditor value={result} onChange={() => {}} language={language as 'json' | 'javascript' | 'text'} readOnly />
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
                    onClick={onApply}
                    className='px-3 py-1.5 text-sm ai-btn-solid rounded transition-colors flex items-center gap-1.5'
                  >
                    <Check size={14} />
                    {applyLabel || 'Apply'}
                  </button>
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

// ─── AI Toolbar for Request Panel ───────────────────────────────────────────

interface AIRequestToolbarProps {
  request: ApiRequest;
  response?: ApiResponse | null;
  onOpenGenerateRequest: () => void;
  onApplyScript: (script: string, type: 'pre-request' | 'test') => void;
  onApplyName?: (name: string) => void;
}

export function AIRequestToolbar({
  request,
  response,
  onOpenGenerateRequest,
  onApplyScript,
}: AIRequestToolbarProps) {
  const { aiSettings: ai } = usePreferencesStore();

  const [scriptModal, setScriptModal] = useState<{
    open: boolean;
    type: 'pre-request' | 'test';
    loading: boolean;
    error: string;
    result: string;
  }>({ open: false, type: 'pre-request', loading: false, error: '', result: '' });

  const handleGenerateScript = useCallback(
    async (type: 'pre-request' | 'test') => {
      // If not configured, open AI settings instead of showing error modal
      if (!ai.apiKey && !ai.baseUrl) {
        window.dispatchEvent(new CustomEvent('open-ai-settings'));
        return;
      }
      setScriptModal({ open: true, type, loading: true, error: '', result: '' });
      const messages = buildGenerateScriptPrompt(request, response ?? undefined, type);
      const res = await sendAIRequest(ai, messages);
      if (res.success) {
        // Clean markdown fences
        let cleaned = res.content.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '');
        }
        setScriptModal((prev) => ({ ...prev, loading: false, result: cleaned }));
      } else {
        setScriptModal((prev) => ({ ...prev, loading: false, error: res.error || 'Failed to generate script' }));
      }
    },
    [request, response, ai]
  );

  if (!ai.enabled) return null;

  return (
    <>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <span className='text-[10px] ai-text font-medium uppercase tracking-wider flex items-center gap-1'>
          <Bot size={10} /> AI
        </span>
        <AIActionButton icon={<Sparkles size={12} />} label='Generate Request' onClick={() => {
          if (!ai.apiKey && !ai.baseUrl) { window.dispatchEvent(new CustomEvent('open-ai-settings')); return; }
          onOpenGenerateRequest();
        }} />
        <AIActionButton icon={<Terminal size={12} />} label='Pre-Script' onClick={() => handleGenerateScript('pre-request')} />
        <AIActionButton icon={<Terminal size={12} />} label='Test Script' onClick={() => handleGenerateScript('test')} />
      </div>

      <AIResultModal
        isOpen={scriptModal.open}
        onClose={() => setScriptModal((prev) => ({ ...prev, open: false }))}
        title={`AI Generated ${scriptModal.type === 'pre-request' ? 'Pre-Request' : 'Post-Request'} Script`}
        icon={<Terminal size={18} className='ai-text' />}
        loading={scriptModal.loading}
        error={scriptModal.error}
        result={scriptModal.result}
        language='javascript'
        onApply={() => {
          onApplyScript(scriptModal.result, scriptModal.type);
          setScriptModal((prev) => ({ ...prev, open: false }));
        }}
        applyLabel={`Apply to ${scriptModal.type === 'pre-request' ? 'Pre-Script' : 'Post-Script'}`}
      />
    </>
  );
}

// ─── AI Toolbar for Response Panel ──────────────────────────────────────────

interface AIResponseToolbarProps {
  request: ApiRequest;
  response: ApiResponse;
}

export function AIResponseToolbar({ request, response }: AIResponseToolbarProps) {
  const { aiSettings: ai } = usePreferencesStore();

  const [modal, setModal] = useState<{
    open: boolean;
    feature: 'explain' | 'docs' | 'bugreport';
    loading: boolean;
    error: string;
    result: string;
  }>({ open: false, feature: 'explain', loading: false, error: '', result: '' });

  const [bugReportPrompt, setBugReportPrompt] = useState(false);
  const [bugNote, setBugNote] = useState('');

  const handleExplain = useCallback(async () => {
    // If not configured, open AI settings instead of showing error modal
    if (!ai.apiKey && !ai.baseUrl) {
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
      return;
    }
    setModal({ open: true, feature: 'explain', loading: true, error: '', result: '' });
    const messages = buildExplainResponsePrompt(request, response);
    const res = await sendAIRequest(ai, messages);
    if (res.success) {
      setModal((prev) => ({ ...prev, loading: false, result: res.content }));
    } else {
      setModal((prev) => ({ ...prev, loading: false, error: res.error || 'Failed to explain response' }));
    }
  }, [request, response, ai]);

  const handleGenerateDocs = useCallback(async () => {
    // If not configured, open AI settings instead of showing error modal
    if (!ai.apiKey && !ai.baseUrl) {
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
      return;
    }
    setModal({ open: true, feature: 'docs', loading: true, error: '', result: '' });
    const messages = buildGenerateDocsPrompt(request, response);
    const res = await sendAIRequest(ai, messages);
    if (res.success) {
      setModal((prev) => ({ ...prev, loading: false, result: res.content }));
    } else {
      setModal((prev) => ({ ...prev, loading: false, error: res.error || 'Failed to generate docs' }));
    }
  }, [request, response, ai]);

  const handleGenerateBugReport = useCallback(async (note: string) => {
    // If not configured, open AI settings instead of showing error modal
    if (!ai.apiKey && !ai.baseUrl) {
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
      return;
    }
    setBugReportPrompt(false);
    setBugNote('');
    setModal({ open: true, feature: 'bugreport', loading: true, error: '', result: '' });
    const messages = buildGenerateBugReportPrompt(request, response, note);
    const res = await sendAIRequest(ai, messages);
    if (res.success) {
      setModal((prev) => ({ ...prev, loading: false, result: res.content }));
    } else {
      setModal((prev) => ({ ...prev, loading: false, error: res.error || 'Failed to generate bug report' }));
    }
  }, [request, response, ai]);

  if (!ai.enabled) return null;

  const providerLabel = PROVIDER_META[ai.provider]?.label || ai.provider;

  const modalTitles: Record<string, string> = {
    explain: 'AI Response Explanation',
    docs: 'AI Generated Documentation',
    bugreport: 'AI Generated Bug Report',
  };

  const modalIcons: Record<string, React.ReactNode> = {
    explain: <MessageSquare size={18} className='ai-text' />,
    docs: <FileText size={18} className='ai-text' />,
    bugreport: <Bug size={18} className='ai-text' />,
  };

  return (
    <>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <span className='text-[10px] ai-text font-medium uppercase tracking-wider flex items-center gap-1'>
          <Bot size={10} /> AI
        </span>
        <AIActionButton icon={<MessageSquare size={12} />} label='Explain Response' onClick={handleExplain} />
        <AIActionButton icon={<FileText size={12} />} label='Generate Docs' onClick={handleGenerateDocs} />
        <AIActionButton icon={<Bug size={12} />} label='Bug Report' onClick={() => {
          if (!ai.apiKey && !ai.baseUrl) { window.dispatchEvent(new CustomEvent('open-ai-settings')); return; }
          setBugReportPrompt(true);
        }} />
        <span className='text-[10px] text-gray-500 ml-1'>via {providerLabel}</span>
      </div>

      {/* Bug Report Note Prompt */}
      {bugReportPrompt && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-fetchy-modal rounded-lg shadow-xl w-[500px] overflow-hidden border border-fetchy-border'>
            <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
              <div className='flex items-center gap-2'>
                <Bug size={18} className='ai-text' />
                <h2 className='text-lg font-semibold text-white'>Generate Bug Report</h2>
              </div>
              <button
                onClick={() => { setBugReportPrompt(false); setBugNote(''); }}
                className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'
              >
                <X size={18} />
              </button>
            </div>
            <div className='p-4 space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm text-gray-300 font-medium'>
                  What did you expect from this response?
                </label>
                <textarea
                  value={bugNote}
                  onChange={(e) => setBugNote(e.target.value)}
                  placeholder='e.g., "Expected status 200 with a list of users, but got 500" or "Response body is missing the email field" or "Status is 403 but I sent valid auth token"'
                  rows={4}
                  className='w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm resize-none focus:outline-none ai-focus'
                  autoFocus
                />
              </div>
              <p className='text-xs text-gray-500'>
                The bug report will include all request &amp; response details automatically.
              </p>
              <div className='flex gap-2 justify-end'>
                <button
                  onClick={() => { setBugReportPrompt(false); setBugNote(''); }}
                  className='px-4 py-2 text-sm bg-[#0f0f1a] text-gray-300 border border-[#2d2d44] rounded hover:bg-[#1a1a2e] transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleGenerateBugReport(bugNote || 'The response is not in the expected format.')}
                  className='px-4 py-2 text-sm ai-btn-solid rounded transition-colors flex items-center gap-2'
                >
                  <Bug size={14} />
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AIResultModal
        isOpen={modal.open}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
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
            : `ai-explanation.md`
        }
      />
    </>
  );
}
