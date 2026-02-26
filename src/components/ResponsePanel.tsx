import { useState } from 'react';
import { Send, ArrowDown, Copy, Check } from 'lucide-react';
import { ApiResponse, ApiRequest } from '../types';
import { formatBytes, formatTime, getStatusColor, prettyPrintJson, getMethodBgColor } from '../utils/helpers';
import CodeEditor from './CodeEditor';
import JSONViewer from './JSONViewer';

interface ResponsePanelProps {
  response: ApiResponse | null;
  sentRequest?: ApiRequest | null;
  isLoading: boolean;
}

export default function ResponsePanel({ response, sentRequest, isLoading }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'response-body' | 'response-headers' | 'request-headers' | 'request-body' | 'console'>('response-body');
  const [copied, setCopied] = useState(false);

  const handleCopyBody = () => {
    if (!response) return;
    const text = response.headers['content-type']?.includes('application/json')
      ? prettyPrintJson(response.body)
      : response.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-fetchy-bg">
        <div className="w-12 h-12 border-4 border-fetchy-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-fetchy-text-muted">Sending request...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-fetchy-bg text-fetchy-text-muted">
        <div className="text-6xl mb-4">📡</div>
        <p className="text-lg">No response yet</p>
        <p className="text-sm mt-2">Send a request to see the response</p>
      </div>
    );
  }

  const formattedBody = response.headers['content-type']?.includes('application/json')
    ? prettyPrintJson(response.body)
    : response.body;

  const getRequestBodyContent = () => {
    if (!sentRequest) return '';
    if (sentRequest.body.type === 'none') return '(No body)';
    if (sentRequest.body.type === 'json' || sentRequest.body.type === 'raw') {
      return sentRequest.body.raw || '';
    }
    if (sentRequest.body.type === 'form-data' && sentRequest.body.formData) {
      return sentRequest.body.formData
        .filter(f => f.enabled)
        .map(f => `${f.key}: ${f.value}`)
        .join('\n');
    }
    if (sentRequest.body.type === 'x-www-form-urlencoded' && sentRequest.body.urlencoded) {
      return sentRequest.body.urlencoded
        .filter(f => f.enabled)
        .map(f => `${f.key}=${f.value}`)
        .join('&');
    }
    return '';
  };

  return (
    <div className="h-full flex flex-col bg-fetchy-bg">
      {/* Status bar */}
      <div className="px-4 py-3 border-b border-fetchy-border">
        {/* Request info */}
        {sentRequest && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-fetchy-border/50">
            <Send size={14} className="text-fetchy-accent" />
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(sentRequest.method)}`}>
              {sentRequest.method}
            </span>
            <span className="text-sm text-fetchy-text truncate flex-1">{sentRequest.url}</span>
          </div>
        )}
        {/* Response info */}
        <div className="flex items-center gap-4">
          <ArrowDown size={14} className="text-green-400" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-fetchy-text-muted">Status:</span>
            <span className={`font-bold ${getStatusColor(response.status)}`}>
              {response.status} {response.statusText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fetchy-text-muted">Time:</span>
            <span className="text-sm text-fetchy-text">{formatTime(response.time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fetchy-text-muted">Size:</span>
            <span className="text-sm text-fetchy-text">{formatBytes(response.size)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-fetchy-border shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('response-body')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'response-body'
              ? 'border-fetchy-accent text-fetchy-accent'
              : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
          }`}
        >
          Response Body
        </button>
        <button
          onClick={() => setActiveTab('response-headers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'response-headers'
              ? 'border-fetchy-accent text-fetchy-accent'
              : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
          }`}
        >
          Response Headers
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-fetchy-accent/20 text-fetchy-accent rounded">
            {Object.keys(response.headers).length}
          </span>
        </button>
        {sentRequest && (
          <>
            <button
              onClick={() => setActiveTab('request-headers')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'request-headers'
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
              }`}
            >
              Request Headers
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-400/20 text-purple-400 rounded">
                {sentRequest.headers.filter(h => h.enabled).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('request-body')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'request-body'
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
              }`}
            >
              Request Body
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'console'
              ? 'border-fetchy-accent text-fetchy-accent'
              : 'border-transparent text-fetchy-text-muted hover:text-fetchy-text'
          }`}
        >
          Console
          {(response.scriptError || response.preScriptError) && (
            <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'response-body' && (
          <div className="relative h-full">
            <button
              onClick={handleCopyBody}
              className="absolute top-2 right-4 z-10 p-1.5 rounded bg-fetchy-card/80 hover:bg-fetchy-border text-fetchy-text-muted hover:text-fetchy-text transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            {response.headers['content-type']?.includes('application/json') ? (
              <JSONViewer data={response.body} />
            ) : (
              <CodeEditor
                value={formattedBody}
                onChange={() => {}}
                language="json"
                readOnly
              />
            )}
          </div>
        )}

        {activeTab === 'console' && (
          <div className="h-full overflow-auto p-4 font-mono text-sm">
            {response.preScriptOutput && (
              <div className="mb-3">
                <span className="text-fetchy-text-muted text-xs">--- Pre-Script ---</span>
                <pre className="text-green-400 whitespace-pre-wrap mt-1">{response.preScriptOutput}</pre>
              </div>
            )}
            {response.preScriptError && (
              <div className="mb-3">
                <span className="text-fetchy-text-muted text-xs">--- Pre-Script Error ---</span>
                <pre className="text-red-500 whitespace-pre-wrap mt-1">{response.preScriptError}</pre>
              </div>
            )}
            {response.scriptOutput && (
              <div className="mb-3">
                <span className="text-fetchy-text-muted text-xs">--- Post-Script ---</span>
                <pre className="text-green-400 whitespace-pre-wrap mt-1">{response.scriptOutput}</pre>
              </div>
            )}
            {response.scriptError && (
              <div className="mb-3">
                <span className="text-fetchy-text-muted text-xs">--- Post-Script Error ---</span>
                <pre className="text-red-500 whitespace-pre-wrap mt-1">{response.scriptError}</pre>
              </div>
            )}
            {!response.scriptOutput && !response.scriptError && !response.preScriptOutput && !response.preScriptError && (
              <p className="text-fetchy-text-muted">No script output</p>
            )}
          </div>
        )}

        {activeTab === 'response-headers' && (
          <div className="h-full overflow-auto p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                  <th className="p-2">Header</th>
                  <th className="p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-b border-fetchy-border/50">
                    <td className="p-2 text-sm font-medium text-fetchy-accent">{key}</td>
                    <td className="p-2 text-sm text-fetchy-text break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'request-headers' && sentRequest && (
          <div className="h-full overflow-auto p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
                  <th className="p-2">Header</th>
                  <th className="p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {sentRequest.headers.filter(h => h.enabled).map((header) => (
                  <tr key={header.id} className="border-b border-fetchy-border/50">
                    <td className="p-2 text-sm font-medium text-purple-400">{header.key}</td>
                    <td className="p-2 text-sm text-fetchy-text break-all">{header.value}</td>
                  </tr>
                ))}
                {sentRequest.headers.filter(h => h.enabled).length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-fetchy-text-muted text-sm">
                      No request headers
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'request-body' && sentRequest && (
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 text-xs text-fetchy-text-muted border-b border-fetchy-border">
              Body Type: <span className="text-fetchy-text">{sentRequest.body.type}</span>
            </div>
            {sentRequest.body.type === 'none' ? (
              <div className="flex-1 flex items-center justify-center text-fetchy-text-muted">
                No request body
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  value={getRequestBodyContent()}
                  onChange={() => {}}
                  language={sentRequest.body.type === 'json' ? 'json' : 'text'}
                  readOnly
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

