import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, Square, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Collection, ApiRequest, RequestFolder, ApiResponse, RequestAuth, HttpMethod } from '../types';
import { executeRequest } from '../utils/httpClient';
import { getMethodBgColor } from '../utils/helpers';

interface RunCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
}

type RunMode = 'sequential' | 'parallel';

interface RunConfig {
  mode: RunMode;
  delayBetweenRequests: number; // milliseconds
  stopOnError: boolean;
  iterations: number;
}

interface RequestResult {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  response?: ApiResponse;
  error?: string;
  duration?: number;
}

// Helper to flatten all requests from a collection (including nested folders)
const flattenRequests = (
  requests: ApiRequest[],
  folders: RequestFolder[],
  collectionId: string,
  folderId?: string
): Array<{ request: ApiRequest; collectionId: string; folderId?: string }> => {
  const result: Array<{ request: ApiRequest; collectionId: string; folderId?: string }> = [];

  // Add root-level requests first
  for (const request of requests) {
    result.push({ request, collectionId, folderId });
  }

  // Then add requests from folders recursively
  for (const folder of folders) {
    // Add folder's requests
    for (const request of folder.requests) {
      result.push({ request, collectionId, folderId: folder.id });
    }
    // Recursively add from subfolders
    result.push(...flattenRequests([], folder.folders, collectionId, folder.id));
  }

  return result;
};

// Helper to get auth from folder or collection
const getInheritedAuth = (
  collection: Collection,
  folderId?: string
): RequestAuth | null => {
  if (folderId) {
    const findFolder = (folders: RequestFolder[]): RequestFolder | null => {
      for (const folder of folders) {
        if (folder.id === folderId) return folder;
        const found = findFolder(folder.folders);
        if (found) return found;
      }
      return null;
    };
    const folder = findFolder(collection.folders);
    if (folder?.auth && folder.auth.type !== 'none') {
      return folder.auth;
    }
  }
  return collection.auth || null;
};

