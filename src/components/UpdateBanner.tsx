import { X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';

interface PostUpdateInfo {
  version?: string;
  releaseName?: string;
  releaseNotes?: string | { note: string }[] | null;
  releaseDate?: string;
  updatedAt?: string;
  changelog?: string | null; // human-friendly changelog from the release
}

interface UpdateBannerProps {
  info: PostUpdateInfo;
  onDismiss: () => void;
}

export default function UpdateBanner({ info, onDismiss }: UpdateBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const notes = useMemo(() => {
    // Prefer the structured changelog if present
    if (info.changelog) return info.changelog;
    if (!info.releaseNotes) return null;
    if (typeof info.releaseNotes === 'string') return info.releaseNotes;
    if (Array.isArray(info.releaseNotes)) {
      return info.releaseNotes
        .map((n: any) => (typeof n === 'string' ? n : n.note))
        .join('\n');
    }
    return null;
  }, [info]);

  return (
    <div className="bg-gradient-to-r from-green-500/15 via-emerald-500/10 to-teal-500/15 border-b border-green-500/30 shrink-0 select-text">
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Sparkles size={16} className="text-green-400 shrink-0" />
        <span className="text-sm font-medium text-green-300">
          Fetchy updated to {info.version ? `v${info.version.replace(/^v/, '')}` : 'a new version'}!
        </span>
        {info.updatedAt && (
          <span className="text-xs text-fetchy-text-muted">
            {new Date(info.updatedAt).toLocaleDateString()}
          </span>
        )}

        <div className="flex-1" />

        {notes && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            {expanded ? 'Hide' : 'What changed?'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        <button
          onClick={onDismiss}
          className="p-1 hover:bg-green-500/20 rounded text-fetchy-text-muted hover:text-fetchy-text transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Expanded changelog area (read-only) */}
      {expanded && notes && (
        <div className="px-4 pb-3">
          <div
            className="bg-fetchy-bg/60 border border-fetchy-border rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-fetchy-text release-notes"
            dangerouslySetInnerHTML={{ __html: notes }}
          />
        </div>
      )}
    </div>
  );
}
