import { Construction } from 'lucide-react';
import type { AppMode } from '../types';

const MODE_LABELS: Record<AppMode, string> = {
  rest: 'REST API',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  websocket: 'WebSocket',
  mqtt: 'MQTT',
  socketio: 'Socket.io',
  sse: 'Server-Sent Events',
};

interface ComingSoonViewProps {
  mode: AppMode;
}

export default function ComingSoonView({ mode }: ComingSoonViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-fetchy-bg text-fetchy-text">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-fetchy-card flex items-center justify-center">
          <Construction size={32} className="text-fetchy-accent" />
        </div>
        <h2 className="text-2xl font-bold">{MODE_LABELS[mode]}</h2>
        <p className="text-fetchy-text-muted text-sm leading-relaxed">
          {MODE_LABELS[mode]} support is coming soon. We&#39;re working hard to bring you a
          first-class {MODE_LABELS[mode]} experience right here in Fetchy.
        </p>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fetchy-card text-fetchy-accent text-xs font-semibold">
          <Construction size={14} />
          Coming Soon
        </span>
      </div>
    </div>
  );
}
