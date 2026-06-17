import { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  SHORTCUT_ACTIONS,
  getEffectiveBinding,
  formatShortcutBinding,
} from '../hooks/useKeyboardShortcuts';
import { ShortcutActionId, ShortcutBinding, KeyboardShortcutsConfig } from '../types';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

const RESERVED_COMBOS: Array<{ ctrl?: boolean; shift?: boolean; alt?: boolean; key: string }> = [
  { ctrl: true, key: 'c' },
  { ctrl: true, key: 'v' },
  { ctrl: true, key: 'x' },
  { ctrl: true, key: 'z' },
  { ctrl: true, key: 'a' },
];

function isReserved(binding: ShortcutBinding): boolean {
  return RESERVED_COMBOS.some(
    r =>
      r.key.toLowerCase() === binding.key.toLowerCase() &&
      !!r.ctrl === !!binding.ctrl &&
      !!r.shift === !!binding.shift &&
      !!r.alt === !!binding.alt
  );
}

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.ctrl === !!b.ctrl &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

function detectConflict(
  newBinding: ShortcutBinding,
  currentActionId: ShortcutActionId,
  config: KeyboardShortcutsConfig
): ShortcutActionId | null {
  for (const action of SHORTCUT_ACTIONS) {
    if (action.id === currentActionId) continue;
    const existing = getEffectiveBinding(action.id, config);
    if (existing && bindingsEqual(newBinding, existing)) {
      return action.id;
    }
  }
  return null;
}

