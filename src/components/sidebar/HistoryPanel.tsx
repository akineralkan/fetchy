import { Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { RequestHistoryItem } from '../../types';
import { getMethodBgColor } from '../../utils/helpers';

interface HistoryPanelProps {
  onHistoryItemClick?: (item: RequestHistoryItem) => void;
  search: string;
  filterMethod: 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  sortOption: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'method';
}

function formatHistoryTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatResponseSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HistoryPanel({ onHistoryItemClick, search, filterMethod, sortOption }: HistoryPanelProps) {
  const history = useAppStore(s => s.history);
  const clearHistory = useAppStore(s => s.clearHistory);

  const filtered = history
    .filter(item => {
      const matchesMethod = filterMethod === 'all' || item.request.method === filterMethod;
      const matchesSearch = !search || item.request.url.toLowerCase().includes(search.toLowerCase()) || (item.request.name || '').toLowerCase().includes(search.toLowerCase());
      return matchesMethod && matchesSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'date-asc') return a.timestamp - b.timestamp;
      if (sortOption === 'date-desc') return b.timestamp - a.timestamp;
      const nameA = (a.request.name || a.request.url).toLowerCase();
      const nameB = (b.request.name || b.request.url).toLowerCase();
      if (sortOption === 'name-asc') return nameA.localeCompare(nameB);
      if (sortOption === 'name-desc') return nameB.localeCompare(nameA);
      if (sortOption === 'method') return a.request.method.localeCompare(b.request.method);
      return 0;
    });

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-fetchy-text-muted">
        <Clock size={32} className="mx-auto mb-4 opacity-50" />
        <p className="text-sm mb-2">No request history yet</p>
        <p className="text-xs">Your past requests will appear here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-fetchy-text-muted">{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
        <button
          onClick={clearHistory}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Clear All
        </button>
      </div>
      {filtered.map(item => (
        <div
          key={item.id}
          className="tree-item px-2 py-2 cursor-pointer group rounded hover:bg-fetchy-border mb-1 border border-transparent hover:border-fetchy-border"
          title={`${item.request.method} ${item.request.url}\nClick to load this request and response`}
          onClick={() => onHistoryItemClick?.(item)}
        >
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(item.request.method)}`}>
              {item.request.method}
            </span>
            <span className="text-sm text-fetchy-text truncate flex-1">{item.request.name || item.request.url}</span>
            <span className="text-xs text-fetchy-text-muted whitespace-nowrap">
              {formatHistoryTime(item.timestamp)}
            </span>
          </div>
          <div className="text-xs text-fetchy-text-muted truncate mt-1 ml-7">
            {item.request.url}
          </div>
          {item.response && (
            <div className="flex items-center gap-3 mt-1 ml-7 text-xs">
              <span className={`font-medium ${item.response.status >= 200 && item.response.status < 300 ? 'text-green-400' : item.response.status >= 400 ? 'text-red-400' : 'text-yellow-400'}`}>
                {item.response.status} {item.response.statusText}
              </span>
              <span className="text-fetchy-text-muted">{item.response.time}ms</span>
              <span className="text-fetchy-text-muted">{formatResponseSize(item.response.size)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
