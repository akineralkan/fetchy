import { useState } from 'react';
import { Clock, X, Filter, ArrowUpDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { RequestHistoryItem } from '../../types';
import { getMethodBgColor } from '../../utils/helpers';

interface HistoryPanelProps {
  onHistoryItemClick?: (item: RequestHistoryItem) => void;
}

type HistorySortOption = 'date-desc' | 'date-asc';
type HistoryFilterMethod = 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

export default function HistoryPanel({ onHistoryItemClick }: HistoryPanelProps) {
  const history = useAppStore(s => s.history);
  const clearHistory = useAppStore(s => s.clearHistory);
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState<HistorySortOption>('date-desc');
  const [filterMethod, setFilterMethod] = useState<HistoryFilterMethod>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const hasActiveFilters = filterMethod !== 'all' || sortOption !== 'date-desc';

  let filtered = history.filter(item => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      item.request.url.toLowerCase().includes(q) ||
      (item.request.name || '').toLowerCase().includes(q) ||
      item.request.method.toLowerCase().includes(q)
    );
    const matchesMethod = filterMethod === 'all' || item.request.method === filterMethod;
    return matchesSearch && matchesMethod;
  });

  filtered = [...filtered].sort((a, b) =>
    sortOption === 'date-asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  );

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
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-3 pr-7 py-1.5 text-sm bg-fetchy-bg border border-fetchy-border rounded focus:outline-none focus:border-fetchy-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fetchy-text-muted hover:text-fetchy-text"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(v => !v)}
            className={`p-1.5 rounded border ${
              hasActiveFilters
                ? 'bg-fetchy-accent/20 border-fetchy-accent text-fetchy-accent'
                : 'border-fetchy-border text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
          >
            <Filter size={14} />
          </button>
          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-fetchy-dropdown border border-fetchy-border rounded-lg shadow-xl py-2 min-w-[180px]">
                <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase">Filter by Method</div>
                {(['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map(method => (
                  <button
                    key={method}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${filterMethod === method ? 'text-fetchy-accent' : ''}`}
                    onClick={() => setFilterMethod(method)}
                  >
                    {method === 'all' ? 'All Methods' : method}
                    {filterMethod === method && <span className="ml-auto">✓</span>}
                  </button>
                ))}
                <hr className="my-2 border-fetchy-border" />
                <div className="px-3 py-1 text-xs font-medium text-fetchy-text-muted uppercase flex items-center gap-1">
                  <ArrowUpDown size={12} /> Sort by
                </div>
                {([
                  { value: 'date-desc', label: 'Date (Newest First)' },
                  { value: 'date-asc',  label: 'Date (Oldest First)' },
                ] as const).map(option => (
                  <button
                    key={option.value}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border flex items-center gap-2 ${sortOption === option.value ? 'text-fetchy-accent' : ''}`}
                    onClick={() => setSortOption(option.value)}
                  >
                    {option.label}
                    {sortOption === option.value && <span className="ml-auto">✓</span>}
                  </button>
                ))}
                {hasActiveFilters && (
                  <>
                    <hr className="my-2 border-fetchy-border" />
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-fetchy-border text-red-400"
                      onClick={() => {
                        setFilterMethod('all');
                        setSortOption('date-desc');
                        setShowFilterMenu(false);
                      }}
                    >
                      Clear All Filters
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
