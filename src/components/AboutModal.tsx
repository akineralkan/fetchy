import { X, Info, Github, Heart, ExternalLink } from 'lucide-react';

declare const __APP_VERSION__: string;

interface AboutModalProps {
  onClose: () => void;
}

interface Dependency {
  name: string;
  version: string;
  url: string;
}

const OPEN_SOURCE_DEPS: Dependency[] = [
  { name: 'React', version: '18.x', url: 'https://github.com/facebook/react' },
  { name: 'Electron', version: '40.x', url: 'https://github.com/electron/electron' },
  { name: 'TypeScript', version: '5.x', url: 'https://github.com/microsoft/TypeScript' },
  { name: 'Vite', version: '4.x', url: 'https://github.com/vitejs/vite' },
  { name: 'Tailwind CSS', version: '3.x', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'Zustand', version: '4.x', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Immer', version: '10.x', url: 'https://github.com/immerjs/immer' },
  { name: 'CodeMirror', version: '6.x', url: 'https://github.com/codemirror/codemirror.next' },
  { name: 'dnd-kit', version: '6.x', url: 'https://github.com/clauderic/dnd-kit' },
  { name: 'Lucide React', version: '0.358.x', url: 'https://github.com/lucide-icons/lucide' },
  { name: 'Vitest', version: '0.34.x', url: 'https://github.com/vitest-dev/vitest' },
  { name: 'uuid', version: '9.x', url: 'https://github.com/uuidjs/uuid' },
  { name: 'js-yaml', version: '4.x', url: 'https://github.com/nodeca/js-yaml' },
];

export default function AboutModal({ onClose }: AboutModalProps) {
  const currentYear = new Date().getFullYear();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fetchy-border shrink-0">
          <div className="flex items-center gap-3">
            <Info className="text-fetchy-accent" size={24} />
            <h2 className="text-xl font-semibold text-fetchy-text">About Fetchy</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* App identity */}
          <div className="flex flex-col items-center gap-3 py-6 px-6 border-b border-fetchy-border">
            <img src="./logo.jpg" alt="Fetchy" className="h-16 w-16 rounded-xl shadow-md" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-fetchy-accent">Fetchy</h1>
              <p className="text-sm text-fetchy-text-muted mt-1">Privacy-focused, self-hosted REST API client</p>
              <p className="text-xs text-fetchy-text-muted italic mt-0.5">Local by design. Reliable by nature.</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-fetchy-text-muted">
              <span className="px-2 py-1 bg-fetchy-sidebar border border-fetchy-border rounded font-mono">
                v{__APP_VERSION__}
              </span>
              <span>© {currentYear} Fetchy</span>
              <span className="px-2 py-1 bg-fetchy-sidebar border border-fetchy-border rounded">
                MIT License
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-fetchy-border">
            <p className="text-sm text-fetchy-text leading-relaxed">
              Fetchy is a privacy-first, 100% local REST API client. No cloud sync, no telemetry,
              no data leaves your machine. Built for developers who care about privacy and reliability.
            </p>
          </div>

          {/* Links */}
          <div className="px-6 py-4 border-b border-fetchy-border">
            <h3 className="text-sm font-semibold text-fetchy-text mb-3">Links</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.electronAPI?.openExternalUrl('https://github.com/akineralkan/fetchy')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fetchy-sidebar border border-fetchy-border rounded text-sm text-fetchy-text hover:border-fetchy-accent hover:text-fetchy-accent transition-colors"
              >
                <Github size={14} />
                GitHub Repository
                <ExternalLink size={12} className="text-fetchy-text-muted" />
              </button>
              <button
                onClick={() => window.electronAPI?.openExternalUrl('https://akineralkan.github.io/fetchy/')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fetchy-sidebar border border-fetchy-border rounded text-sm text-fetchy-text hover:border-fetchy-accent hover:text-fetchy-accent transition-colors"
              >
                Documentation
                <ExternalLink size={12} className="text-fetchy-text-muted" />
              </button>
              <button
                onClick={() => window.electronAPI?.openExternalUrl('https://github.com/AkinerAlkan94/fetchy/blob/main/LICENSE')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fetchy-sidebar border border-fetchy-border rounded text-sm text-fetchy-text hover:border-fetchy-accent hover:text-fetchy-accent transition-colors"
              >
                MIT License
                <ExternalLink size={12} className="text-fetchy-text-muted" />
              </button>
            </div>
          </div>

          {/* Contributors */}
          <div className="px-6 py-4 border-b border-fetchy-border">
            <h3 className="text-sm font-semibold text-fetchy-text mb-3 flex items-center gap-2">
              <Heart size={14} className="text-red-400" />
              Contributors
            </h3>
            <p className="text-sm text-fetchy-text-muted">
              Built with love by the Fetchy community. Special thanks to all contributors who help
              make Fetchy better.
            </p>
            <button
              onClick={() => window.electronAPI?.openExternalUrl('https://github.com/AkinerAlkan94/fetchy/graphs/contributors')}
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-fetchy-accent hover:underline"
            >
              View all contributors
              <ExternalLink size={12} />
            </button>
          </div>

          {/* Open Source Packages */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-fetchy-text mb-3">Open Source Packages</h3>
            <div className="space-y-1.5">
              {OPEN_SOURCE_DEPS.map((dep) => (
                <div
                  key={dep.name}
                  className="flex items-center justify-between py-1.5 border-b border-fetchy-border/40 last:border-0"
                >
                  <button
                    onClick={() => window.electronAPI?.openExternalUrl(dep.url)}
                    className="flex items-center gap-1.5 text-sm text-fetchy-text hover:text-fetchy-accent transition-colors"
                  >
                    {dep.name}
                    <ExternalLink size={11} className="text-fetchy-text-muted" />
                  </button>
                  <span className="text-xs font-mono text-fetchy-text-muted px-2 py-0.5 bg-fetchy-sidebar border border-fetchy-border rounded">
                    {dep.version}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-fetchy-border bg-fetchy-sidebar shrink-0">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
