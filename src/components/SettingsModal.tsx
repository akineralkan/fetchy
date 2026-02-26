import { X, Layers } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { useAppStore } from '../store/appStore';
import { useWorkspacesStore } from '../store/workspacesStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspaces: () => void;
}

export default function SettingsModal({ isOpen, onClose, onOpenWorkspaces }: SettingsModalProps) {
  const { preferences, savePreferences } = usePreferencesStore();
  const { panelLayout, setPanelLayout } = useAppStore();
  const { workspaces, activeWorkspaceId } = useWorkspacesStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  if (!isOpen) return null;
  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-fetchy-modal rounded-lg shadow-xl w-[560px] max-h-[80vh] overflow-hidden border border-fetchy-border'>
        <div className='flex items-center justify-between p-4 border-b border-[#2d2d44]'>
          <h2 className='text-lg font-semibold text-white'>Settings</h2>
          <button onClick={onClose} className='p-1 text-gray-400 hover:text-white hover:bg-[#2d2d44] rounded'><X size={18} /></button>
        </div>
        <div className='p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-120px)]'>
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-white uppercase tracking-wider'>Workspace</h3>
            <div className='flex items-center justify-between p-3 bg-[#0f0f1a] rounded border border-[#2d2d44]'>
              <div className='flex items-center gap-2 min-w-0'>
                <Layers size={16} className='text-purple-400 shrink-0' />
                <div className='min-w-0'>
                  <p className='text-sm text-white truncate'>{activeWorkspace ? activeWorkspace.name : 'Default (no workspace)'}</p>
                  {activeWorkspace && (<p className='text-xs text-gray-500 font-mono truncate'>{activeWorkspace.homeDirectory}</p>)}
                </div>
              </div>
              <button onClick={() => { onClose(); onOpenWorkspaces(); }} className='shrink-0 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors ml-3'>
                Manage Workspaces
              </button>
            </div>
            <p className='text-xs text-gray-500'>Workspaces control where your collections, environments and secret variables are stored. Use <strong className='text-gray-400'>Manage Workspaces</strong> to switch, add, remove, export or import workspaces.</p>
          </div>
          <div className='border-t border-[#2d2d44]' />
          <div className='space-y-4'>
            <h3 className='text-sm font-medium text-white uppercase tracking-wider'>General Settings</h3>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Auto-save</label><p className='text-xs text-gray-500'>Automatically save changes to collections</p></div>
                <input type='checkbox' checked={preferences.autoSave} onChange={(e) => savePreferences({ autoSave: e.target.checked })} className='w-4 h-4 rounded border-[#2d2d44] bg-[#0f0f1a] text-purple-500 focus:ring-purple-500' />
              </div>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Max History Items</label><p className='text-xs text-gray-500'>Number of request history items to keep</p></div>
                <input type='number' min={10} max={500} value={preferences.maxHistoryItems} onChange={(e) => savePreferences({ maxHistoryItems: parseInt(e.target.value) || 100 })} className='w-20 px-2 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500' />
              </div>
              <div className='flex items-center justify-between'>
                <div><label className='text-sm text-gray-300'>Panel Layout</label><p className='text-xs text-gray-500'>Position of response panel relative to request</p></div>
                <select value={panelLayout} onChange={(e) => setPanelLayout(e.target.value as 'horizontal' | 'vertical')} className='px-3 py-1 bg-[#0f0f1a] border border-[#2d2d44] rounded text-white text-sm focus:outline-none focus:border-purple-500'>
                  <option value='horizontal'>Right</option>
                  <option value='vertical'>Down</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className='flex justify-end gap-2 p-4 border-t border-[#2d2d44]'>
          <button onClick={onClose} className='px-4 py-2 text-gray-300 hover:text-white transition-colors'>Close</button>
        </div>
      </div>
    </div>
  );
}