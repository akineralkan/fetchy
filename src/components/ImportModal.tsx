import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileJson, AlertCircle, Check, Globe, FolderOpen, Braces, Terminal } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  importPostmanCollection,
  importPostmanEnvironment,
  importOpenAPISpec,
  importHoppscotchCollection,
  importHoppscotchEnvironment,
  importBrunoCollection,
  importBrunoEnvironment,
} from '../utils/helpers';
import { parseCurlCommand } from '../utils/curlParser';
import { Collection, Environment } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportCategory = 'request' | 'collection' | 'environment';

type CollectionSource = 'postman' | 'hoppscotch' | 'bruno' | 'openapi';
type EnvironmentSource = 'postman-env' | 'hoppscotch-env' | 'bruno-env';
export type ImportSource = CollectionSource | EnvironmentSource;

interface SourceConfig {
  key: ImportSource;
  label: string;
  sublabel: string;
  icon: typeof FileJson;
  iconColor: string;
  accept: string;
  placeholder: string;
  showFileUpload: boolean;
}

const COLLECTION_SOURCES: SourceConfig[] = [
  { key: 'postman', label: 'Postman', sublabel: 'v2.1 JSON', icon: FileJson, iconColor: 'text-orange-400', accept: '.json', placeholder: 'Paste your Postman collection JSON here...', showFileUpload: true },
  { key: 'hoppscotch', label: 'Hoppscotch', sublabel: 'JSON', icon: Braces, iconColor: 'text-emerald-400', accept: '.json', placeholder: 'Paste your Hoppscotch collection JSON here...', showFileUpload: true },
  { key: 'bruno', label: 'Bruno', sublabel: 'JSON / .bru', icon: FolderOpen, iconColor: 'text-yellow-400', accept: '.json,.bru', placeholder: 'Paste your Bruno collection JSON or .bru file content here...', showFileUpload: true },
  { key: 'openapi', label: 'OpenAPI', sublabel: 'JSON / YAML', icon: Globe, iconColor: 'text-green-400', accept: '.json,.yaml,.yml', placeholder: 'Paste your OpenAPI spec (JSON or YAML) here...', showFileUpload: true },
];

