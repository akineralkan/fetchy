import { useState } from 'react';
import { Send, Terminal, Code, ChevronDown, XCircle } from 'lucide-react';
import { HttpMethod, KeyValue, AppMode } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import VariableInput from '../VariableInput';
import Tooltip from '../Tooltip';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const CODE_LANGUAGES = [
  { id: 'curl', label: 'cURL', icon: '⚡' },
  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'dotnet', label: '.NET Core', icon: '🔷' },
  { id: 'go', label: 'Go', icon: '🐹' },
  { id: 'rust', label: 'Rust', icon: '🦀' },
  { id: 'cpp', label: 'C++', icon: '⚙️' },
] as const;

interface UrlBarProps {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  isLoading: boolean;
  curlImportFlash: boolean;
  onChange: (changes: { method?: HttpMethod; url?: string; params?: KeyValue[] }) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onCancel: () => void;
  onShowCode: (langId: string) => void;
  /** Current application mode (defaults to 'rest'). */
  appMode?: AppMode;
  /** gRPC server address (host:port). Only used when appMode === 'grpc'. */
  serverAddress?: string;
  /** Callback fired when the server address changes. */
  onServerAddressChange?: (address: string) => void;
}

export default function UrlBar({
  method,
  url,
  params,
  isLoading,
  curlImportFlash,
  onChange,
  onPaste,
  onSend,
  onCancel,
  onShowCode,
  appMode,
  serverAddress,
  onServerAddressChange,
}: UrlBarProps) {
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const isGrpc = appMode === 'grpc';

  const handleUrlChange = (newUrl: string) => {
    // Parse query params from URL and sync to Params tab
    const qIndex = newUrl.indexOf('?');
    if (qIndex >= 0) {
      const queryString = newUrl.substring(qIndex + 1);
      const pairs = queryString.split('&');
      const parsed: KeyValue[] = pairs
        .filter(p => p.length > 0)
        .map(pair => {
          const eqIndex = pair.indexOf('=');
          const key = eqIndex >= 0 ? pair.substring(0, eqIndex) : pair;
          const value = eqIndex >= 0 ? pair.substring(eqIndex + 1) : '';
          return { id: uuidv4(), key: decodeURIComponent(key), value: decodeURIComponent(value), enabled: true };
        });
      // Keep any existing params that are disabled (user manually toggled off)
      const disabledParams = (params || []).filter(p => !p.enabled);
      onChange({ url: newUrl, params: [...parsed, ...disabledParams] });
    } else {
      onChange({ url: newUrl });
    }
  };

  const handleShowCodeClick = (langId: string) => {
    setShowCodeDropdown(false);
    onShowCode(langId);
  };

  return (
    <div className="px-4 py-3 border-b border-fetchy-border flex items-center gap-2 bg-fetchy-bg relative">

      {isGrpc ? (
        /* gRPC server address */
        <input
          type="text"
          value={serverAddress || ''}
          onChange={(e) => onServerAddressChange?.(e.target.value)}
          placeholder="host:port (e.g. localhost:50051)"
          className="flex-1 text-sm bg-transparent border border-fetchy-border rounded px-3 py-1.5 text-fetchy-text placeholder:text-fetchy-text-muted focus:outline-none focus:ring-1 focus:ring-fetchy-accent"
        />
      ) : (
        <>
          <select
            value={method}
            onChange={(e) => onChange({ method: e.target.value as HttpMethod })}
            className="w-28 font-medium"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <VariableInput
            value={url}
            onChange={handleUrlChange}
            onPaste={onPaste}
            className="flex-1 text-sm"
            placeholder="Enter request URL or paste a cURL command"
          />
        </>
      )}

      {/* cURL import flash indicator */}
      {curlImportFlash && !isGrpc && (
        <div className="absolute top-full left-0 right-0 z-50 flex justify-center mt-1 pointer-events-none">
          <div className="px-3 py-1.5 bg-green-500/90 text-white text-xs font-medium rounded-md shadow-lg flex items-center gap-1.5 animate-fade-in">
            <Terminal size={12} /> cURL imported successfully
          </div>
        </div>
      )}

      {!isGrpc && (isLoading ? (
        <button
          onClick={onCancel}
          className="btn flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          title="Cancel request (Esc)"
        >
          <XCircle size={16} /> Cancel
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!url}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={16} /> Send
        </button>
      ))}

      {!isGrpc && (
        <div className="relative">
          <Tooltip content="Generate Code">
            <button
              onClick={() => setShowCodeDropdown(!showCodeDropdown)}
              disabled={!url}
              className="btn btn-secondary flex items-center gap-1.5 disabled:opacity-50 pr-2"
            >
              <Code size={16} className="text-purple-400" />
              <span className="font-medium">Code</span>
              <ChevronDown size={14} className="text-fetchy-text-muted" />
            </button>
          </Tooltip>

          {showCodeDropdown && url && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCodeDropdown(false)}
              />
              <div className="absolute top-full right-0 mt-1 w-48 bg-fetchy-bg border border-fetchy-border rounded-lg shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto">
                {CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => handleShowCodeClick(lang.id)}
                  className="w-full px-4 py-2 text-left text-sm text-fetchy-text hover:bg-fetchy-border transition-colors flex items-center gap-2"
                >
                  <span className="text-base">{lang.icon}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
