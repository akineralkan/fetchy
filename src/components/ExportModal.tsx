import { useState } from 'react';
import { X, Download, FileJson, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { exportToPostman } from '../utils/helpers';

interface ExportModalProps {
  onClose: () => void;
  collectionId?: string;
}

export default function ExportModal({ onClose, collectionId }: ExportModalProps) {
  const { collections } = useAppStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    collectionId || (collections.length > 0 ? collections[0].id : '')
  );
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  const handleExport = () => {
    if (!selectedCollection) return;

    const content = exportToPostman(selectedCollection);
    const filename = `${selectedCollection.name.replace(/\s+/g, '_')}.postman_collection.json`;

    // Create download
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccess(`Successfully exported "${selectedCollection.name}"`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <h2 className="text-xl font-semibold text-fetchy-text">Export Collection</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {collections.length === 0 ? (
            <div className="text-center py-8 text-fetchy-text-muted">
              <p>No collections to export</p>
              <p className="text-sm mt-2">Create a collection first</p>
            </div>
          ) : (
            <>
              {/* Collection selection */}
              <div className="mb-6">
                <label className="block text-sm text-fetchy-text-muted mb-2">Select Collection</label>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name} ({collection.requests.length + collection.folders.reduce((acc, f) => acc + f.requests.length, 0)} requests)
                    </option>
                  ))}
                </select>
              </div>

              {/* Export format info */}
              <div className="mb-6">
                <label className="block text-sm text-fetchy-text-muted mb-2">Export Format</label>
                <div className="p-4 border rounded-lg border-fetchy-accent bg-fetchy-accent/10 flex items-center gap-3">
                  <FileJson className="w-6 h-6 text-fetchy-accent" />
                  <div className="text-left">
                    <div className="font-medium text-fetchy-text">Postman</div>
                    <div className="text-xs text-fetchy-text-muted">v2.1 compatible</div>
                  </div>
                </div>
              </div>

              {/* Success message */}
              {success && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
                  <Check size={18} />
                  <span className="text-sm">{success}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedCollection}
            className="btn btn-primary disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>
    </div>
  );
}

