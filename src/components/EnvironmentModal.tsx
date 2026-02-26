import { useState, useRef } from 'react';
import { X, Plus, Trash2, Check, Edit2, Lock, Unlock, Download, Upload, Copy, GripVertical } from 'lucide-react';
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
        <Download size={12} />
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

  const initialVal = variable.initialValue ?? variable.value ?? '';
  const currentVal = variable.currentValue ?? '';

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
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    duplicateEnvironment,
    importEnvironment,
    reorderEnvironments,
    reorderEnvironmentVariables,
  } = useAppStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(
    activeEnvironmentId || (environments.length > 0 ? environments[0].id : null)
  );
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedEnv = environments.find(e => e.id === selectedEnvId);

  const handleAddEnvironment = () => {
    const env = addEnvironment('New Environment');
    setSelectedEnvId(env.id);
    setEditingName(env.id);
    setNewName(env.name);
  };

  const handleDuplicateEnvironment = (envId: string) => {
    const duplicated = duplicateEnvironment(envId);
    if (duplicated) {
      setSelectedEnvId(duplicated.id);
    }
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
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        // Validate the imported data
        if (data._type !== 'environment' || !data.name || !Array.isArray(data.variables)) {
          throw new Error('Invalid environment file format');
        }

        const imported = importEnvironment({
          id: '', // Will be replaced by importEnvironment
          name: data.name,
          variables: data.variables.map((v: any) => ({
            id: uuidv4(),
            key: v.key || '',
            value: v.value || '', // For backward compatibility
            initialValue: v.value || '', // Set initial value from imported value
            currentValue: '', // Start with empty current value
            enabled: v.enabled !== false,
            isSecret: v.isSecret || false,
            description: v.description || '',
          })),
        });

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
      updateEnvironment(envId, { name: newName.trim() });
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
      enabled: true
    };
    updateEnvironment(selectedEnv.id, {
      variables: [...selectedEnv.variables, newVar],
    });
  };

  const handleUpdateVariable = (varId: string, updates: Partial<KeyValue>) => {
    if (!selectedEnv) return;
    updateEnvironment(selectedEnv.id, {
      variables: selectedEnv.variables.map(v =>
        v.id === varId ? { ...v, ...updates } : v
      ),
    });
  };

  const handleDeleteVariable = (varId: string) => {
    if (!selectedEnv) return;
    updateEnvironment(selectedEnv.id, {
      variables: selectedEnv.variables.filter(v => v.id !== varId),
    });
  };

  const handleDragEndEnvironments = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = environments.findIndex(e => e.id === active.id);
    const newIndex = environments.findIndex(e => e.id === over.id);

    reorderEnvironments(oldIndex, newIndex);
  };

  const handleDragEndVariables = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedEnv) return;

    const oldIndex = selectedEnv.variables.findIndex(v => v.id === active.id);
    const newIndex = selectedEnv.variables.findIndex(v => v.id === over.id);

    reorderEnvironmentVariables(selectedEnv.id, oldIndex, newIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-4xl mx-4 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border shrink-0">
          <h2 className="text-xl font-semibold text-fetchy-text">Environments</h2>
          <button
            onClick={onClose}
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
            accept=".json"
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
              <button
                onClick={handleImportClick}
                className="btn btn-secondary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Upload size={16} /> Import
              </button>
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
              {environments.length === 0 ? (
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
                    items={environments.map(e => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {environments.map((env) => (
                      <SortableEnvironmentItem
                        key={env.id}
                        env={env}
                        isSelected={selectedEnvId === env.id}
                        isActive={activeEnvironmentId === env.id}
                        isEditing={editingName === env.id}
                        newName={newName}
                        onSelect={() => setSelectedEnvId(env.id)}
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
                          deleteEnvironment(env.id);
                          if (selectedEnvId === env.id) {
                            setSelectedEnvId(environments[0]?.id || null);
                          }
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
                      {selectedEnv.variables.length} variable{selectedEnv.variables.length !== 1 ? 's' : ''}
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
                      <Download size={14} />
                      Export
                    </button>
                    {activeEnvironmentId === selectedEnv.id ? (
                      <button
                        onClick={() => setActiveEnvironment(null)}
                        className="btn btn-secondary text-sm flex items-center gap-2"
                      >
                        <Check size={14} className="text-green-400" />
                        Active
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveEnvironment(selectedEnv.id)}
                        className="btn btn-primary text-sm"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
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
                          items={selectedEnv.variables.map(v => v.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {selectedEnv.variables.map((variable) => (
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

                  <div className="mt-6 p-4 bg-fetchy-sidebar rounded-lg">
                    <h4 className="text-sm font-medium text-fetchy-text mb-2">Initial vs Current Values</h4>
                    <p className="text-xs text-fetchy-text-muted mb-3">
                      <strong className="text-fetchy-text">Initial Value:</strong> The preset/default value that can be shared and exported.
                      <br />
                      <strong className="text-fetchy-text">Current Value:</strong> Local override value used during execution. Not exported by default.
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
            onClick={onClose}
            className="btn btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

