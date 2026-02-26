import { useState, useRef } from 'react';
import { X, Upload, FileJson, AlertCircle, Check, Terminal } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { importPostmanCollection, importOpenAPISpec, parseCurlCommand } from '../utils/helpers';
import { Collection } from '../types';

interface ImportModalProps {
  onClose: () => void;
  initialImportType?: ImportType;
}

type ImportType = 'postman' | 'openapi' | 'curl';

export default function ImportModal({ onClose, initialImportType = 'postman' }: ImportModalProps) {
  const { importCollection, addCollection, addRequest, openTab } = useAppStore();
  const [importType, setImportType] = useState<ImportType>(initialImportType);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!fileContent) {
      setError('Please enter a cURL command or select a file');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // Handle cURL import separately
      if (importType === 'curl') {
        const request = parseCurlCommand(fileContent);
        if (!request) {
          throw new Error('Failed to parse cURL command. Please check the format.');
        }

        // Create a new collection for imported cURL requests
        const collection = addCollection('cURL Imports', 'Requests imported from cURL commands');
        const newRequest = addRequest(collection.id, null, request);

        // Open the request in a new tab
        openTab({
          type: 'request',
          title: newRequest.name,
          requestId: newRequest.id,
          collectionId: collection.id,
        });

        setSuccess(`Successfully imported cURL request "${newRequest.name}"`);
        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      }

      let collection: Collection | null = null;

      if (importType === 'postman') {
        collection = importPostmanCollection(fileContent);
      } else if (importType === 'openapi') {
        collection = importOpenAPISpec(fileContent);
      }

      if (collection) {
        importCollection(collection);
        setSuccess(`Successfully imported "${collection.name}"`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError('Failed to parse the file. Please check the format.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <h2 className="text-xl font-semibold text-fetchy-text">Import Collection</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Import type selection */}
          <div className="mb-6">
            <label className="block text-sm text-fetchy-text-muted mb-2">Import Type</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setImportType('postman')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  importType === 'postman'
                    ? 'border-fetchy-accent bg-fetchy-accent/10'
                    : 'border-fetchy-border hover:border-fetchy-accent/50'
                }`}
              >
                <FileJson className={`w-6 h-6 ${importType === 'postman' ? 'text-fetchy-accent' : 'text-orange-400'}`} />
                <div className="text-center">
                  <div className="font-medium text-fetchy-text text-sm">Postman</div>
                  <div className="text-xs text-fetchy-text-muted">v2.1 JSON</div>
                </div>
              </button>
              <button
                onClick={() => setImportType('openapi')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  importType === 'openapi'
                    ? 'border-fetchy-accent bg-fetchy-accent/10'
                    : 'border-fetchy-border hover:border-fetchy-accent/50'
                }`}
              >
                <FileJson className={`w-6 h-6 ${importType === 'openapi' ? 'text-fetchy-accent' : 'text-green-400'}`} />
                <div className="text-center">
                  <div className="font-medium text-fetchy-text text-sm">OpenAPI</div>
                  <div className="text-xs text-fetchy-text-muted">JSON/YAML</div>
                </div>
              </button>
              <button
                onClick={() => setImportType('curl')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  importType === 'curl'
                    ? 'border-fetchy-accent bg-fetchy-accent/10'
                    : 'border-fetchy-border hover:border-fetchy-accent/50'
                }`}
              >
                <Terminal className={`w-6 h-6 ${importType === 'curl' ? 'text-fetchy-accent' : 'text-purple-400'}`} />
                <div className="text-center">
                  <div className="font-medium text-fetchy-text text-sm">cURL</div>
                  <div className="text-xs text-fetchy-text-muted">Command</div>
                </div>
              </button>
            </div>
          </div>

          {/* File upload - hide for cURL */}
          {importType !== 'curl' && (
            <div className="mb-6">
              <label className="block text-sm text-fetchy-text-muted mb-2">Select File</label>
              <div
                className="border-2 border-dashed border-fetchy-border rounded-lg p-8 text-center hover:border-fetchy-accent/50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-fetchy-text-muted mx-auto mb-3" />
                {fileName ? (
                  <p className="text-fetchy-text font-medium">{fileName}</p>
                ) : (
                  <>
                    <p className="text-fetchy-text mb-1">Click to upload or drag and drop</p>
                    <p className="text-sm text-fetchy-text-muted">
                      {importType === 'postman' ? 'JSON file' : 'JSON or YAML file'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Paste content */}
          <div className="mb-6">
            <label className="block text-sm text-fetchy-text-muted mb-2">
              {importType === 'curl' ? 'Paste cURL command' : 'Or paste content directly'}
            </label>
            <textarea
              value={fileContent}
              onChange={(e) => {
                setFileContent(e.target.value);
                setFileName(e.target.value ? 'Pasted content' : '');
              }}
              placeholder={
                importType === 'curl'
                  ? 'curl -X POST "https://api.example.com/data" -H "Content-Type: application/json" -d \'{"key": "value"}\''
                  : importType === 'postman'
                    ? 'Paste your Postman collection here...'
                    : 'Paste your OpenAPI spec here...'
              }
              className={`w-full resize-none font-mono text-sm ${importType === 'curl' ? 'h-48' : 'h-32'}`}
            />
          </div>

          {/* Error/Success message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
              <Check size={18} />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!fileContent}
            className="btn btn-primary disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

