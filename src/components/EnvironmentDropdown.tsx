import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Settings } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface EnvironmentDropdownProps {
  onOpenSettings: () => void;
}

export default function EnvironmentDropdown({ onOpenSettings }: EnvironmentDropdownProps) {
  const { environments, activeEnvironmentId, setActiveEnvironment, getActiveEnvironment } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeEnvironment = getActiveEnvironment();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleEnvironmentChange = (envId: string | null) => {
    setActiveEnvironment(envId);
    setIsOpen(false);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onOpenSettings();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          activeEnvironment
            ? 'env-active env-active-hover'
            : 'bg-fetchy-border text-fetchy-text-muted hover:bg-fetchy-card'
        }`}
        title="Select Environment"
      >
        <Globe size={16} />
        <span className="max-w-[120px] truncate">
          {activeEnvironment ? activeEnvironment.name : 'No Environment'}
        </span>
        {activeEnvironment && (
          <span className="w-2 h-2 env-active-dot rounded-full shrink-0" />
        )}
        <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header with manage button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-fetchy-border bg-fetchy-sidebar">
            <span className="text-xs font-medium text-fetchy-text-muted uppercase">Environments</span>
            <button
              onClick={handleSettingsClick}
              className="flex items-center gap-1 px-2 py-1 text-xs text-fetchy-text-muted hover:text-fetchy-accent hover:bg-fetchy-border rounded transition-colors"
              title="Manage Environments"
            >
              <Settings size={12} />
              Manage
            </button>
          </div>

          {/* Environment list */}
          <div className="max-h-64 overflow-y-auto">
            {/* No environment option */}
            <button
              onClick={() => handleEnvironmentChange(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-fetchy-border transition-colors ${
                !activeEnvironmentId ? 'bg-fetchy-accent/10 text-fetchy-accent' : 'text-fetchy-text-muted'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {!activeEnvironmentId && (
                  <div className="w-2 h-2 bg-fetchy-accent rounded-full" />
                )}
              </div>
              <span>No Environment</span>
            </button>

            {/* Separator */}
            {environments.length > 0 && (
              <div className="border-t border-fetchy-border/50" />
            )}

            {/* Environment options */}
            {environments.map((env) => (
              <button
                key={env.id}
                onClick={() => handleEnvironmentChange(env.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-fetchy-border transition-colors ${
                  activeEnvironmentId === env.id
                    ? 'env-active-bg env-active-text'
                    : 'text-fetchy-text hover:text-fetchy-accent'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {activeEnvironmentId === env.id && (
                    <div className="w-2 h-2 env-active-dot rounded-full" />
                  )}
                </div>
                <span className="flex-1 text-left truncate">{env.name}</span>
                {env.variables && env.variables.length > 0 && (
                  <span className="text-xs text-fetchy-text-muted">
                    {env.variables.length} var{env.variables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))}

            {/* Empty state */}
            {environments.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-fetchy-text-muted">
                <p>No environments yet</p>
                <button
                  onClick={handleSettingsClick}
                  className="mt-2 text-fetchy-accent hover:underline text-xs"
                >
                  Create your first environment
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

