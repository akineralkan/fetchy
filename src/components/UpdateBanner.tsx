import { X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import { parseReleaseEntries } from '../utils/updateUtils';

interface PostUpdateInfo {
  version?: string;
  previousVersion?: string;
  releaseName?: string;
  releaseNotes?: string | { version: string; note: string }[] | null;
  releaseDate?: string;
  updatedAt?: string;
}

interface UpdateBannerProps {
  info: PostUpdateInfo;
  onDismiss: () => void;
}

export default function UpdateBanner({ info, onDismiss }: UpdateBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const releaseEntries = useMemo(
    () => parseReleaseEntries(info.releaseNotes, { version: info.version }),
    [info],
  );
  const hasNotes = releaseEntries.some((e) => e.note);

  return (
    <div className="bg-fetchy-success/10 border-b border-fetchy-success/20 shrink-0 select-text">
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Sparkles size={16} className="text-fetchy-success shrink-0" />
        <span className="text-sm font-medium text-fetchy-text">
          Fetchy updated to {info.version ? `v${info.version.replace(/^v/, '')}` : 'a new version'}!
        </span>
        {info.updatedAt && (
          <span className="text-xs text-fetchy-text-muted">
            {new Date(info.updatedAt).toLocaleDateString()}
          </span>
        )}

        <div className="flex-1" />

        {hasNotes && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-fetchy-success hover:text-fetchy-text transition-colors"
          >
            {expanded ? 'Hide' : 'What changed?'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        <button
          onClick={onDismiss}
          className="p-1 hover:bg-fetchy-success/15 rounded text-fetchy-text-muted hover:text-fetchy-text transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Expanded changelog area (read-only) */}
      {expanded && releaseEntries.length > 0 && (
        <div className="px-4 pb-3 space-y-3">
          {/* Latest version notes */}
          {releaseEntries[0]?.note && (
            <div>
              <p className="text-xs font-semibold text-fetchy-text-muted mb-1.5">
                What's new in v{releaseEntries[0].version}
              </p>
              <div
                className="bg-fetchy-bg/60 border border-fetchy-border rounded-lg p-3 max-h-48 overflow-y-auto text-sm text-fetchy-text release-notes"
                dangerouslySetInnerHTML={{ __html: releaseEntries[0].note }}
              />
            </div>
          )}

          {/* Intermediate versions (when the user skipped multiple releases) */}
          {releaseEntries.slice(1).length > 0 && (
            <div className="border border-fetchy-border/50 rounded-lg overflow-hidden">
              <p className="text-xs text-fetchy-text-muted px-3 py-2 bg-fetchy-sidebar border-b border-fetchy-border/50">
                Earlier updates since v{info.previousVersion ?? '…'}
              </p>
              <div className="divide-y divide-fetchy-border/50 max-h-40 overflow-y-auto">
                {releaseEntries.slice(1).map((e, i) => (
                  <div key={i} className="px-3 py-2">
                    <span className="text-xs font-semibold text-fetchy-text-muted">v{e.version}</span>
                    {e.note && (
                      <div
                        className="text-xs text-fetchy-text mt-1 release-notes"
                        dangerouslySetInnerHTML={{ __html: e.note }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
