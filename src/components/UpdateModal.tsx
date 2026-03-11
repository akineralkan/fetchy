import { X, Download, AlertCircle, CheckCircle, Loader2, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { compareVersions, parseReleaseEntries, type ReleaseEntry } from '../utils/updateUtils';

interface UpdateModalProps {
  onClose: () => void;
}

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface UpdateInfo {
  version?: string;
  releaseNotes?: string | { version: string; note: string }[] | null;
  releaseName?: string;
  releaseDate?: string;
  intermediateReleases?: ReleaseEntry[];
}

const CURRENT_VERSION = __APP_VERSION__;

// Electron API may not be available in browser dev mode
const api = (window as any).electronAPI;
const isElectron = !!api?.updaterCheck;

export default function UpdateModal({ onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const listenerRef = useRef<any>(null);

  // Listen for updater events pushed from the main process
  useEffect(() => {
    if (!isElectron) return;

    const listener = api.onUpdaterEvent((data: any) => {
      switch (data.event) {
        case 'checking':
          setStatus('checking');
          break;
        case 'available':
          setStatus('available');
          setUpdateInfo(data.info ?? null);
          break;
        case 'not-available':
          setStatus('not-available');
          setUpdateInfo(data.info ?? null);
          break;
        case 'downloading':
          setStatus('downloading');
          setProgress(data.progress ?? null);
          break;
        case 'downloaded':
          setStatus('downloaded');
          setUpdateInfo(data.info ?? null);
          break;
        case 'error':
          setStatus('error');
          setError(data.error ?? 'Unknown error');
          break;
      }
    });

    listenerRef.current = listener;

    return () => {
      if (listenerRef.current) {
        api.offUpdaterEvent(listenerRef.current);
      }
    };
  }, []);

  // Trigger check on mount
  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    setError(null);
    setProgress(null);
    setUpdateInfo(null);

    if (!isElectron) {
      // Fallback for browser dev mode – use GitHub API directly
      try {
        const res = await fetch('https://api.github.com/repos/AkinerAlkan94/fetchy/releases?per_page=50');
        if (!res.ok) throw new Error('Failed to fetch release info');
        const releases = await res.json();
        if (!Array.isArray(releases) || releases.length === 0) throw new Error('No releases found');
        // GitHub returns newest first
        const latest = releases[0];
        const latestVersion = (latest.tag_name ?? '').replace(/^v/, '');
        const current = CURRENT_VERSION.replace(/^v/, '');
        const hasUpdate = compareVersions(current, latestVersion);
        // All versions newer than current but older than latest (i.e. the skipped ones)
        const intermediate: ReleaseEntry[] = releases
          .slice(1)
          .filter((r: any) => compareVersions(current, (r.tag_name ?? '').replace(/^v/, '')))
          .map((r: any) => ({
            version: (r.tag_name ?? '').replace(/^v/, ''),
            note: r.body ?? '',
            releaseName: r.name,
            releaseDate: r.published_at,
          }));
        setUpdateInfo({
          version: latestVersion,
          releaseNotes: latest.body,
          releaseName: latest.name,
          releaseDate: latest.published_at,
          intermediateReleases: intermediate,
        });
        setStatus(hasUpdate ? 'available' : 'not-available');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check for updates');
        setStatus('error');
      }
      return;
    }

    // Electron native updater
    const result = await api.updaterCheck();
    if (!result.success) {
      setError(result.error ?? 'Failed to check for updates');
      setStatus('error');
    }
    // Status will be updated via the updater-event listener
  }, []);

  const handleDownload = useCallback(async () => {
    if (!isElectron) {
      // In browser dev mode, open release page
      window.open('https://github.com/AkinerAlkan94/fetchy/releases/latest', '_blank');
      return;
    }
    setProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });
    setStatus('downloading');
    const result = await api.updaterDownload();
    if (!result.success) {
      setError(result.error ?? 'Download failed');
      setStatus('error');
    }
  }, []);

  const handleInstall = useCallback(() => {
    if (isElectron) {
      api.updaterInstall();
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const releaseEntries = useMemo((): ReleaseEntry[] => {
    if (!updateInfo) return [];
    const entries = parseReleaseEntries(updateInfo.releaseNotes, {
      version: updateInfo.version,
      releaseName: updateInfo.releaseName,
      releaseDate: updateInfo.releaseDate,
      intermediateReleases: updateInfo.intermediateReleases,
    });
    if (entries.length > 0) return entries;
    // updateInfo exists but no release notes — show version badge with empty note
    return [{
      version: (updateInfo.version ?? '').replace(/^v/, ''),
      note: '',
      releaseName: updateInfo.releaseName,
      releaseDate: updateInfo.releaseDate,
    }];
  }, [updateInfo]);

  const latestEntry = releaseEntries[0] ?? null;
  const intermediateEntries = releaseEntries.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border">
          <h2 className="text-xl font-semibold text-fetchy-text">Check for Updates</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Checking */}
          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-fetchy-accent animate-spin mb-4" />
              <p className="text-fetchy-text-muted">Checking for updates...</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Error checking for updates</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={checkForUpdates}
                  className="mt-3 text-sm underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Update available */}
          {status === 'available' && updateInfo && (
            <div className="space-y-4">
              <div className="p-4 bg-fetchy-success/10 border border-fetchy-success/25 rounded-lg flex items-start gap-3 text-fetchy-success">
                <Download size={20} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">New version available!</p>
                  <p className="text-sm">
                    v{latestEntry?.version} is ready. You are currently on v{CURRENT_VERSION}.
                  </p>
                </div>
              </div>

              {/* Latest release notes */}
              {latestEntry?.note && (
                <div>
                  <h3 className="text-sm font-medium text-fetchy-text mb-1.5">
                    What's new in v{latestEntry.version}
                  </h3>
                  {latestEntry.releaseDate && (
                    <p className="text-xs text-fetchy-text-muted mb-2">
                      Released {new Date(latestEntry.releaseDate).toLocaleDateString()}
                    </p>
                  )}
                  <div
                    className="bg-fetchy-bg border border-fetchy-border rounded p-4 max-h-48 overflow-y-auto text-sm text-fetchy-text release-notes"
                    dangerouslySetInnerHTML={{ __html: latestEntry.note }}
                  />
                </div>
              )}

              {/* Intermediate releases (when skipping multiple versions) */}
              {intermediateEntries.length > 0 && (
                <IntermediateAccordion entries={intermediateEntries} currentVersion={CURRENT_VERSION} />
              )}

              <button
                onClick={handleDownload}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download &amp; Install Update
              </button>
            </div>
          )}

          {/* Downloading */}
          {status === 'downloading' && progress && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="w-10 h-10 text-fetchy-accent animate-spin mb-4" />
                <p className="text-fetchy-text font-medium mb-1">Downloading update...</p>
                <p className="text-sm text-fetchy-text-muted">
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  {progress.bytesPerSecond > 0 && ` — ${formatBytes(progress.bytesPerSecond)}/s`}
                </p>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-fetchy-border rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-fetchy-accent h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress.percent, 100).toFixed(1)}%` }}
                />
              </div>
              <p className="text-xs text-fetchy-text-muted text-center">
                {progress.percent.toFixed(1)}% complete
              </p>
            </div>
          )}

          {/* Downloaded – ready to install */}
          {status === 'downloaded' && (
            <div className="space-y-4">
              <div className="p-4 bg-fetchy-success/10 border border-fetchy-success/25 rounded-lg flex items-start gap-3 text-fetchy-success">
                <CheckCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Update downloaded!</p>
                  <p className="text-sm">
                    The update has been downloaded and is ready to install. Fetchy will restart to apply the update.
                  </p>
                </div>
              </div>

              <button
                onClick={handleInstall}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <RotateCw size={18} />
                Restart &amp; Install
              </button>
            </div>
          )}

          {/* Up to date */}
          {status === 'not-available' && (
            <div className="p-4 bg-fetchy-success/10 border border-fetchy-success/25 rounded-lg flex items-start gap-3 text-fetchy-success">
              <CheckCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">You're up to date!</p>
                <p className="text-sm">
                  You are using the latest version (v{CURRENT_VERSION}) of Fetchy.
                </p>
              </div>
            </div>
          )}

          {/* Version footer */}
          {status !== 'checking' && status !== 'idle' && (
            <div className="mt-4 pt-4 border-t border-fetchy-border">
              <p className="text-xs text-fetchy-text-muted text-center">
                Current Version: v{CURRENT_VERSION}
                {updateInfo?.version && ` • Latest Version: ${updateInfo.version}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          {status !== 'checking' && status !== 'downloading' && (
            <button onClick={checkForUpdates} className="btn btn-secondary flex items-center gap-2">
              <RotateCw size={14} />
              Re-check
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface IntermediateAccordionProps {
  entries: ReleaseEntry[];
  currentVersion: string;
}

function IntermediateAccordion({ entries, currentVersion }: IntermediateAccordionProps) {
  const [open, setOpen] = useState(false);
  const oldestVersion = entries[entries.length - 1]?.version ?? '';
  return (
    <div className="border border-fetchy-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-fetchy-sidebar hover:bg-fetchy-border/50 transition-colors text-left"
      >
        <span className="text-sm text-fetchy-text-muted">
          Changes since v{currentVersion}{' '}
          <span className="opacity-60">(v{oldestVersion} – v{entries[0]?.version})</span>
        </span>
        {open ? (
          <ChevronUp size={14} className="text-fetchy-text-muted shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-fetchy-text-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="divide-y divide-fetchy-border/50 max-h-60 overflow-y-auto">
          {entries.map((e, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-xs font-semibold text-fetchy-text-muted mb-1.5">v{e.version}</p>
              {e.note ? (
                <div
                  className="text-sm text-fetchy-text release-notes"
                  dangerouslySetInnerHTML={{ __html: e.note }}
                />
              ) : (
                <p className="text-xs text-fetchy-text-muted italic">No release notes</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



