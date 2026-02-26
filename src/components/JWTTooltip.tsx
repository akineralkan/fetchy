import { useState, useEffect, useRef } from 'react';
import { Shield, Clock, Key, AlertCircle, Copy, Check, X, Eye } from 'lucide-react';
import { DecodedJWT, formatJWTDate, isJWTExpired } from '../utils/helpers';

interface JWTTooltipProps {
  decodedJWT: DecodedJWT;
  children: React.ReactNode;
}

export default function JWTTooltip({ decodedJWT, children }: JWTTooltipProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use mouse click position instead of element position
    setDropdownPosition({
      x: e.clientX,
      y: e.clientY + 8, // 8px below mouse cursor
    });
    setShowDropdown(true);
  };

  const handleShowDecoded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    setShowModal(true);
  };

  const handleCopyToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(decodedJWT.raw);
    setTokenCopied(true);
    setTimeout(() => {
      setTokenCopied(false);
      setShowDropdown(false);
    }, 1500);
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowModal(false);
    setCopiedSection(null);
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) {
          handleCloseModal();
        } else if (showDropdown) {
          setShowDropdown(false);
        }
      }
    };

    if (showModal || showDropdown) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal, showDropdown]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const isExpired = isJWTExpired(decodedJWT.payload);

  return (
    <>
      <span
        onClick={handleClick}
        className="relative cursor-pointer underline decoration-dotted decoration-amber-500 dark:decoration-amber-500 underline-offset-2 hover:decoration-solid hover:bg-amber-500/10 transition-all px-0.5 rounded"
      >
        {children}
      </span>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-fetchy-bg border border-fetchy-border rounded-lg shadow-xl min-w-[200px]"
          style={{
            left: `${dropdownPosition.x}px`,
            top: `${dropdownPosition.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={handleCopyToken}
              className="w-full px-4 py-2 text-left text-sm text-fetchy-text hover:bg-fetchy-border transition-colors flex items-center gap-2"
            >
              {tokenCopied ? (
                <>
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="flex-shrink-0" />
                  <span>Copy Token</span>
                </>
              )}
            </button>
            <button
              onClick={handleShowDecoded}
              className="w-full px-4 py-2 text-left text-sm text-fetchy-text hover:bg-fetchy-border transition-colors flex items-center gap-2"
            >
              <Eye size={16} className="flex-shrink-0" />
              <span>Show Decoded Token</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div
            className="fixed z-[9999] bg-fetchy-bg border border-fetchy-border rounded-lg shadow-2xl w-[90vw] max-w-3xl"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="px-4 py-3 border-b border-fetchy-border bg-fetchy-accent/10 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-fetchy-accent" />
              <h3 className="font-semibold text-fetchy-text">JWT Token Decoded</h3>
              {isExpired && (
                <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
                  <AlertCircle size={12} />
                  Expired
                </span>
              )}
            </div>
            <button
              onClick={handleCloseModal}
              className="p-1 hover:bg-fetchy-accent/20 rounded transition-colors"
              title="Close"
            >
              <X size={18} className="text-fetchy-text-muted hover:text-fetchy-text" />
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
            {/* Header Section */}
            <div className="px-4 py-3 border-b border-fetchy-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-purple-400" />
                  <span className="text-sm font-medium text-fetchy-text">Header</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(JSON.stringify(decodedJWT.header, null, 2), 'header');
                  }}
                  className="p-1 hover:bg-fetchy-accent/10 rounded transition-colors"
                  title="Copy header"
                >
                  {copiedSection === 'header' ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-fetchy-text-muted" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-fetchy-text bg-fetchy-bg-secondary p-2 rounded overflow-x-auto">
                {JSON.stringify(decodedJWT.header, null, 2)}
              </pre>
            </div>

            {/* Payload Section */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-fetchy-accent" />
                  <span className="text-sm font-medium text-fetchy-text">Payload</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(JSON.stringify(decodedJWT.payload, null, 2), 'payload');
                  }}
                  className="p-1 hover:bg-fetchy-accent/10 rounded transition-colors"
                  title="Copy payload"
                >
                  {copiedSection === 'payload' ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-fetchy-text-muted" />
                  )}
                </button>
              </div>

              {/* Key Claims */}
              <div className="space-y-2 mb-3">
                {decodedJWT.payload.iss && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-fetchy-text-muted min-w-20">Issuer:</span>
                    <span className="text-xs text-fetchy-text font-mono">{decodedJWT.payload.iss}</span>
                  </div>
                )}
                {decodedJWT.payload.sub && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-fetchy-text-muted min-w-20">Subject:</span>
                    <span className="text-xs text-fetchy-text font-mono">{decodedJWT.payload.sub}</span>
                  </div>
                )}
                {decodedJWT.payload.aud && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-fetchy-text-muted min-w-20">Audience:</span>
                    <span className="text-xs text-fetchy-text font-mono">
                      {Array.isArray(decodedJWT.payload.aud)
                        ? decodedJWT.payload.aud.join(', ')
                        : decodedJWT.payload.aud}
                    </span>
                  </div>
                )}
                {decodedJWT.payload.exp && (
                  <div className="flex items-start gap-2">
                    <Clock size={12} className="mt-0.5 text-fetchy-text-muted" />
                    <span className="text-xs text-fetchy-text-muted min-w-20">Expires:</span>
                    <span className={`text-xs font-mono ${isExpired ? 'text-red-400' : 'text-fetchy-text'}`}>
                      {formatJWTDate(decodedJWT.payload.exp)}
                    </span>
                  </div>
                )}
                {decodedJWT.payload.iat && (
                  <div className="flex items-start gap-2">
                    <Clock size={12} className="mt-0.5 text-fetchy-text-muted" />
                    <span className="text-xs text-fetchy-text-muted min-w-20">Issued At:</span>
                    <span className="text-xs text-fetchy-text font-mono">
                      {formatJWTDate(decodedJWT.payload.iat)}
                    </span>
                  </div>
                )}
                {decodedJWT.payload.nbf && (
                  <div className="flex items-start gap-2">
                    <Clock size={12} className="mt-0.5 text-fetchy-text-muted" />
                    <span className="text-xs text-fetchy-text-muted min-w-20">Not Before:</span>
                    <span className="text-xs text-fetchy-text font-mono">
                      {formatJWTDate(decodedJWT.payload.nbf)}
                    </span>
                  </div>
                )}
              </div>

              {/* Full Payload */}
              <details className="group">
                <summary className="text-xs text-fetchy-text-muted cursor-pointer hover:text-fetchy-text mb-2 select-none">
                  Show full payload
                </summary>
                <pre className="text-xs text-fetchy-text bg-fetchy-bg-secondary p-2 rounded overflow-x-auto">
                  {JSON.stringify(decodedJWT.payload, null, 2)}
                </pre>
              </details>
            </div>

            {/* Signature Section */}
            <div className="px-4 py-3 border-t border-fetchy-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-green-400" />
                  <span className="text-sm font-medium text-fetchy-text">Signature</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(decodedJWT.signature, 'signature');
                  }}
                  className="p-1 hover:bg-fetchy-accent/10 rounded transition-colors"
                  title="Copy signature"
                >
                  {copiedSection === 'signature' ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-fetchy-text-muted" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-fetchy-text bg-fetchy-bg-secondary p-2 rounded overflow-x-auto break-all">
                {decodedJWT.signature}
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-fetchy-border bg-fetchy-bg-secondary/50 rounded-b-lg">
            <p className="text-xs text-fetchy-text-muted">
              💡 Click JWT tokens to copy or view decoded values
            </p>
          </div>
        </div>
        </>
      )}
    </>
  );
}

