import { X, Keyboard } from 'lucide-react';
import { keyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <div className="flex items-center gap-3">
            <Keyboard className="text-fetchy-accent" size={24} />
            <h2 className="text-xl font-semibold text-fetchy-text">Keyboard Shortcuts</h2>
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
          <div className="space-y-3">
            {keyboardShortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-fetchy-border/50 last:border-0"
              >
                <span className="text-fetchy-text-muted">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-fetchy-sidebar border border-fetchy-border rounded text-sm font-mono text-fetchy-text">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          <button onClick={onClose} className="btn btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

