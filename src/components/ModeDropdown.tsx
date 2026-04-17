import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Braces, Server, Radio, Rss, Zap, ArrowDownToLine } from 'lucide-react';
import type { AppMode } from '../types';

interface ModeDefinition {
  id: AppMode;
  label: string;
  description: string;
  icon: typeof Globe;
  available: boolean;
}

const MODES: ModeDefinition[] = [
  { id: 'rest',      label: 'REST API',             description: 'HTTP request/response',         icon: Globe,           available: true  },
  { id: 'graphql',   label: 'GraphQL',              description: 'Query & mutation API',          icon: Braces,          available: false },
  { id: 'grpc',      label: 'gRPC',                 description: 'Remote procedure calls',        icon: Server,          available: false },
  { id: 'websocket', label: 'WebSocket',            description: 'Full-duplex connections',       icon: Radio,           available: false },
  { id: 'socketio',  label: 'Socket.io',            description: 'Event-driven real-time',        icon: Zap,             available: false },
  { id: 'mqtt',      label: 'MQTT',                 description: 'Publish / subscribe messaging', icon: Rss,             available: false },
  { id: 'sse',       label: 'Server-Sent Events',   description: 'One-way server stream',         icon: ArrowDownToLine, available: false },
];

interface ModeDropdownProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export default function ModeDropdown({ activeMode, onModeChange }: ModeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeDef = MODES.find((m) => m.id === activeMode)!;
  const ActiveIcon = activeDef.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (mode: AppMode) => {
    onModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors bg-fetchy-accent/15 text-fetchy-accent hover:bg-fetchy-accent/25"
        title="Switch Mode"
      >
        <ActiveIcon size={15} strokeWidth={2.5} />
        <span className="max-w-[140px] truncate">{activeDef.label}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-fetchy-border bg-fetchy-sidebar">
            <span className="text-xs font-semibold text-fetchy-text-muted uppercase tracking-wide">Select Mode</span>
          </div>

          {/* Mode list */}
          <div className="py-1">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  onClick={() => mode.available ? handleSelect(mode.id) : undefined}
                  disabled={!mode.available && !isActive}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                    ${isActive
                      ? 'bg-fetchy-accent/10 text-fetchy-accent'
                      : mode.available
                        ? 'text-fetchy-text hover:bg-fetchy-border hover:text-fetchy-accent'
                        : 'text-fetchy-text-muted cursor-default opacity-60'
                    }
                  `}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-md shrink-0
                    bg-fetchy-bg border border-fetchy-border">
                    <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium leading-tight truncate">{mode.label}</div>
                    <div className="text-xs text-fetchy-text-muted leading-tight mt-0.5 truncate">
                      {mode.description}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-fetchy-accent" />
                    )}
                    {!mode.available && !isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-fetchy-border text-fetchy-text-muted font-medium leading-none">
                        Soon
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