export default function RunCollectionModal({ isOpen, onClose, collectionId }: RunCollectionModalProps) {
  const { collections, getActiveEnvironment } = useAppStore();

  const collection = collections.find(c => c.id === collectionId);

  const [config, setConfig] = useState<RunConfig>({
    mode: 'sequential',
    delayBetweenRequests: 0,
    stopOnError: false,
    iterations: 1,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [results, setResults] = useState<RequestResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  // Get all requests in order
  const allRequests = collection
    ? flattenRequests(collection.requests, collection.folders, collectionId)
    : [];

  // Initialize results when modal opens or collection changes
  useEffect(() => {
    if (isOpen && collection) {
      const initialResults: RequestResult[] = allRequests.map(({ request }) => ({
        requestId: request.id,
        requestName: request.name,
        method: request.method,
        url: request.url,
        status: 'pending',
      }));
      setResults(initialResults);
      setCurrentIteration(0);
      setIsRunning(false);
      setIsPaused(false);
      setShowConfig(true);
    }
  }, [isOpen, collectionId]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForUnpause = async () => {
    while (pauseRef.current) {
      await delay(100);
    }
  };

  const runCollection = useCallback(async () => {
    if (!collection) return;

    setIsRunning(true);
    setShowConfig(false);
    abortControllerRef.current = new AbortController();

    const environment = getActiveEnvironment();
    const environmentVariables = environment?.variables || [];
    const collectionVariables = collection.variables || [];

    for (let iteration = 0; iteration < config.iterations; iteration++) {
      setCurrentIteration(iteration + 1);

      // Reset results for this iteration
      const initialResults: RequestResult[] = allRequests.map(({ request }) => ({
        requestId: request.id,
        requestName: request.name,
        method: request.method,
        url: request.url,
        status: 'pending',
      }));
      setResults(initialResults);

      if (config.mode === 'sequential') {
        // Run requests one by one
        for (let i = 0; i < allRequests.length; i++) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          await waitForUnpause();

          const { request, folderId } = allRequests[i];
          const inheritedAuth = getInheritedAuth(collection, folderId);

          // Update status to running
          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'running' } : r
          ));

          const startTime = performance.now();

          try {
            const response = await executeRequest({
              request,
              collectionVariables,
              environmentVariables,
              inheritedAuth,
            });

            const duration = Math.round(performance.now() - startTime);
            const isSuccess = response.status >= 200 && response.status < 400;

            setResults(prev => prev.map((r, idx) =>
              idx === i ? {
                ...r,
                status: isSuccess ? 'success' : 'failed',
                response,
                duration,
              } : r
            ));

            if (!isSuccess && config.stopOnError) {
              // Mark remaining as skipped
              setResults(prev => prev.map((r, idx) =>
                idx > i ? { ...r, status: 'skipped' } : r
              ));
              break;
            }
          } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            setResults(prev => prev.map((r, idx) =>
              idx === i ? {
                ...r,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
              } : r
            ));

            if (config.stopOnError) {
              // Mark remaining as skipped
              setResults(prev => prev.map((r, idx) =>
                idx > i ? { ...r, status: 'skipped' } : r
              ));
              break;
            }
          }

          // Add delay between requests
          if (config.delayBetweenRequests > 0 && i < allRequests.length - 1) {
            await delay(config.delayBetweenRequests);
          }
        }
      } else {
        // Run all requests in parallel
        setResults(prev => prev.map(r => ({ ...r, status: 'running' })));

        const promises = allRequests.map(async ({ request, folderId }, index) => {
          const inheritedAuth = getInheritedAuth(collection, folderId);
          const startTime = performance.now();

          try {
            const response = await executeRequest({
              request,
              collectionVariables,
              environmentVariables,
              inheritedAuth,
            });

            const duration = Math.round(performance.now() - startTime);
            const isSuccess = response.status >= 200 && response.status < 400;

            setResults(prev => prev.map((r, idx) =>
              idx === index ? {
                ...r,
                status: isSuccess ? 'success' : 'failed',
                response,
                duration,
              } : r
            ));

            return { success: isSuccess, index };
          } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            setResults(prev => prev.map((r, idx) =>
              idx === index ? {
                ...r,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
              } : r
            ));
            return { success: false, index };
          }
        });

        await Promise.all(promises);
      }

      // Add delay between iterations if more iterations remain
      if (iteration < config.iterations - 1 && config.delayBetweenRequests > 0) {
        await delay(config.delayBetweenRequests);
      }
    }

    setIsRunning(false);
    setIsPaused(false);
  }, [collection, config, allRequests, getActiveEnvironment]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setIsPaused(false);
    pauseRef.current = false;
  };

  const handlePause = () => {
    pauseRef.current = true;
    setIsPaused(true);
  };

  const handleResume = () => {
    pauseRef.current = false;
    setIsPaused(false);
  };

  const toggleResultExpanded = (requestId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: RequestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-fetchy-text-muted" />;
      case 'running':
        return <Loader2 size={16} className="text-fetchy-accent animate-spin" />;
      case 'success':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      case 'skipped':
        return <AlertCircle size={16} className="text-yellow-400" />;
    }
  };

  const getSummary = () => {
    const total = results.length;
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const pending = results.filter(r => r.status === 'pending').length;
    const running = results.filter(r => r.status === 'running').length;
    const totalDuration = results.reduce((acc, r) => acc + (r.duration || 0), 0);

    return { total, success, failed, skipped, pending, running, totalDuration };
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatResponseBody = (body: string) => {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  };

  if (!isOpen || !collection) return null;

  const summary = getSummary();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-fetchy-modal border border-fetchy-border rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-fetchy-border">
          <div>
            <h2 className="text-lg font-semibold text-fetchy-text">Run Collection</h2>
            <p className="text-sm text-fetchy-text-muted">{collection.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-fetchy-border rounded"
            disabled={isRunning}
          >
            <X size={20} />
          </button>
        </div>

        {/* Configuration Section */}
        {showConfig && !isRunning && (
          <div className="p-4 border-b border-fetchy-border">
            <div className="grid grid-cols-2 gap-4">
              {/* Run Mode */}
              <div>
                <label className="block text-sm font-medium text-fetchy-text mb-2">
                  Run Mode
                </label>
                <select
                  value={config.mode}
                  onChange={(e) => setConfig(prev => ({ ...prev, mode: e.target.value as RunMode }))}
                  className="w-full px-3 py-2 bg-fetchy-bg border border-fetchy-border rounded text-sm focus:outline-none focus:border-fetchy-accent"
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                </select>
                <p className="text-xs text-fetchy-text-muted mt-1">
                  {config.mode === 'sequential'
                    ? 'Requests run one after another in order'
                    : 'All requests run simultaneously'}
                </p>
              </div>

              {/* Delay Between Requests */}
              <div>
                <label className="block text-sm font-medium text-fetchy-text mb-2">
                  Delay Between Requests
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={config.delayBetweenRequests}
                    onChange={(e) => setConfig(prev => ({ ...prev, delayBetweenRequests: parseInt(e.target.value) || 0 }))}
                    className="flex-1 px-3 py-2 bg-fetchy-bg border border-fetchy-border rounded text-sm focus:outline-none focus:border-fetchy-accent"
                    disabled={config.mode === 'parallel'}
                  />
                  <span className="text-sm text-fetchy-text-muted">ms</span>
                </div>
              </div>

              {/* Iterations */}
              <div>
                <label className="block text-sm font-medium text-fetchy-text mb-2">
                  Iterations
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.iterations}
                  onChange={(e) => setConfig(prev => ({ ...prev, iterations: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 bg-fetchy-bg border border-fetchy-border rounded text-sm focus:outline-none focus:border-fetchy-accent"
                />
                <p className="text-xs text-fetchy-text-muted mt-1">
                  Number of times to run all requests
                </p>
              </div>

              {/* Stop on Error */}
              <div>
                <label className="block text-sm font-medium text-fetchy-text mb-2">
                  Error Handling
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.stopOnError}
                    onChange={(e) => setConfig(prev => ({ ...prev, stopOnError: e.target.checked }))}
                    className="w-4 h-4 rounded border-fetchy-border bg-fetchy-bg text-fetchy-accent focus:ring-fetchy-accent"
                  />
                  <span className="text-sm text-fetchy-text">Stop on first error</span>
                </label>
                <p className="text-xs text-fetchy-text-muted mt-1">
                  {config.stopOnError
                    ? 'Stop execution when a request fails'
                    : 'Continue even if requests fail'}
                </p>
              </div>
            </div>

            {/* Request count info */}
            <div className="mt-4 p-3 bg-fetchy-bg rounded border border-fetchy-border">
              <p className="text-sm text-fetchy-text">
                <span className="font-medium">{allRequests.length}</span> request{allRequests.length !== 1 ? 's' : ''} will be executed
                {config.iterations > 1 && (
                  <span className="text-fetchy-text-muted"> ({allRequests.length * config.iterations} total)</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Progress/Results Section */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary Bar */}
          {(isRunning || !showConfig) && (
            <div className="mb-4 p-3 bg-fetchy-bg rounded border border-fetchy-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  {config.iterations > 1 && (
                    <span className="text-fetchy-text">
                      Iteration: {currentIteration}/{config.iterations}
                    </span>
                  )}
                  <span className="text-green-400">✓ {summary.success}</span>
                  <span className="text-red-400">✗ {summary.failed}</span>
                  {summary.skipped > 0 && (
                    <span className="text-yellow-400">⊘ {summary.skipped}</span>
                  )}
                  {(summary.pending > 0 || summary.running > 0) && (
                    <span className="text-fetchy-text-muted">
                      ◷ {summary.pending + summary.running}
                    </span>
                  )}
                </div>
                <div className="text-sm text-fetchy-text-muted">
                  Total: {formatDuration(summary.totalDuration)}
                </div>
              </div>

              {/* Progress bar */}
              {isRunning && (
                <div className="mt-2 h-1 bg-fetchy-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fetchy-accent transition-all duration-300"
                    style={{ width: `${((summary.success + summary.failed) / summary.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Results List */}
          <div className="space-y-2">
            {results.map((result) => (
              <div key={result.requestId} className="border border-fetchy-border rounded overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 hover:bg-fetchy-border/50 cursor-pointer"
                  onClick={() => result.response && toggleResultExpanded(result.requestId)}
                >
                  {getStatusIcon(result.status)}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[52px] text-center ${getMethodBgColor(result.method)}`}>
                    {result.method}
                  </span>
                  <span className="flex-1 text-sm text-fetchy-text truncate">
                    {result.requestName}
                  </span>
                  {result.response && (
                    <span className={`text-sm font-medium ${
                      result.response.status >= 200 && result.response.status < 300 
                        ? 'text-green-400' 
                        : result.response.status >= 400 
                          ? 'text-red-400' 
                          : 'text-yellow-400'
                    }`}>
                      {result.response.status}
                    </span>
                  )}
                  {result.duration !== undefined && (
                    <span className="text-xs text-fetchy-text-muted">
                      {formatDuration(result.duration)}
                    </span>
                  )}
                  {result.response && (
                    expandedResults.has(result.requestId)
                      ? <ChevronDown size={16} className="text-fetchy-text-muted" />
                      : <ChevronRight size={16} className="text-fetchy-text-muted" />
                  )}
                </div>

                {/* Expanded Response Details */}
                {expandedResults.has(result.requestId) && result.response && (
                  <div className="border-t border-fetchy-border bg-fetchy-bg p-3">
                    <div className="mb-2">
                      <span className="text-xs font-medium text-fetchy-text-muted uppercase">
                        Response ({result.response.size} bytes)
                      </span>
                    </div>
                    <pre className="text-xs text-fetchy-text bg-fetchy-card p-2 rounded max-h-48 overflow-auto">
                      {formatResponseBody(result.response.body)}
                    </pre>
                  </div>
                )}

                {/* Error Message */}
                {result.error && (
                  <div className="border-t border-fetchy-border bg-red-500/10 p-3">
                    <span className="text-sm text-red-400">{result.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-fetchy-border">
          <div className="flex items-center gap-2">
            {!isRunning && showConfig && (
              <button
                onClick={runCollection}
                disabled={allRequests.length === 0}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play size={16} />
                Run Collection
              </button>
            )}

            {isRunning && !isPaused && config.mode === 'sequential' && (
              <button
                onClick={handlePause}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Pause size={16} />
                Pause
              </button>
            )}

            {isRunning && isPaused && (
              <button
                onClick={handleResume}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play size={16} />
                Resume
              </button>
            )}

            {isRunning && (
              <button
                onClick={handleStop}
                className="btn btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
              >
                <Square size={16} />
                Stop
              </button>
            )}

            {!isRunning && !showConfig && (
              <button
                onClick={() => setShowConfig(true)}
                className="btn btn-secondary flex items-center gap-2"
              >
                Run Again
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            disabled={isRunning}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

