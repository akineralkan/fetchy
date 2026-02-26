import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Layers, Settings } from 'lucide-react';
import { useWorkspacesStore } from '../store/workspacesStore';

interface WorkspaceDropdownProps {
  onOpenSettings: () => void;
}

export default function WorkspaceDropdown({ onOpenSettings }: WorkspaceDropdownProps) {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useWorkspacesStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSwitch = (id: string) => {
    setIsOpen(false);
    if (id !== activeWorkspaceId) switchWorkspace(id);
  };

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onOpenSettings();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors bg-fetchy-border text-fetchy-text-muted hover:bg-fetchy-card"
        title="Switch Workspace"
      >
        <Layers size={16} />
        <span className="max-w-[120px] truncate">
          {activeWorkspace ? activeWorkspace.name : 'No Workspace'}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-fetchy-border bg-fetchy-sidebar">
            <span className="text-xs font-medium text-fetchy-text-muted uppercase">Workspaces</span>
            <button
              onClick={handleManageClick}
              className="flex items-center gap-1 px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-accent hover:bg-fetchy-border rounded transition-colors"
              title="Manage Workspaces"
            >
              <Settings size={12} />
              Manage
            </button>
          </div>

          {/* Workspace list */}
          <div className="max-h-64 overflow-y-auto">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-fetchy-border transition-colors ${
                    isActive ? 'env-active-bg env-active-text' : 'text-fetchy-text hover:text-fetchy-accent'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {isActive && <div className="w-2 h-2 env-active-dot rounded-full" />}
                  </div>
                  <span className="flex-1 text-left truncate">{ws.name}</span>
                </button>
              );
            })}

            {workspaces.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-fetchy-text-muted">
                <p>No workspaces yet</p>
                <button
                  onClick={handleManageClick}
                  className="mt-2 text-fetchy-accent hover:underline text-xs"
                >
                  Create your first workspace
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
