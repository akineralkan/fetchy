import { usePreferencesStore } from '../store/preferencesStore';

interface ConfirmDialogProps {
  title: string;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shared "Are you sure you want to delete X?" confirmation dialog used across
 * the sidebar for collections, folders, requests, and API specs (#103).
 *
 * Includes a "Don't ask me again" checkbox that turns off the
 * `confirmBeforeDelete` preference — the same preference can also be
 * re-enabled later from Settings > General.
 */
export default function ConfirmDialog({ title, itemName, onCancel, onConfirm }: ConfirmDialogProps) {
  const { preferences, savePreferences } = usePreferencesStore();
  const skipConfirmation = preferences.confirmBeforeDelete === false;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl p-6 mx-4 max-w-sm w-full">
        <h3 className="text-base font-semibold text-fetchy-text mb-2">{title}</h3>
        <p className="text-sm text-fetchy-text-muted mb-4">
          Are you sure you want to delete <span className="font-medium text-fetchy-text">"{itemName}"</span>? This action cannot be undone.
        </p>
        <label className="flex items-center gap-2 mb-5 text-xs text-fetchy-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={skipConfirmation}
            onChange={(e) => savePreferences({ confirmBeforeDelete: !e.target.checked })}
            className="w-3.5 h-3.5 rounded border-fetchy-border bg-fetchy-bg text-fetchy-accent focus:ring-fetchy-accent"
          />
          Don't ask me again
        </label>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