function getActionLabel(id: ShortcutActionId): string {
  return SHORTCUT_ACTIONS.find(a => a.id === id)?.label ?? id;
}

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const { preferences, updateKeyboardShortcuts } = usePreferencesStore();
  const [localConfig, setLocalConfig] = useState<KeyboardShortcutsConfig>(
    preferences.keyboardShortcuts ?? {}
  );
  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    actionId: ShortcutActionId;
    conflictsWith: ShortcutActionId;
    binding: ShortcutBinding;
  } | null>(null);
  const [reservedWarning, setReservedWarning] = useState<ShortcutActionId | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const applyConfig = useCallback(
    async (config: KeyboardShortcutsConfig) => {
      setLocalConfig(config);
      await updateKeyboardShortcuts(config);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    },
    [updateKeyboardShortcuts]
  );

  const handleApplyBinding = useCallback(
    (actionId: ShortcutActionId, binding: ShortcutBinding) => {
      const conflict = detectConflict(binding, actionId, localConfig);
      if (conflict) {
        setConflictInfo({ actionId, conflictsWith: conflict, binding });
        setRecordingId(null);
        return;
      }
      const newConfig = { ...localConfig, [actionId]: binding };
      setRecordingId(null);
      applyConfig(newConfig);
    },
    [localConfig, applyConfig]
  );

  const handleConfirmConflict = useCallback(() => {
    if (!conflictInfo) return;
    const { actionId, conflictsWith, binding } = conflictInfo;
    const newConfig: KeyboardShortcutsConfig = {
      ...localConfig,
      [actionId]: binding,
      [conflictsWith]: null, // disable the conflicting action
    };
    setConflictInfo(null);
    applyConfig(newConfig);
  }, [conflictInfo, localConfig, applyConfig]);

  const handleClearBinding = useCallback(
    (actionId: ShortcutActionId) => {
      const newConfig = { ...localConfig, [actionId]: null };
      applyConfig(newConfig);
    },
    [localConfig, applyConfig]
  );

  const handleResetBinding = useCallback(
    (actionId: ShortcutActionId) => {
      const { [actionId]: _removed, ...rest } = localConfig;
      applyConfig(rest as KeyboardShortcutsConfig);
      setReservedWarning(null);
    },
    [localConfig, applyConfig]
  );

  const handleRestoreAllDefaults = useCallback(async () => {
    setLocalConfig({});
    await updateKeyboardShortcuts({});
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, [updateKeyboardShortcuts]);

  // Global key capture when recording
  useEffect(() => {
    if (!recordingId) return;

    const handleCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (MODIFIER_KEYS.has(e.key)) return;

      if (e.key === 'Escape') {
        setRecordingId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleClearBinding(recordingId);
        setRecordingId(null);
        return;
      }

      const newBinding: ShortcutBinding = {
        ...(e.ctrlKey ? { ctrl: true } : {}),
        ...(e.shiftKey ? { shift: true } : {}),
        ...(e.altKey ? { alt: true } : {}),
        key: e.key,
      };

      if (isReserved(newBinding)) {
        setReservedWarning(recordingId);
        setRecordingId(null);
        return;
      }

      handleApplyBinding(recordingId, newBinding);
    };

    window.addEventListener('keydown', handleCapture, { capture: true });
    return () => window.removeEventListener('keydown', handleCapture, { capture: true });
  }, [recordingId, handleApplyBinding, handleClearBinding]);

  const groups = Array.from(new Set(SHORTCUT_ACTIONS.map(a => a.group)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border shrink-0">
          <div className="flex items-center gap-3">
            <Keyboard className="text-fetchy-accent" size={24} />
            <h2 className="text-xl font-semibold text-fetchy-text">Keyboard Shortcuts</h2>
            {savedFlash && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conflict warning banner */}
        {conflictInfo && (
          <div className="px-6 py-3 bg-yellow-500/10 border-b border-yellow-500/30 flex items-start gap-3">
            <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-fetchy-text">
                <span className="font-medium">{formatShortcutBinding(conflictInfo.binding)}</span> is already used by{' '}
                <span className="font-medium">{getActionLabel(conflictInfo.conflictsWith)}</span>.
              </p>
              <p className="text-xs text-fetchy-text-muted mt-0.5">
                Applying will disable that shortcut.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setConflictInfo(null)}
                className="text-xs px-2 py-1 rounded border border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConflict}
                className="text-xs px-2 py-1 rounded bg-yellow-500 text-black font-medium hover:bg-yellow-400"
              >
                Apply Anyway
              </button>
            </div>
          </div>
        )}

        {/* Reserved key warning */}
        {reservedWarning && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-fetchy-text">
                That key combination is reserved by the system and cannot be reassigned.
              </p>
            </div>
            <button
              onClick={() => setReservedWarning(null)}
              className="text-xs px-2 py-1 rounded border border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Recording hint */}
        {recordingId && (
          <div className="px-6 py-2 bg-fetchy-accent/10 border-b border-fetchy-accent/30 text-center">
            <p className="text-sm text-fetchy-accent">
              Press a key combination for <span className="font-semibold">{getActionLabel(recordingId)}</span>…
              <span className="text-fetchy-text-muted ml-2">(Esc to cancel, Delete/Backspace to clear)</span>
            </p>
          </div>
        )}

        {/* Shortcut list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {groups.map(group => (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fetchy-text-muted mb-2 px-2">
                {group}
              </h3>
              <div className="space-y-1">
                {SHORTCUT_ACTIONS.filter(a => a.group === group).map(action => {
                  const effectiveBinding = getEffectiveBinding(action.id, localConfig);
                  const isDefault = !(action.id in localConfig);
                  const isRecording = recordingId === action.id;
                  const isDisabled = action.id in localConfig && localConfig[action.id] === null;

                  return (
                    <div
                      key={action.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                        isRecording
                          ? 'bg-fetchy-accent/20 ring-1 ring-fetchy-accent'
                          : 'hover:bg-fetchy-hover'
                      }`}
                    >
                      <span className="text-sm text-fetchy-text">{action.label}</span>
                      <div className="flex items-center gap-2">
                        {/* Binding badge / recording trigger */}
                        <button
                          onClick={() => {
                            setConflictInfo(null);
                            setReservedWarning(null);
                            setRecordingId(isRecording ? null : action.id);
                          }}
                          title="Click to reassign"
                          className={`min-w-[100px] text-center px-2 py-1 rounded border text-xs font-mono transition-colors ${
                            isRecording
                              ? 'border-fetchy-accent text-fetchy-accent bg-fetchy-accent/10 animate-pulse'
                              : isDisabled
                              ? 'border-fetchy-border text-fetchy-text-muted/50 line-through'
                              : 'border-fetchy-border bg-fetchy-sidebar text-fetchy-text hover:border-fetchy-accent'
                          }`}
                        >
                          {isRecording ? '…' : formatShortcutBinding(effectiveBinding)}
                        </button>

                        {/* Clear button */}
                        {!isDisabled && (
                          <button
                            onClick={() => {
                              setConflictInfo(null);
                              setRecordingId(null);
                              handleClearBinding(action.id);
                            }}
                            title="Disable this shortcut"
                            className="p-1 rounded text-fetchy-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}

                        {/* Reset to default */}
                        {!isDefault && (
                          <button
                            onClick={() => {
                              setConflictInfo(null);
                              setRecordingId(null);
                              handleResetBinding(action.id);
                            }}
                            title="Restore default"
                            className="p-1 rounded text-fetchy-text-muted hover:text-fetchy-accent hover:bg-fetchy-accent/10 transition-colors"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Non-configurable shortcuts (informational) */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-fetchy-text-muted mb-2 px-2">
              Fixed Shortcuts
            </h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-md opacity-60">
                <span className="text-sm text-fetchy-text">Switch to Tab 1–9</span>
                <kbd className="px-2 py-1 bg-fetchy-sidebar border border-fetchy-border rounded text-xs font-mono text-fetchy-text">
                  Ctrl+1…9
                </kbd>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-md opacity-60">
                <span className="text-sm text-fetchy-text">Send Request (alt)</span>
                <kbd className="px-2 py-1 bg-fetchy-sidebar border border-fetchy-border rounded text-xs font-mono text-fetchy-text">
                  Shift+Enter
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar shrink-0">
          <button
            onClick={handleRestoreAllDefaults}
            className="flex items-center gap-2 text-sm text-fetchy-text-muted hover:text-fetchy-text transition-colors"
          >
            <RotateCcw size={14} />
            Restore All Defaults
          </button>
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}


