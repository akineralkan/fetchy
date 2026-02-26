import { useState } from 'react';
import { FolderOpen, Lock, Layers, RefreshCw, Upload } from 'lucide-react';
import { useWorkspacesStore } from '../store/workspacesStore';

interface CreateWorkspaceScreenProps {
  /** Called after a workspace is successfully created / activated */
  onCreated: () => void;
}

interface FormState {
  name: string;
  homeDirectory: string;
  secretsDirectory: string;
}

const emptyForm: FormState = { name: '', homeDirectory: '', secretsDirectory: '' };

export default function CreateWorkspaceScreen({ onCreated }: CreateWorkspaceScreenProps) {
  const { isElectron, addWorkspace, importWorkspaceFromFile } = useWorkspacesStore();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickDirectory = async (field: 'homeDirectory' | 'secretsDirectory') => {
    if (!isElectron || !window.electronAPI) return;
    const titles: Record<typeof field, string> = {
      homeDirectory: 'Select Home Directory (collections, environments, APIs)',
      secretsDirectory: 'Select Secrets Directory (secret variable values)',
    };
    const dir = await window.electronAPI.selectDirectory({ title: titles[field] });
    if (dir) setForm((p) => ({ ...p, [field]: dir }));
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Please enter a workspace name.');
      return;
    }
    if (isElectron && (!form.homeDirectory || !form.secretsDirectory)) {
      setError('Please select both directories.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      // In browser mode directories are virtual — use a namespaced placeholder.
      const home = form.homeDirectory || ('browser:' + name + ':home');
      const secrets = form.secretsDirectory || ('browser:' + name + ':secrets');
      await addWorkspace(name, home, secrets);
      // Reload so the new workspace-scoped storage is picked up
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workspace.');
      setIsBusy(false);
    }
  };

  const handleImport = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await importWorkspaceFromFile();
      if (result.success) {
        onCreated();
      } else {
        setError(result.error || 'Import failed.');
        setIsBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setIsBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-fetchy-bg overflow-auto p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo + headline */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <img src="./logo.jpg" alt="Fetchy" className="h-12 w-12 rounded-lg shadow-lg" />
            <span className="text-3xl font-bold text-fetchy-accent">Fetchy</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Create your first workspace</h1>
          <p className="text-sm text-fetchy-text-muted max-w-sm">
            Workspaces keep your collections, environments, APIs and secrets fully isolated from one
            another. You must create one to continue.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">New workspace</span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Workspace name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder="e.g. My Project"
              autoFocus
            />
          </div>

          {/* Directories — Electron only */}
          {isElectron && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <FolderOpen size={12} />
                  Home directory *
                  <span className="text-gray-600 ml-1">— collections, environments, APIs</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.homeDirectory}
                    onChange={(e) => setForm((p) => ({ ...p, homeDirectory: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                    placeholder="/path/to/home"
                  />
                  <button
                    onClick={() => pickDirectory('homeDirectory')}
                    className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Lock size={12} />
                  Secrets directory *
                  <span className="text-gray-600 ml-1">— secret variable values only</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.secretsDirectory}
                    onChange={(e) => setForm((p) => ({ ...p, secretsDirectory: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                    placeholder="/path/to/secrets"
                  />
                  <button
                    onClick={() => pickDirectory('secretsDirectory')}
                    className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Store this outside version control to keep secrets safe.
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={isBusy}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium text-sm"
            >
              {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
              Create workspace
            </button>

            {isElectron && (
              <button
                onClick={handleImport}
                disabled={isBusy}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d2d44] text-gray-300 rounded-lg hover:bg-[#3d3d54] disabled:opacity-50 transition-colors text-sm"
              >
                <Upload size={14} />
                Import from file
              </button>
            )}
          </div>
        </div>

        {/* Info boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 space-y-1">
            <p className="font-semibold text-gray-400 flex items-center gap-1">
              <Layers size={11} /> Isolation
            </p>
            <p>
              Every workspace has its own collections, environments, history, and secrets — completely
              separated from other workspaces.
            </p>
          </div>
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 space-y-1">
            <p className="font-semibold text-gray-400 flex items-center gap-1">
              <Lock size={11} /> Security
            </p>
            <p>
              Secret variable values are stored in a separate directory so you can safely version-control
              your home directory without exposing secrets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