const ENVIRONMENT_SOURCES: SourceConfig[] = [
  { key: 'postman-env', label: 'Postman', sublabel: 'JSON', icon: FileJson, iconColor: 'text-orange-400', accept: '.json', placeholder: 'Paste your Postman environment JSON here...', showFileUpload: true },
  { key: 'hoppscotch-env', label: 'Hoppscotch', sublabel: 'JSON', icon: Braces, iconColor: 'text-emerald-400', accept: '.json', placeholder: 'Paste your Hoppscotch environment JSON here...', showFileUpload: true },
  { key: 'bruno-env', label: 'Bruno', sublabel: 'JSON / .bru', icon: FolderOpen, iconColor: 'text-yellow-400', accept: '.json,.bru', placeholder: 'Paste your Bruno environment JSON or .bru env file content here...', showFileUpload: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isEnvironmentSource = (source: ImportSource): source is EnvironmentSource =>
  source === 'postman-env' || source === 'hoppscotch-env' || source === 'bruno-env';

const getSourceConfig = (source: ImportSource): SourceConfig => {
  const all = [...COLLECTION_SOURCES, ...ENVIRONMENT_SOURCES];
  return all.find(s => s.key === source) || COLLECTION_SOURCES[0];
};

const categoryForSource = (source: ImportSource): ImportCategory =>
  isEnvironmentSource(source) ? 'environment' : 'collection';

const CURL_PLACEHOLDER = `curl -X POST "https://api.example.com/data" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImportModalProps {
  onClose: () => void;
  initialImportType?: ImportSource;
}

export default function ImportModal({ onClose, initialImportType = 'postman' }: ImportModalProps) {
  const { importCollection, importEnvironment, collections, addCollection, addRequest, openTab } = useAppStore();

  const [category, setCategory] = useState<ImportCategory>(categoryForSource(initialImportType));
  const [source, setSource] = useState<ImportSource>(initialImportType);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConfig = getSourceConfig(source);
  const sources = category === 'collection' ? COLLECTION_SOURCES : ENVIRONMENT_SOURCES;

  const [curlInput, setCurlInput] = useState('');

  // Reset state when switching category
  const handleCategoryChange = useCallback((cat: ImportCategory) => {
    setCategory(cat);
    if (cat === 'request') {
      setCurlInput('');
    } else {
      setSource(cat === 'collection' ? 'postman' : 'postman-env');
    }
    setFileContent('');
    setFileName('');
    setError(null);
    setSuccess(null);
  }, []);

  // Reset content when switching source
  const handleSourceChange = useCallback((s: ImportSource) => {
    setSource(s);
    setFileContent('');
    setFileName('');
    setError(null);
    setSuccess(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const handleImport = useCallback(() => {
    // ── Request (cURL) import ───────────────────────────────────────────
    if (category === 'request') {
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
      return;
    }

    if (!fileContent) {
      setError('Please select a file or paste content');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // ── Collection imports ──────────────────────────────────────────────
      if (source === 'postman') {
        const collection: Collection | null = importPostmanCollection(fileContent);
        if (!collection) throw new Error('Failed to parse the Postman collection.');
        importCollection(collection);
        setSuccess(`Successfully imported collection "${collection.name}"`);
        setTimeout(onClose, 1500);
        return;
      }

      if (source === 'openapi') {
        const collection: Collection | null = importOpenAPISpec(fileContent);
        if (!collection) throw new Error('Failed to parse the OpenAPI spec.');
        importCollection(collection);
        setSuccess(`Successfully imported collection "${collection.name}"`);
        setTimeout(onClose, 1500);
        return;
      }

      if (source === 'hoppscotch') {
        const collections: Collection[] = importHoppscotchCollection(fileContent);
        for (const c of collections) importCollection(c);
        const names = collections.map(c => c.name).join(', ');
        setSuccess(`Successfully imported ${collections.length} collection(s): ${names}`);
        setTimeout(onClose, 1500);
        return;
      }

      if (source === 'bruno') {
        const collection: Collection = importBrunoCollection(fileContent);
        importCollection(collection);
        setSuccess(`Successfully imported collection "${collection.name}"`);
        setTimeout(onClose, 1500);
        return;
      }

      // ── Environment imports ─────────────────────────────────────────────
      if (source === 'postman-env') {
        const envs: Environment[] = importPostmanEnvironment(fileContent);
        for (const env of envs) importEnvironment(env);
        const names = envs.map(e => e.name).join(', ');
        setSuccess(`Successfully imported ${envs.length} environment(s): ${names}`);
        setTimeout(onClose, 1500);
        return;
      }

      if (source === 'hoppscotch-env') {
        const envs: Environment[] = importHoppscotchEnvironment(fileContent);
        for (const env of envs) importEnvironment(env);
        const names = envs.map(e => e.name).join(', ');
        setSuccess(`Successfully imported ${envs.length} environment(s): ${names}`);
        setTimeout(onClose, 1500);
        return;
      }

      if (source === 'bruno-env') {
        const envs: Environment[] = importBrunoEnvironment(fileContent);
        for (const env of envs) importEnvironment(env);
        const names = envs.map(e => e.name).join(', ');
        setSuccess(`Successfully imported ${envs.length} environment(s): ${names}`);
        setTimeout(onClose, 1500);
        return;
      }

      setError('Unknown import source');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [fileContent, curlInput, source, category, onClose, importCollection, importEnvironment, collections, addCollection, addRequest, openTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <h2 className="text-xl font-semibold text-fetchy-text">Import</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Category tabs */}
          <div className="mb-5 flex gap-1 p-1 bg-fetchy-input rounded-lg">
            {(['request', 'collection', 'environment'] as ImportCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  category === cat
                    ? 'bg-fetchy-accent text-white shadow-sm'
                    : 'text-fetchy-text-muted hover:text-fetchy-text'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {category === 'request' ? (
            /* ── Request (cURL) import ──────────────────────────────── */
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-fetchy-text-muted">Paste a cURL command below to import it as a new request.</span>
              </div>
              <label className="block text-sm text-fetchy-text-muted mb-2">cURL Command</label>
              <textarea
                value={curlInput}
                onChange={(e) => {
                  setCurlInput(e.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                placeholder={CURL_PLACEHOLDER}
                className="w-full resize-none font-mono text-sm h-48"
              />
            </div>
          ) : (
            /* ── Collection / Environment import ───────────────────── */
            <>
              {/* Source selection grid */}
              <div className="mb-5">
                <label className="block text-sm text-fetchy-text-muted mb-2">Source</label>
                <div className={`grid gap-3 ${sources.length <= 3 ? 'grid-cols-3' : sources.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
                  {sources.map((cfg) => {
                    const Icon = cfg.icon;
                    const isActive = source === cfg.key;
                    return (
                      <button
                        key={cfg.key}
                        onClick={() => handleSourceChange(cfg.key)}
                        className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                          isActive
                            ? 'border-fetchy-accent bg-fetchy-accent/10'
                            : 'border-fetchy-border hover:border-fetchy-accent/50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-fetchy-accent' : cfg.iconColor}`} />
                        <div className="text-center">
                          <div className="font-medium text-fetchy-text text-xs">{cfg.label}</div>
                          <div className="text-[10px] text-fetchy-text-muted leading-tight">{cfg.sublabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File upload */}
              {currentConfig.showFileUpload && (
                <div className="mb-5">
                  <label className="block text-sm text-fetchy-text-muted mb-2">Select File</label>
                  <div
                    className="border-2 border-dashed border-fetchy-border rounded-lg p-6 text-center hover:border-fetchy-accent/50 cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={currentConfig.accept}
                      onChange={handleFileSelect}
                      className="hidden"
                      key={source} // reset input when source changes
                    />
                    <Upload className="w-8 h-8 text-fetchy-text-muted mx-auto mb-2" />
                    {fileName ? (
                      <p className="text-fetchy-text font-medium text-sm">{fileName}</p>
                    ) : (
                      <>
                        <p className="text-fetchy-text text-sm mb-1">Click to upload or drag and drop</p>
                        <p className="text-xs text-fetchy-text-muted">{currentConfig.sublabel} file</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Paste content */}
              <div className="mb-5">
                <label className="block text-sm text-fetchy-text-muted mb-2">
                  {currentConfig.showFileUpload ? 'Or paste content directly' : 'Paste content'}
                </label>
                <textarea
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                    setFileName(e.target.value ? 'Pasted content' : '');
                    setError(null);
                    setSuccess(null);
                  }}
                  placeholder={currentConfig.placeholder}
                  className={`w-full resize-none font-mono text-sm h-28`}
                />
              </div>
            </>
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
            disabled={category === 'request' ? !curlInput.trim() : !fileContent}
            className="btn btn-primary disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

