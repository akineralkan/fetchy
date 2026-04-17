import { Globe, Braces, Server, Radio, Rss, Zap, ArrowDownToLine } from 'lucide-react';
import type { AppMode } from '../types';

interface ModeTabDef {
  id: AppMode;
  label: string;
  icon: typeof Globe;
  available: boolean;
}

const MODE_TABS: ModeTabDef[] = [
  { id: 'rest', label: 'REST', icon: Globe, available: true },
  { id: 'graphql', label: 'GraphQL', icon: Braces, available: false },
  { id: 'grpc', label: 'gRPC', icon: Server, available: false },
  { id: 'websocket', label: 'WebSocket', icon: Radio, available: false },
  { id: 'socketio', label: 'Socket.io', icon: Zap, available: false },
  { id: 'mqtt', label: 'MQTT', icon: Rss, available: false },
  { id: 'sse', label: 'SSE', icon: ArrowDownToLine, available: false },
];

interface ModeTabsProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export default function ModeTabs({ activeMode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex items-center gap-0.5 bg-fetchy-bg/50 rounded-lg p-0.5">
      {MODE_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeMode === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              transition-all duration-150 select-none
              ${isActive
                ? 'bg-fetchy-accent text-white shadow-sm shadow-fetchy-accent/25'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border/60'
              }
            `}
          >
            <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.label}</span>
            {!tab.available && !isActive && (
              <span className="ml-0.5 text-[9px] px-1 py-px rounded bg-fetchy-border text-fetchy-text-muted leading-none">
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
