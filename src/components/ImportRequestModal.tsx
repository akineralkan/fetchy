import { useState, useCallback } from 'react';
import { X, Terminal, AlertCircle, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { parseCurlCommand } from '../utils/curlParser';

interface ImportRequestModalProps {
  onClose: () => void;
}

export default function ImportRequestModal({ onClose }: ImportRequestModalProps) {
  const { addCollection, addRequest, openTab, collections } = useAppStore();

  const [curlInput, setCurlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImport = useCallback(() => {
    if (!curlInput.trim()) {
      setError('Please enter a cURL command');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const request = parseCurlCommand(curlInput);
      if (!request) {
        throw new Error('Failed to parse cURL command. Please check the format.');
      }

      // Add to existing first collection, or create one
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
  }, [curlInput, onClose, collections, addCollection, addRequest, openTab]);

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
            <label className="block text-sm text-fetchy-text-muted mb-2">cURL Command</label>
            <textarea
              value={curlInput}
              onChange={(e) => {
                setCurlInput(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder={'curl -X POST "https://api.example.com/data" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"key": "value"}\''}
              className="w-full resize-none font-mono text-sm h-48"
            />
          </div>

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
            disabled={!curlInput.trim()}
            className="btn btn-primary disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
