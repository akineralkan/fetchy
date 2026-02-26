import { useState, useRef, useEffect } from 'react';
import { Copy, Check, Edit2, Plus, X, Lock, Unlock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { KeyValue } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface VariableTooltipProps {
  variableName: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function VariableTooltip({ variableName, position, onClose }: VariableTooltipProps) {
  const { getActiveEnvironment, environments, activeEnvironmentId, updateEnvironment } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState(activeEnvironmentId || '');
  const [isSecret, setIsSecret] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeEnvironment = getActiveEnvironment();
  const variable = activeEnvironment?.variables.find(v => v.key === variableName && v.enabled);
  const isDefined = !!variable;
  const isSecretVar = variable?.isSecret || false;
  // Get effective value: currentValue takes priority, then value, then initialValue
  const value = variable?.currentValue || variable?.value || variable?.initialValue || '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    // Close tooltip when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleEdit = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!activeEnvironment || !variable) return;

    const updatedVariables = activeEnvironment.variables.map(v =>
      v.id === variable.id ? { ...v, currentValue: editValue } : v
    );

    updateEnvironment(activeEnvironment.id, { variables: updatedVariables });
    setIsEditing(false);
  };

  const handleAddVariable = () => {
    if (!selectedEnvId) return;

    const env = environments.find(e => e.id === selectedEnvId);
    if (!env) return;

    const newVariable: KeyValue = {
      id: uuidv4(),
      key: variableName,
      value: editValue || '',
      initialValue: editValue || '',
      currentValue: '',
      enabled: true,
      isSecret: isSecret,
    };

    updateEnvironment(selectedEnvId, {
      variables: [...env.variables, newVariable],
    });

    setIsAdding(false);
    onClose();
  };

  // Calculate tooltip position to keep it within viewport
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: position.y + 20,
    zIndex: 9999,
  };

  return (
    <div
      ref={tooltipRef}
      className="bg-fetchy-tooltip border border-fetchy-border rounded-lg shadow-xl min-w-[280px] max-w-[400px] overflow-hidden"
      style={tooltipStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-fetchy-card border-b border-fetchy-border">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm ${isSecretVar ? 'text-orange-400' : 'text-purple-400'}`}>{`<<${variableName}>>`}</span>
          {isDefined ? (
            <>
              <span className="text-xs px-1.5 py-0.5 var-defined rounded">defined</span>
              {isSecretVar && (
                <span className="text-xs px-1.5 py-0.5 var-secret rounded flex items-center gap-1">
                  <Lock size={10} /> secret
                </span>
              )}
            </>
          ) : (
            <span className="text-xs px-1.5 py-0.5 var-undefined rounded">undefined</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {isDefined ? (
          <>
            {/* Environment info */}
            <div className="text-xs text-fetchy-text-muted mb-2">
              From: <span className="env-active-text">{activeEnvironment?.name}</span>
            </div>

            {/* Value display/edit */}
            {isEditing ? (
              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  className="w-full px-2 py-1.5 bg-fetchy-bg border border-fetchy-border rounded text-sm text-fetchy-text font-mono focus:outline-none focus:border-fetchy-accent"
                  placeholder="Enter value..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-fetchy-bg rounded px-2 py-1.5 mb-3">
                  <code className="text-sm text-fetchy-success break-all">
                    {value || <span className="text-fetchy-text-muted italic">empty</span>}
                  </code>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-fetchy-card hover:bg-fetchy-border rounded text-fetchy-text transition-colors"
                    disabled={!value}
                  >
                    {copied ? <Check size={12} className="text-fetchy-success" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-fetchy-card hover:bg-fetchy-border rounded text-fetchy-text transition-colors"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Undefined variable - offer to add */}
            {!isAdding ? (
              <div className="space-y-3">
                <p className="text-sm text-yellow-300">
                  This variable is not defined in the current environment.
                </p>
                {environments.length > 0 ? (
                  <button
                    onClick={() => {
                      setIsAdding(true);
                      setSelectedEnvId(activeEnvironmentId || environments[0]?.id || '');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
                  >
                    <Plus size={14} />
                    Add to Environment
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">
                    Create an environment first to add variables.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Environment</label>
                  <select
                    value={selectedEnvId}
                    onChange={(e) => setSelectedEnvId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-fetchy-bg border border-fetchy-border rounded text-sm text-fetchy-text focus:outline-none focus:border-fetchy-accent"
                  >
                    {environments.map(env => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Value</label>
                  <input
                    type={isSecret ? 'password' : 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddVariable();
                      if (e.key === 'Escape') setIsAdding(false);
                    }}
                    className="w-full px-2 py-1.5 bg-fetchy-bg border border-fetchy-border rounded text-sm text-fetchy-text font-mono focus:outline-none focus:border-fetchy-accent"
                    placeholder="Enter value..."
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSecret(!isSecret)}
                    className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                      isSecret
                        ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                        : 'bg-fetchy-card text-fetchy-text-muted hover:bg-fetchy-border hover:text-fetchy-text'
                    }`}
                  >
                    {isSecret ? <Lock size={12} /> : <Unlock size={12} />}
                    {isSecret ? 'Secret' : 'Not Secret'}
                  </button>
                  <span className="text-xs text-fetchy-text-muted">
                    {isSecret ? 'Value hidden in history' : 'Value visible in history'}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddVariable}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Add Variable
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

