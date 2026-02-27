import { ApiRequest, ApiResponse, KeyValue, RequestAuth } from '../types';
import { replaceVariables } from './helpers';
import { useAppStore } from '../store/appStore';

// Check at runtime whether we're in Electron (preload may not be ready at module load time)
function checkIsElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

// ElectronAPI type is declared in ../types/index.ts

interface ExecuteRequestOptions {
  request: ApiRequest;
  collectionVariables?: KeyValue[];
  environmentVariables?: KeyValue[];
  inheritedAuth?: RequestAuth | null;
}

export const executeRequest = async ({
  request,
  collectionVariables = [],
  environmentVariables = [],
  inheritedAuth = null,
}: ExecuteRequestOptions): Promise<ApiResponse> => {
  const startTime = performance.now();

  // Determine effective auth (use inherited if type is 'inherit')
  const effectiveAuth = request.auth.type === 'inherit' && inheritedAuth
    ? inheritedAuth
    : request.auth;

  // Process URL with variables (env vars take precedence over collection vars)
  let url = replaceVariables(request.url, collectionVariables, environmentVariables);

  // Strip any inline query params from the URL (they are already synced to request.params)
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    url = url.substring(0, qIndex);
  }

  // Add query parameters from Params tab
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
    enabledParams.forEach(p => {
      const value = replaceVariables(p.value, collectionVariables, environmentVariables);
      urlObj.searchParams.append(p.key, value);
    });
    url = urlObj.toString();
  }

  // Add API key to query if configured
  if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'query') {
    const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, environmentVariables);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, environmentVariables);
    // Only add query parameter if both key and value are not empty
    if (key && key.trim() && value && value.trim()) {
      urlObj.searchParams.append(key, value);
      url = urlObj.toString();
    }
  }

  // Build headers
  const headers: Record<string, string> = {};

  // Add request headers
  for (const header of request.headers) {
    if (header.enabled && header.key && header.key.trim()) {
      const headerValue = replaceVariables(header.value, collectionVariables, environmentVariables);
      // Allow empty values for headers (some headers can be empty), but trim the key
      headers[header.key.trim()] = headerValue;
    }
  }

  // Add auth headers
  if (effectiveAuth.type === 'bearer' && effectiveAuth.bearer) {
    const token = replaceVariables(effectiveAuth.bearer.token, collectionVariables, environmentVariables);
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
    const username = replaceVariables(effectiveAuth.basic.username, collectionVariables, environmentVariables);
    const password = replaceVariables(effectiveAuth.basic.password, collectionVariables, environmentVariables);
    if (username && username.trim()) {
      const credentials = btoa(`${username}:${password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
  } else if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'header') {
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, environmentVariables);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, environmentVariables);
    if (key && key.trim() && value && value.trim()) {
      headers[key] = value;
    }
  }

  // Build body
  let body: string | FormData | undefined;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    switch (request.body.type) {
      case 'json':
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = replaceVariables(request.body.raw || '', collectionVariables, environmentVariables);
        break;
      case 'raw':
        body = replaceVariables(request.body.raw || '', collectionVariables, environmentVariables);
        break;
      case 'x-www-form-urlencoded': {
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        for (const item of request.body.urlencoded || []) {
          if (item.enabled && item.key) {
            params.append(item.key, replaceVariables(item.value, collectionVariables, environmentVariables));
          }
        }
        body = params.toString();
        break;
      }
      case 'form-data': {
        const formData = new FormData();
        for (const item of request.body.formData || []) {
          if (item.enabled && item.key) {
            formData.append(item.key, replaceVariables(item.value, collectionVariables, environmentVariables));
          }
        }
        body = formData;
        // Don't set Content-Type for FormData, let the browser set it with boundary
        delete headers['Content-Type'];
        break;
      }
    }
  }

  const { updateTab, activeTabId } = useAppStore.getState();
  if (activeTabId) {
    updateTab(activeTabId, { scriptExecutionStatus: 'none' });
  }

  // Run pre-script if present. If it errors, abort the request.
  let preScriptOutput: string | undefined;
  if (request.preScript) {
    const preScriptResult = await runScriptInWorker(request.preScript, 'pre', environmentVariables);
    applyEnvUpdates(preScriptResult.envUpdates);
    if (preScriptResult.error) {
      return {
        status: 0,
        statusText: 'Pre-Script Error',
        headers: {},
        body: '',
        time: 0,
        size: 0,
        preScriptError: preScriptResult.error,
        preScriptOutput: preScriptResult.output || undefined,
      };
    }
    preScriptOutput = preScriptResult.output;
  }

  try {
    // If in Electron, use the main process for HTTP requests to bypass CORS.
    if (checkIsElectron()) {
      const response = await window.electronAPI!.httpRequest({
        url,
        method: request.method,
        headers,
        body: typeof body === 'string' ? body : undefined,
        sslVerification: request.sslVerification !== false, // default true
      });

      if (request.script) {
        const scriptResult = await runScriptInWorker(request.script, 'post', environmentVariables, response);
        applyEnvUpdates(scriptResult.envUpdates);
        if (scriptResult.output) response.scriptOutput = scriptResult.output;
        if (scriptResult.error) {
          response.scriptError = scriptResult.error;
          if (useAppStore.getState().activeTabId) {
            useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'error' });
          }
        } else {
          if (useAppStore.getState().activeTabId) {
            useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'success' });
          }
        }
      }
      // Attach pre-script output if any
      if (preScriptOutput) response.preScriptOutput = preScriptOutput;
      return response;
    }

    // Browser mode: use local CORS proxy
    const proxyResponse = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: request.method,
        headers,
        body: body as string | undefined,
      }),
    });

    const apiResponse: ApiResponse = await proxyResponse.json();

    // Run post-script if present
    if (request.script) {
      const scriptResult = await runScriptInWorker(request.script, 'post', environmentVariables, apiResponse);
      applyEnvUpdates(scriptResult.envUpdates);
      if (scriptResult.output) apiResponse.scriptOutput = scriptResult.output;
      if (scriptResult.error) {
        apiResponse.scriptError = scriptResult.error;
        if (useAppStore.getState().activeTabId) {
          useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'error' });
        }
      } else {
        if (useAppStore.getState().activeTabId) {
          useAppStore.getState().updateTab(useAppStore.getState().activeTabId!, { scriptExecutionStatus: 'success' });
        }
      }
    }
    // Attach pre-script output if any
    if (preScriptOutput) apiResponse.preScriptOutput = preScriptOutput;

    return apiResponse;
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: JSON.stringify({ error: errorMessage }),
      time: responseTime,
      size: 0,
    };
  }
};

// ---------------------------------------------------------------------------
// Sandboxed script execution via Web Worker
// ---------------------------------------------------------------------------
// User scripts run inside a dedicated Worker thread that has NO access to
// `window`, `document`, `electronAPI`, the DOM, or Node.js globals.
// Communication happens exclusively via structured-clone postMessage.
// A hard timeout (default 10 s) protects against infinite loops (#6).
// ---------------------------------------------------------------------------

const SCRIPT_TIMEOUT_MS = 10_000;

const WORKER_SOURCE = `
'use strict';
self.onmessage = function (e) {
  var data = e.data;
  var script = data.script;
  var fetchyData = data.fetchyData;
  var scriptType = data.scriptType;

  var logs = [];
  var envUpdates = [];

  // Local copy of environment so set() is visible to subsequent get()
  var envCopy = (fetchyData.environment || []).map(function (v) {
    return { key: v.key, value: v.value, enabled: v.enabled };
  });

  var fetchy = {
    environment: {
      get: function (key) {
        for (var i = 0; i < envCopy.length; i++) {
          if (envCopy[i].key === key) return envCopy[i].value;
        }
        return undefined;
      },
      set: function (key, value) {
        var strVal = String(value);
        var found = false;
        for (var i = 0; i < envCopy.length; i++) {
          if (envCopy[i].key === key) { envCopy[i].value = strVal; found = true; break; }
        }
        if (!found) envCopy.push({ key: key, value: strVal, enabled: true });
        envUpdates.push({ key: key, value: strVal });
      },
      all: function () { return envCopy; },
    },
  };

  // Attach response data for post-request scripts
  if (scriptType === 'post' && fetchyData.response) {
    fetchy.response = fetchyData.response;
  }

  var _console = {
    log: function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        parts.push(typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a));
      }
      logs.push(parts.join(' '));
    },
  };

  try {
    var fn = new Function('fetchy', 'console', script);
    fn(fetchy, _console);
    self.postMessage({ type: 'done', logs: logs, envUpdates: envUpdates });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message, logs: logs, envUpdates: envUpdates });
  }
};
`;

interface ScriptResult {
  error?: string;
  output?: string;
  envUpdates?: Array<{ key: string; value: string }>;
}

/**
 * Execute a user script inside an isolated Web Worker.
 *
 * @param script     The user-authored script source code
 * @param scriptType 'pre' for pre-request scripts, 'post' for post-request / test scripts
 * @param environment Current environment variables (read-only snapshot sent to worker)
 * @param response   The API response (only used for post-request scripts)
 */
const runScriptInWorker = (
  script: string,
  scriptType: 'pre' | 'post',
  environment: KeyValue[],
  response?: ApiResponse,
): Promise<ScriptResult> => {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timeoutId = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ error: `Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s` });
    }, SCRIPT_TIMEOUT_MS);

    worker.onmessage = (e) => {
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(url);

      const { type: msgType, logs, envUpdates, message } = e.data;
      const output = logs && logs.length > 0 ? logs.join('\n') : undefined;

      if (msgType === 'error') {
        resolve({ error: message, output, envUpdates });
      } else {
        resolve({ output, envUpdates });
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ error: err.message || 'Script execution failed' });
    };

    // Build the serialisable payload for the worker
    const fetchyData: Record<string, unknown> = {
      environment: environment.map(v => ({ key: v.key, value: v.value, enabled: v.enabled })),
    };

    if (scriptType === 'post' && response) {
      try {
        fetchyData.response = {
          data: JSON.parse(response.body),
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      } catch {
        fetchyData.response = {
          data: response.body,
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      }
    }

    worker.postMessage({ script, fetchyData, scriptType });
  });
};

/** Apply environment variable mutations reported by the worker back to the store. */
const applyEnvUpdates = (envUpdates?: Array<{ key: string; value: string }>) => {
  if (!envUpdates || envUpdates.length === 0) return;

  const { updateEnvironment, getActiveEnvironment } = useAppStore.getState();
  const activeEnvironment = getActiveEnvironment();
  if (!activeEnvironment) return;

  const variables = [...activeEnvironment.variables];
  for (const { key, value } of envUpdates) {
    const idx = variables.findIndex(v => v.key === key);
    if (idx > -1) {
      variables[idx] = { ...variables[idx], value };
    } else {
      variables.push({ id: '', key, value, enabled: true } as KeyValue);
    }
  }
  updateEnvironment(activeEnvironment.id, { variables });
};

