import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  FolderOpen,
  Upload,
  Download,
  Check,
  AlertCircle,
  RefreshCw,
  Edit2,
  Layers,
  Lock,
} from 'lucide-react';
import { useWorkspacesStore } from '../store/workspacesStore';
import { Workspace } from '../types';

interface WorkspacesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'list' | 'add' | 'edit';

interface FormState {
  name: string;
  homeDirectory: string;
  secretsDirectory: string;
}

const emptyForm: FormState = { name: '', homeDirectory: '', secretsDirectory: '' };

export default function WorkspacesModal({ isOpen, onClose }: WorkspacesModalProps) {
  const {
    workspaces,
    activeWorkspaceId,
    isElectron,
    loadWorkspaces,
    addWorkspace,
    removeWorkspace,
    switchWorkspace,
    updateWorkspace,
    exportWorkspace,
    importWorkspaceFromFile,
  } = useWorkspacesStore();

  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
      setMode('list');
      setStatus(null);
      setConfirmRemoveId(null);
    }
  }, [isOpen, loadWorkspaces]);

  if (!isOpen) return null;

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    if (type === 'success') setTimeout(() => setStatus(null), 3000);
  };

  // ── Directory picker ────────────────────────────────────────────────────────
  const pickDirectory = async (field: 'homeDirectory' | 'secretsDirectory') => {
    if (!isElectron || !window.electronAPI) return;
    const title =
      field === 'homeDirectory'
        ? 'Select Home Directory (public data)'
        : 'Select Secrets Directory (secret variables)';
    const dir = await window.electronAPI.selectDirectory({ title });
    if (dir) setForm((prev) => ({ ...prev, [field]: dir }));
  };

  // ── Add workspace ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim() || !form.homeDirectory || !form.secretsDirectory) {
      showStatus('error', 'Please fill in all fields.');
      return;
    }
    setIsBusy(true);
    try {
      await addWorkspace(form.name.trim(), form.homeDirectory, form.secretsDirectory);
      showStatus('success', `Workspace "${form.name.trim()}" created.`);
      setForm(emptyForm);
      setMode('list');
    } catch (e) {
      showStatus('error', e instanceof Error ? e.message : 'Failed to add workspace.');
    } finally {
      setIsBusy(false);
    }
  };

  // ── Edit workspace ─────────────────────────────────────────────────────────
  const handleEditOpen = (ws: Workspace) => {
    setEditingId(ws.id);
    setForm({ name: ws.name, homeDirectory: ws.homeDirectory, secretsDirectory: ws.secretsDirectory });
    setMode('edit');
    setStatus(null);
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    if (!form.name.trim() || !form.homeDirectory || !form.secretsDirectory) {
      showStatus('error', 'Please fill in all fields.');
      return;
    }
    setIsBusy(true);
    try {
      await updateWorkspace(editingId, {
        name: form.name.trim(),
        homeDirectory: form.homeDirectory,
        secretsDirectory: form.secretsDirectory,
      });
      showStatus('success', 'Workspace updated.');
      setMode('list');
      setEditingId(null);
    } catch (e) {
      showStatus('error', e instanceof Error ? e.message : 'Failed to update workspace.');
    } finally {
      setIsBusy(false);
    }
  };

  // ── Remove workspace ───────────────────────────────────────────────────────
  const handleRemove = async (id: string) => {
    setIsBusy(true);
    try {
      await removeWorkspace(id);
      setConfirmRemoveId(null);
      showStatus('success', 'Workspace removed.');
    } catch (e) {
      showStatus('error', e instanceof Error ? e.message : 'Failed to remove workspace.');
    } finally {
      setIsBusy(false);
    }
  };

  // ── Export workspace ───────────────────────────────────────────────────────
  const handleExport = async (id: string) => {
    setExportingId(id);
    try {
      const result = await exportWorkspace(id);
      if (result.success) {
        showStatus('success', `Exported to ${result.filePath}`);
      } else if (result.error !== 'Cancelled') {
        showStatus('error', result.error || 'Export failed.');
      }
    } finally {
      setExportingId(null);
    }
  };

  // ── Import workspace ───────────────────────────────────────────────────────
  const handleImport = async () => {
    setIsBusy(true);
    try {
      const result = await importWorkspaceFromFile();
      if (result.success) {
        showStatus('success', 'Workspace imported successfully.');
      } else if (result.error) {
        showStatus('error', result.error);
      }
    } finally {
      setIsBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const renderForm = (title: string, onSave: () => void, onCancel: () => void) => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h3>

      {/* Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Workspace Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500"
          placeholder="e.g. My Project"
        />
      </div>

      {/* Home Directory */}
      <div>
        <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
          <FolderOpen size={12} />
          Home Directory
          <span className="text-gray-600">— collections, environments, APIs</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.homeDirectory}
            onChange={(e) => setForm((p) => ({ ...p, homeDirectory: e.target.value }))}
            className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
            placeholder="/path/to/home"
          />
          {isElectron && (
            <button
              onClick={() => pickDirectory('homeDirectory')}
              className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
              title="Browse"
            >
              <FolderOpen size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Secrets Directory */}
      <div>
        <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
          <Lock size={12} />
          Secrets Directory
          <span className="text-gray-600">— secret variable values only</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.secretsDirectory}
            onChange={(e) => setForm((p) => ({ ...p, secretsDirectory: e.target.value }))}
            className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm font-mono focus:outline-none focus:border-purple-500"
            placeholder="/path/to/secrets"
          />
          {isElectron && (
            <button
              onClick={() => pickDirectory('secretsDirectory')}
              className="px-3 py-2 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] transition-colors"
              title="Browse"
            >
              <FolderOpen size={16} />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Keep this in a secure, private location (e.g. outside version control).
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-fetchy-modal rounded-lg shadow-xl w-[640px] max-h-[85vh] overflow-hidden border border-fetchy-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2d2d44] shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Workspaces</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Status banner */}
          {status && (
            <div
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
                status.type === 'success'
                  ? 'bg-green-900/40 text-green-400 border border-green-800'
                  : 'bg-red-900/40 text-red-400 border border-red-800'
              }`}
            >
              {status.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              {status.message}
            </div>
          )}

          {/* ADD / EDIT form */}
          {mode === 'add' &&
            renderForm('New Workspace', handleAdd, () => {
              setMode('list');
              setForm(emptyForm);
              setStatus(null);
            })}

          {mode === 'edit' &&
            renderForm('Edit Workspace', handleEditSave, () => {
              setMode('list');
              setEditingId(null);
              setForm(emptyForm);
              setStatus(null);
            })}

          {/* LIST */}
          {mode === 'list' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {workspaces.length === 0
                    ? 'No workspaces yet. Create one below.'
                    : `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
                </p>
                <div className="flex gap-2">
                  {isElectron && (
                    <button
                      onClick={handleImport}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d44] text-gray-300 rounded hover:bg-[#3d3d54] text-sm transition-colors disabled:opacity-50"
                      title="Import workspace from JSON file"
                    >
                      <Upload size={14} />
                      Import
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setForm(emptyForm);
                      setStatus(null);
                      setMode('add');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm transition-colors"
                  >
                    <Plus size={14} />
                    Add Workspace
                  </button>
                </div>
              </div>

              {/* Workspace list */}
              <div className="space-y-2">
                {workspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspaceId;
                  const confirmingRemove = confirmRemoveId === ws.id;

                  return (
                    <div
                      key={ws.id}
                      className={`rounded-lg border p-4 transition-colors ${
                        isActive
                          ? 'border-purple-600 bg-purple-900/20'
                          : 'border-[#2d2d44] bg-[#0f0f1a] hover:border-[#3d3d54]'
                      }`}
                    >
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers
                            size={16}
                            className={isActive ? 'text-purple-400 shrink-0' : 'text-gray-500 shrink-0'}
                          />
                          <span className="font-medium text-white truncate">{ws.name}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => switchWorkspace(ws.id)}
                              className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                              title="Switch to this workspace"
                            >
                              Switch
                            </button>
                          )}
                          {isElectron && (
                            <button
                              onClick={() => handleExport(ws.id)}
                              disabled={exportingId === ws.id}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded transition-colors"
                              title="Export workspace to JSON"
                            >
                              {exportingId === ws.id ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleEditOpen(ws)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded transition-colors"
                            title="Edit workspace"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(ws.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#2d2d44] rounded transition-colors"
                            title="Remove workspace"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Directories */}
                      <div className="space-y-1 text-xs font-mono text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <FolderOpen size={11} className="text-gray-600 shrink-0" />
                          <span className="truncate">{ws.homeDirectory || '(default)'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Lock size={11} className="text-gray-600 shrink-0" />
                          <span className="truncate">{ws.secretsDirectory || '(default)'}</span>
                        </div>
                      </div>

                      {/* Remove confirmation */}
                      {confirmingRemove && (
                        <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
                          <p className="mb-2">Remove workspace <strong>&ldquo;{ws.name}&rdquo;</strong>? This does not delete any files on disk.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRemove(ws.id)}
                              disabled={isBusy}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-3 py-1 text-gray-400 hover:text-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info note */}
              <div className="text-xs text-gray-600 space-y-1 border-t border-[#2d2d44] pt-4">
                <p>
                  <strong className="text-gray-500">Home Directory</strong> — stores collections,
                  environments, and API documents. Safe to include in version control.
                </p>
                <p>
                  <strong className="text-gray-500">Secrets Directory</strong> — stores only the
                  values of secret variables. Keep this outside version control.
                </p>
                <p>
                  Use <strong className="text-gray-500">Export</strong> to produce a portable JSON
                  file (includes secrets). Use <strong className="text-gray-500">Import</strong> to
                  restore a workspace from such a file to chosen directories.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[#2d2d44] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
