import { X, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface UpdateModalProps {
  onClose: () => void;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
}

const CURRENT_VERSION = __APP_VERSION__;
const GITHUB_REPO = 'AkinerAlkan94/fetchy';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export default function UpdateModal({ onClose }: UpdateModalProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const compareVersions = (current: string, latest: string): boolean => {
    // Remove 'v' prefix if present
    const cleanCurrent = current.replace(/^v/, '');
    const cleanLatest = latest.replace(/^v/, '');

    const currentParts = cleanCurrent.split('.').map(Number);
    const latestParts = cleanLatest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const curr = currentParts[i] || 0;
      const lat = latestParts[i] || 0;

      if (lat > curr) return true;
      if (lat < curr) return false;
    }

    return false;
  };

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(GITHUB_API_URL);

      if (!response.ok) {
        throw new Error('Failed to fetch release information');
      }

      const release: GitHubRelease = await response.json();
      setLatestRelease(release);

      // Compare versions
      const updateAvailable = compareVersions(CURRENT_VERSION, release.tag_name);
      setHasUpdate(updateAvailable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenReleasePage = () => {
    if (latestRelease) {
      window.open(latestRelease.html_url, '_blank');
    }
  };

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
          {isChecking && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-fetchy-accent animate-spin mb-4" />
              <p className="text-fetchy-text-muted">Checking for updates...</p>
            </div>
          )}

          {error && !isChecking && (
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

          {!isChecking && !error && hasUpdate && latestRelease && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3 text-green-400">
                <Download size={20} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">New version available!</p>
                  <p className="text-sm">
                    Version {latestRelease.tag_name} is now available. You are currently using version v{CURRENT_VERSION}.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-fetchy-text mb-2">Release: {latestRelease.name}</h3>
                <div className="text-sm text-fetchy-text-muted mb-2">
                  Released on {new Date(latestRelease.published_at).toLocaleDateString()}
                </div>
                <div className="bg-fetchy-bg border border-fetchy-border rounded p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm text-fetchy-text whitespace-pre-wrap font-mono">
                    {latestRelease.body || 'No release notes available.'}
                  </pre>
                </div>
              </div>

              <button
                onClick={handleOpenReleasePage}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Latest Version
              </button>
            </div>
          )}

          {!isChecking && !error && !hasUpdate && latestRelease && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3 text-green-400">
              <CheckCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">You're up to date!</p>
                <p className="text-sm">
                  You are using the latest version (v{CURRENT_VERSION}) of Fetchy.
                </p>
              </div>
            </div>
          )}

          {!isChecking && !error && (
            <div className="mt-4 pt-4 border-t border-fetchy-border">
              <p className="text-xs text-fetchy-text-muted text-center">
                Current Version: v{CURRENT_VERSION}
                {latestRelease && ` • Latest Version: ${latestRelease.tag_name}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

