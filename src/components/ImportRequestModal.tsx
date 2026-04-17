import { useState, useCallback } from 'react';
import { X, Terminal, AlertCircle, Check, Sparkles, Loader2, Info } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { parseCurlCommand } from '../utils/curlParser';
import { aiConvertRequest } from '../utils/aiImport';

interface ImportRequestModalProps {
  onClose: () => void;
}

export default function ImportRequestModal({ onClose }: ImportRequestModalProps) {
  const { addCollection, addRequest, openTab, collections } = useAppStore();

  const [curlInput, setCurlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { aiSettings } = usePreferencesStore();

  const handleImport = useCallback(async () => {
    if (!curlInput.trim()) {
      setError('Please enter a cURL command or request data');
      return;
    }

    setError(null);
    setSuccess(null);

    // ── AI-assisted path ─────────────────────────────────────────────
    if (aiAssisted) {
      setAiLoading(true);
      try {
        const { request, error: aiErr } = await aiConvertRequest(aiSettings, curlInput);
        if (aiErr || !request) throw new Error(aiErr || 'AI conversion failed');

        let targetCollectionId: string;
        if (collections.length > 0) {
          targetCollectionId = collections[0].id;
        } else {
          const collection = addCollection('My Collection');
          targetCollectionId = collection.id;
        }

        const newRequest = addRequest(targetCollectionId, null, request);
        openTab({
          type: 'request',
          title: newRequest.name,
          requestId: newRequest.id,
          collectionId: targetCollectionId,
        });
        setSuccess(`AI imported request "${newRequest.name}"`);
        setTimeout(onClose, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI-assisted import failed');
      } finally {
        setAiLoading(false);
      }
      return;
    }

    // ── Standard cURL path ───────────────────────────────────────────
    try {
      const request = parseCurlCommand(curlInput);
      if (!request) {
        throw new Error('Failed to parse cURL command. Please check the format.');
      }

      let targetCollectionId: string;
      if (collections.length > 0) {
        targetCollectionId = collections[0].id;
      } else {
        const collection = addCollection('My Collection');
        targetCollectionId = collection.id;
      }

      const newRequest = addRequest(targetCollectionId, null, request);
      openTab({
        type: 'request',
        title: newRequest.name,
        requestId: newRequest.id,
        collectionId: targetCollectionId,
      });
      setSuccess(`Successfully imported request "${newRequest.name}"`);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [curlInput, onClose, collections, addCollection, addRequest, openTab, aiAssisted, aiSettings]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-fetchy-text">Import Request</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-fetchy-text-muted mb-4">
            Paste a cURL command below to import it as a new request.
          </p>

          <div className="mb-5">
            <label className="block text-sm text-fetchy-text-muted mb-2">{aiAssisted ? 'Request Data' : 'cURL Command'}</label>
            <textarea
              value={curlInput}
              onChange={(e) => {
                setCurlInput(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder={aiAssisted
                ? 'Paste a cURL command, HTTP snippet, or any request data here...'
                : 'curl -X POST "https://api.example.com/data" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"key": "value"}\''
              }
              className="w-full resize-none font-mono text-sm h-48"
            />
          </div>

          {/* AI-Assisted Import checkbox */}
          {aiSettings.enabled && (
            <div className="mb-4">
              <label className="inline-flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={aiAssisted}
                  onChange={(e) => setAiAssisted(e.target.checked)}
                  className="w-4 h-4 rounded border-fetchy-border text-fetchy-accent focus:ring-fetchy-accent bg-fetchy-input"
                />
                <Sparkles size={16} className={aiAssisted ? 'text-fetchy-accent' : 'text-fetchy-text-muted'} />
                <span className={`text-sm font-medium ${aiAssisted ? 'text-fetchy-accent' : 'text-fetchy-text'}`}>
                  AI-Assisted Import
                </span>
                <span className="relative">
                  <Info size={14} className="text-fetchy-text-muted hover:text-fetchy-text cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-fetchy-tooltip text-fetchy-text text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    Uses AI to convert any request format into Fetchy&apos;s format.<br/>
                    Best-effort conversion — there may be minor inconsistencies.<br/>
                    Supports cURL, HTTP snippets, and custom formats.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
              <Check size={18} className="flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!curlInput.trim() || aiLoading}
            className="btn btn-primary disabled:opacity-50 flex items-center gap-2"
          >
            {aiLoading && <Loader2 size={16} className="animate-spin" />}
            {aiLoading ? 'Converting with AI...' : aiAssisted ? 'AI Import' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
