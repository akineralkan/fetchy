import { useState, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Check, Edit2, Lock, Unlock, Download, Upload, Copy, GripVertical, Zap, Sparkles, Loader2, Info } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../store/appStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { aiConvertEnvironment } from '../utils/aiImport';
import { KeyValue, Environment } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EnvironmentModalProps {
  onClose: () => void;
}

// Sortable Environment Item
function SortableEnvironmentItem({
  env,
  isSelected,
  isActive,
  isEditing,
  newName,
  onSelect,
  onStartEdit,
  onUpdateName,
  onSaveName,
  onCancelEdit,
  onDuplicate,
  onExport,
  onDelete,
}: {
  env: Environment;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  newName: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onUpdateName: (name: string) => void;
  onSaveName: () => void;
  onCancelEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: env.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer group mb-1 ${
        isSelected
          ? 'bg-fetchy-accent/20 text-fetchy-accent'
          : 'hover:bg-fetchy-border text-fetchy-text'
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-fetchy-border rounded opacity-0 group-hover:opacity-100"
      >
        <GripVertical size={14} className="text-fetchy-text-muted" />
      </button>
      {isActive && (
        <Check size={14} className="text-green-400 shrink-0" />
      )}
      {isEditing ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => onUpdateName(e.target.value)}
          onBlur={onSaveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveName();
            if (e.key === 'Escape') onCancelEdit();
          }}
          className="flex-1 bg-transparent border-b border-fetchy-accent outline-none text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm truncate">{env.name}</span>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fetchy-border rounded"
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        title="Rename"
      >
        <Edit2 size={12} />
      </button>
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fetchy-border rounded"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        title="Duplicate"
      >
        <Copy size={12} />
      </button>
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-fetchy-border rounded"
        onClick={(e) => {
          e.stopPropagation();
          onExport();
        }}
        title="Export"
      >
        <Upload size={12} />
      </button>
      <button
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// Sortable Variable Row
function SortableVariableRow({
  variable,
  onUpdate,
  onDelete,
}: {
  variable: KeyValue;
  onUpdate: (id: string, updates: Partial<KeyValue>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variable.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const initialVal = variable.initialValue || variable.value || '';
  const currentVal = variable.currentValue || '';

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-fetchy-border/50">
      <td className="p-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-fetchy-border rounded"
        >
          <GripVertical size={14} className="text-fetchy-text-muted" />
        </button>
      </td>
      <td className="p-2">
        <input
          type="checkbox"
          checked={variable.enabled}
          onChange={(e) => onUpdate(variable.id, { enabled: e.target.checked })}
          className="w-4 h-4 accent-fetchy-accent"
        />
      </td>
      <td className="p-0">
        <input
          type="text"
          value={variable.key}
          onChange={(e) => onUpdate(variable.id, { key: e.target.value })}
          placeholder="Variable name"
          className={`w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-sidebar ${variable.isSecret ? 'text-orange-400' : ''}`}
        />
      </td>
      <td className="p-0">
        <input
          type={variable.isSecret ? 'password' : 'text'}
          value={initialVal}
          onChange={(e) =>
            onUpdate(variable.id, {
              initialValue: e.target.value,
              value: e.target.value, // Keep value in sync for backward compatibility
            })
          }
          placeholder="Preset value (shared)"
          className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-sidebar"
        />
      </td>
      <td className="p-0">
        <input
          type={variable.isSecret ? 'password' : 'text'}
          value={currentVal}
          onChange={(e) =>
            onUpdate(variable.id, { currentValue: e.target.value })
          }
          placeholder="Override value (local)"
          className={`w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-sidebar ${currentVal ? 'text-fetchy-accent font-medium' : 'text-fetchy-text-muted'}`}
          title="Current value overrides initial value during execution"
        />
      </td>
      <td className="p-2 text-center">
        <button
          onClick={() => onUpdate(variable.id, { isSecret: !variable.isSecret })}
          className={`p-1.5 rounded transition-colors ${
            variable.isSecret
              ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
              : 'hover:bg-fetchy-border text-fetchy-text-muted hover:text-fetchy-text'
          }`}
          title={variable.isSecret ? 'Secret (value hidden in history)' : 'Not secret (click to make secret)'}
        >
          {variable.isSecret ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </td>
      <td className="p-2">
        <button
          onClick={() => onDelete(variable.id)}
          className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

export default function EnvironmentModal({ onClose }: EnvironmentModalProps) {
  const {
    environments,
    activeEnvironmentId,
    bulkUpdateEnvironments,
  } = useAppStore();

  // ── Draft state (not persisted until Save is clicked) ──────────────────
  const [draftEnvironments, setDraftEnvironments] = useState<Environment[]>(
    () => environments.map(e => ({ ...e, variables: [...e.variables] }))
  );
  const [draftActiveEnvId, setDraftActiveEnvId] = useState<string | null>(activeEnvironmentId);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(draftEnvironments) !== JSON.stringify(environments) ||
      draftActiveEnvId !== activeEnvironmentId,
    [draftEnvironments, draftActiveEnvId, environments, activeEnvironmentId]
  );

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(
    activeEnvironmentId || (draftEnvironments.length > 0 ? draftEnvironments[0].id : null)
  );
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [varSearchQuery, setVarSearchQuery] = useState('');
  const [deleteConfirmEnvId, setDeleteConfirmEnvId] = useState<string | null>(null);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { aiSettings } = usePreferencesStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedEnv = draftEnvironments.find(e => e.id === selectedEnvId);

  // Split variables into user-defined and script-created
  const userVariables = useMemo(
    () => (selectedEnv?.variables ?? []).filter((v: any) => !v._fromScript),
    [selectedEnv?.variables]
  );
  const scriptVariables = useMemo(
    () => (selectedEnv?.variables ?? []).filter((v: any) => v._fromScript),
    [selectedEnv?.variables]
  );

  const filteredUserVariables = useMemo(() => {
    if (!varSearchQuery) return userVariables;
    const q = varSearchQuery.toLowerCase();
    return userVariables.filter(
      v => v.key.toLowerCase().includes(q) ||
           (v.initialValue || v.value || '').toLowerCase().includes(q) ||
           (v.currentValue || '').toLowerCase().includes(q)
    );
  }, [userVariables, varSearchQuery]);

  const filteredScriptVariables = useMemo(() => {
    if (!varSearchQuery) return scriptVariables;
    const q = varSearchQuery.toLowerCase();
    return scriptVariables.filter(
      v => v.key.toLowerCase().includes(q) ||
           (v.currentValue ?? v.value ?? '').toLowerCase().includes(q)
    );
  }, [scriptVariables, varSearchQuery]);

  const handleAddEnvironment = () => {
    const env: Environment = { id: uuidv4(), name: 'New Environment', variables: [] };
    setDraftEnvironments(prev => [...prev, env]);
    setSelectedEnvId(env.id);
    setEditingName(env.id);
    setNewName(env.name);
  };

  const handleDuplicateEnvironment = (envId: string) => {
    const original = draftEnvironments.find(e => e.id === envId);
    if (!original) return;
    const duplicated: Environment = {
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      variables: original.variables.map(v => ({ ...v, id: uuidv4() })),
    };
    setDraftEnvironments(prev => [...prev, duplicated]);
    setSelectedEnvId(duplicated.id);
  };

  const updateDraftEnvironment = (id: string, updates: Partial<Environment>) => {
    setDraftEnvironments(prev =>
      prev.map(e => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const handleExportEnvironment = (env: Environment) => {
    const exportData = {
      _type: 'environment',
      name: env.name,
      variables: env.variables.map(v => ({
        key: v.key,
        value: v.initialValue ?? v.value ?? '', // Export initial value
        enabled: v.enabled,
        isSecret: v.isSecret,
        description: v.description,
      })),
    };

    const content = JSON.stringify(exportData, null, 2);
    const filename = `${env.name.replace(/\s+/g, '_')}.environment.json`;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;

        // ── AI-assisted path ──────────────────────────────────────
        if (aiAssisted) {
          setAiLoading(true);
          try {
            const { environment, error: aiErr } = await aiConvertEnvironment(aiSettings, content);
            if (aiErr || !environment) throw new Error(aiErr || 'AI conversion failed');

            setDraftEnvironments(prev => [...prev, environment]);
            setSelectedEnvId(environment.id);
            setImportSuccess(`AI imported "${environment.name}"`);
            setTimeout(() => setImportSuccess(null), 3000);
          } catch (err) {
            setImportError(err instanceof Error ? err.message : 'AI-assisted import failed');
            setTimeout(() => setImportError(null), 5000);
          } finally {
            setAiLoading(false);
          }
          return;
        }

        // ── Standard path ─────────────────────────────────────────
        const data = JSON.parse(content);

        // Validate the imported data
        if (data._type !== 'environment' || !data.name || !Array.isArray(data.variables)) {
          throw new Error('Invalid environment file format');
        }

        const imported: Environment = {
          id: uuidv4(),
          name: data.name,
          variables: data.variables.map((v: any) => ({
            id: uuidv4(),
            key: v.key || '',
            value: v.value || '',
            initialValue: v.value || '',
            currentValue: '',
            enabled: v.enabled !== false,
            isSecret: v.isSecret || false,
            description: v.description || '',
          })),
        };

        setDraftEnvironments(prev => [...prev, imported]);
        setSelectedEnvId(imported.id);
        setImportSuccess(`Successfully imported "${imported.name}"`);
        setTimeout(() => setImportSuccess(null), 3000);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to import environment');
        setTimeout(() => setImportError(null), 5000);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
      setTimeout(() => setImportError(null), 5000);
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveName = (envId: string) => {
    if (newName.trim()) {
      updateDraftEnvironment(envId, { name: newName.trim() });
    }
    setEditingName(null);
    setNewName('');
  };

  const handleAddVariable = () => {
    if (!selectedEnv) return;
    const newVar: KeyValue = {
      id: uuidv4(),
      key: '',
      value: '',
      initialValue: '',
      currentValue: '',
      enabled: true,
    };
    updateDraftEnvironment(selectedEnv.id, {
      variables: [...selectedEnv.variables, newVar],
    });
  };

  const handleUpdateVariable = (varId: string, updates: Partial<KeyValue>) => {
    if (!selectedEnv) return;
    updateDraftEnvironment(selectedEnv.id, {
      variables: selectedEnv.variables.map(v =>
        v.id === varId ? { ...v, ...updates } : v
      ),
    });
  };

  const handleDeleteVariable = (varId: string) => {
    if (!selectedEnv) return;
    updateDraftEnvironment(selectedEnv.id, {
      variables: selectedEnv.variables.filter(v => v.id !== varId),
    });
  };

  const handleDragEndEnvironments = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = draftEnvironments.findIndex(e => e.id === active.id);
    const newIndex = draftEnvironments.findIndex(e => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setDraftEnvironments(prev => {
      const next = [...prev];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      return next;
    });
  };

  const handleDragEndVariables = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedEnv) return;

    const oldIndex = selectedEnv.variables.findIndex(v => v.id === active.id);
    const newIndex = selectedEnv.variables.findIndex(v => v.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newVars = [...selectedEnv.variables];
    const [removed] = newVars.splice(oldIndex, 1);
    newVars.splice(newIndex, 0, removed);
    updateDraftEnvironment(selectedEnv.id, { variables: newVars });
  };

  const handleSave = () => {
    bulkUpdateEnvironments(draftEnvironments, draftActiveEnvId);
    onClose();
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[80vh] flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border shrink-0">
          <h2 className="text-xl font-semibold text-fetchy-text">Environments</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Hidden file input for import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept={aiAssisted ? '*' : '.json'}
            className="hidden"
          />

          {/* Environments list */}
          <div className="w-64 border-r border-fetchy-border flex flex-col bg-fetchy-sidebar">
            <div className="p-3 border-b border-fetchy-border space-y-2">
              <button
                onClick={handleAddEnvironment}
                className="btn btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={16} /> Add Environment
              </button>
              {/* Import + AI toggle — split button */}
              <div className={`flex items-stretch rounded border ${aiAssisted && aiSettings.enabled ? 'border-fetchy-accent/50' : 'border-fetchy-border'} transition-colors`}>
                <button
                  onClick={handleImportClick}
                  disabled={aiLoading}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm px-3 py-1.5 transition-colors disabled:opacity-50 rounded-l
                    ${aiAssisted && aiSettings.enabled
                      ? 'bg-fetchy-accent/10 text-fetchy-accent hover:bg-fetchy-accent/20'
                      : 'bg-fetchy-card text-fetchy-text hover:bg-fetchy-border'
                    }`}
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{aiLoading ? 'Converting...' : aiAssisted && aiSettings.enabled ? 'AI Import' : 'Import'}</span>
                </button>
                {aiSettings.enabled && (
                  <button
                    onClick={() => setAiAssisted(!aiAssisted)}
                    className={`group relative flex items-center justify-center px-2 border-l transition-colors rounded-r
                      ${aiAssisted
                        ? 'border-fetchy-accent/50 bg-fetchy-accent/10 text-fetchy-accent hover:bg-fetchy-accent/20'
                        : 'border-fetchy-border bg-fetchy-card text-fetchy-text-muted hover:text-fetchy-accent hover:bg-fetchy-border'
                      }`}
                  >
                    <Sparkles size={12} />
                    <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-full ml-2 px-3 py-2 bg-fetchy-tooltip text-fetchy-text text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      Uses AI to convert any file format<br/>into Fetchy environment format.<br/>Best-effort — minor inconsistencies possible.
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Import success/error messages */}
            {importSuccess && (
              <div className="mx-2 mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs flex items-center gap-1">
                <Check size={14} />
                <span className="truncate">{importSuccess}</span>
              </div>
            )}
            {importError && (
              <div className="mx-2 mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                {importError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {draftEnvironments.length === 0 ? (
                <p className="text-center text-fetchy-text-muted text-sm py-8">
                  No environments yet
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndEnvironments}
                >
                  <SortableContext
                    items={draftEnvironments.map(e => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {draftEnvironments.map((env) => (
                      <SortableEnvironmentItem
                        key={env.id}
                        env={env}
                        isSelected={selectedEnvId === env.id}
                        isActive={draftActiveEnvId === env.id}
                        isEditing={editingName === env.id}
                        newName={newName}
                        onSelect={() => {
                          setSelectedEnvId(env.id);
                          setVarSearchQuery('');
                        }}
                        onStartEdit={() => {
                          setEditingName(env.id);
                          setNewName(env.name);
                        }}
                        onUpdateName={setNewName}
                        onSaveName={() => handleSaveName(env.id)}
                        onCancelEdit={() => setEditingName(null)}
                        onDuplicate={() => handleDuplicateEnvironment(env.id)}
                        onExport={() => handleExportEnvironment(env)}
                        onDelete={() => {
                          setDeleteConfirmEnvId(env.id);
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Variables editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEnv ? (
              <>
                <div className="p-4 border-b border-fetchy-border flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-medium text-fetchy-text">{selectedEnv.name}</h3>
                    <p className="text-xs text-fetchy-text-muted">
                      {userVariables.length} variable{userVariables.length !== 1 ? 's' : ''}
                      {scriptVariables.length > 0 && (
                        <span className="text-yellow-400/70"> + {scriptVariables.length} script</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDuplicateEnvironment(selectedEnv.id)}
                      className="btn btn-secondary text-sm flex items-center gap-2"
                      title="Duplicate environment"
                    >
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleExportEnvironment(selectedEnv)}
                      className="btn btn-secondary text-sm flex items-center gap-2"
                      title="Export environment"
                    >
                      <Upload size={14} />
                      Export
                    </button>
                    {draftActiveEnvId === selectedEnv.id ? (
                      <button
                        onClick={() => setDraftActiveEnvId(null)}
                        className="btn btn-secondary text-sm flex items-center gap-2"
                      >
                        <Check size={14} className="text-green-400" />
                        Active
                      </button>
                    ) : (
                      <button
                        onClick={() => setDraftActiveEnvId(selectedEnv.id)}
                        className="btn btn-primary text-sm"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {/* ── Variable search ── */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={varSearchQuery}
                      onChange={(e) => setVarSearchQuery(e.target.value)}
                      placeholder="Search variables..."
                      className="w-full bg-fetchy-bg border border-fetchy-border rounded pl-3 pr-7 py-1.5 text-sm outline-none focus:border-fetchy-accent"
                    />
                    {varSearchQuery && (
                      <button
                        onClick={() => setVarSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-fetchy-text-muted hover:text-fetchy-text"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* ── User-defined variables ── */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndVariables}
                  >
                    <table className="w-full kv-table">
                      <thead>
                        <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                          <th className="w-8 p-2"></th>
                          <th className="w-8 p-2"></th>
                          <th className="p-2">Variable</th>
                          <th className="p-2">Initial Value</th>
                          <th className="p-2">Current Value</th>
                          <th className="w-16 p-2 text-center">Secret</th>
                          <th className="w-8 p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <SortableContext
                          items={filteredUserVariables.map(v => v.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {filteredUserVariables.map((variable) => (
                            <SortableVariableRow
                              key={variable.id}
                              variable={variable}
                              onUpdate={handleUpdateVariable}
                              onDelete={handleDeleteVariable}
                            />
                          ))}
                        </SortableContext>
                      </tbody>
                    </table>
                  </DndContext>
                  <button
                    onClick={handleAddVariable}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-fetchy-text-muted hover:text-fetchy-text mt-2"
                  >
                    <Plus size={14} /> Add Variable
                  </button>

                  {filteredUserVariables.length === 0 && varSearchQuery && (
                    <p className="text-center text-fetchy-text-muted text-sm py-4">
                      No variables matching "{varSearchQuery}"
                    </p>
                  )}

                  {/* ── Script-created variables (transient) ── */}
                  {filteredScriptVariables.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={14} className="text-yellow-400" />
                        <h4 className="text-sm font-medium text-yellow-400">Script Variables</h4>
                        <span className="text-xs text-fetchy-text-muted">(transient – cleared on restart)</span>
                      </div>
                      <table className="w-full kv-table">
                        <thead>
                          <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                            <th className="w-8 p-2"></th>
                            <th className="p-2">Variable</th>
                            <th className="p-2">Value</th>
                            <th className="w-8 p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredScriptVariables.map((variable) => (
                            <tr key={variable.id} className="border-b border-fetchy-border/50">
                              <td className="p-2">
                                <Zap size={12} className="text-yellow-400/60" />
                              </td>
                              <td className="p-0">
                                <input
                                  type="text"
                                  value={variable.key}
                                  readOnly
                                  className="w-full bg-transparent p-2 text-sm outline-none text-fetchy-text-muted cursor-default"
                                />
                              </td>
                              <td className="p-0">
                                <input
                                  type="text"
                                  value={variable.currentValue ?? variable.value ?? ''}
                                  readOnly
                                  className="w-full bg-transparent p-2 text-sm outline-none text-yellow-400/80 cursor-default"
                                />
                              </td>
                              <td className="p-2">
                                <button
                                  onClick={() => handleDeleteVariable(variable.id)}
                                  className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-red-400"
                                  title="Remove script variable"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-fetchy-sidebar rounded-lg">
                    <h4 className="text-sm font-medium text-fetchy-text mb-2">Initial vs Current Values</h4>
                    <p className="text-xs text-fetchy-text-muted mb-3">
                      <strong className="text-fetchy-text">Initial Value:</strong> The preset/default value. Persisted to disk, shared &amp; exported.
                      <br />
                      <strong className="text-fetchy-text">Current Value:</strong> Transient runtime override. <em>Cleared automatically on app restart.</em>
                    </p>

                    <h4 className="text-sm font-medium text-fetchy-text mb-2 mt-4">Usage</h4>
                    <p className="text-xs text-fetchy-text-muted mb-2">
                      Use variables in your requests with double angle brackets:
                    </p>
                    <code className="text-xs bg-fetchy-bg px-2 py-1 rounded text-fetchy-accent">
                      {'<<variableName>>'}
                    </code>
                    <p className="text-xs text-fetchy-text-muted mt-2">
                      Variables can be used in URLs, headers, body, and authentication fields.
                      The current value takes priority if set, otherwise the initial value is used.
                    </p>

                    <div className="mt-4 pt-4 border-t border-fetchy-border">
                      <h4 className="text-sm font-medium text-orange-400 mb-2 flex items-center gap-2">
                        <Lock size={14} /> Secret Variables
                      </h4>
                      <p className="text-xs text-fetchy-text-muted">
                        Mark variables as secret to keep their values hidden in request history.
                        Secret values will be replaced during execution but saved as{' '}
                        <code className="text-orange-400">{'<<variableName>>'}</code> in history.
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-fetchy-border">
                      <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                        <Zap size={14} /> Script Variables
                      </h4>
                      <p className="text-xs text-fetchy-text-muted">
                        Variables created or updated by pre/post-request scripts via{' '}
                        <code className="text-yellow-400">fetchy.environment.set()</code>.
                        These are transient and <em>automatically removed on app restart</em>.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-fetchy-text-muted">
                <div className="text-center">
                  <p className="mb-4">Select an environment or create a new one</p>
                  <button
                    onClick={handleAddEnvironment}
                    className="btn btn-primary text-sm"
                  >
                    Create Environment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar shrink-0">
          <button
            onClick={handleClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            Save
          </button>
        </div>

        {/* Discard confirmation dialog */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-lg">
            <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl p-6 mx-4 max-w-sm w-full">
              <h3 className="text-base font-semibold text-fetchy-text mb-2">Discard changes?</h3>
              <p className="text-sm text-fetchy-text-muted mb-5">
                You have unsaved changes. Are you sure you want to close without saving?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="btn btn-secondary"
                >
                  Keep Editing
                </button>
                <button
                  onClick={onClose}
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete environment confirmation dialog */}
        {deleteConfirmEnvId && (() => {
          const envToDelete = draftEnvironments.find(e => e.id === deleteConfirmEnvId);
          return (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-lg">
              <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl p-6 mx-4 max-w-sm w-full">
                <h3 className="text-base font-semibold text-fetchy-text mb-2">Delete Environment?</h3>
                <p className="text-sm text-fetchy-text-muted mb-5">
                  Are you sure you want to delete <span className="font-medium text-fetchy-text">"{envToDelete?.name}"</span>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirmEnvId(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setDraftEnvironments(prev => prev.filter(e => e.id !== deleteConfirmEnvId));
                      if (selectedEnvId === deleteConfirmEnvId) {
                        setSelectedEnvId(draftEnvironments.find(e => e.id !== deleteConfirmEnvId)?.id || null);
                      }
                      if (draftActiveEnvId === deleteConfirmEnvId) {
                        setDraftActiveEnvId(null);
                      }
                      setDeleteConfirmEnvId(null);
                    }}
                    className="btn bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

