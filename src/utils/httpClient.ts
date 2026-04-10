import { ApiRequest, ApiResponse, KeyValue, RequestAuth } from '../types';
import { replaceVariables } from './helpers';
import { useAppStore } from '../store/appStore';

// ---------------------------------------------------------------------------
// Response body size cap (#8)
// ---------------------------------------------------------------------------
// Responses larger than this threshold are truncated in memory to prevent OOM.
// The original size is preserved so the UI can offer "Save full response".
// ---------------------------------------------------------------------------
const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Truncate the response body if it exceeds MAX_RESPONSE_BODY_BYTES.
 * Sets `bodyTruncated` and `fullBodySize` on the response when truncating.
 * For base64-encoded bodies, the real decoded size is used for comparison (#23).
 */
function capResponseBody(response: ApiResponse): ApiResponse {
  if (!response.body) return response;

  let byteLen: number;
  if (response.bodyEncoding === 'base64') {
    // Approximate decoded size: base64 uses ~4/3 ratio
    byteLen = Math.ceil(response.body.length * 3 / 4);
  } else {
    byteLen = new Blob([response.body]).size;
  }

  if (byteLen <= MAX_RESPONSE_BODY_BYTES) return response;

  if (response.bodyEncoding === 'base64') {
    // Truncate base64 at a valid boundary (multiples of 4 chars)
    const targetChars = Math.floor((MAX_RESPONSE_BODY_BYTES * 4) / 3);
    const truncated = response.body.slice(0, targetChars - (targetChars % 4));
    return {
      ...response,
      body: truncated,
      bodyTruncated: true,
      fullBodySize: response.fullBodySize || byteLen,
    };
  }

  // Text responses: truncate to the byte limit (approximate char-level cut for UTF-8)
  const truncated = response.body.slice(0, MAX_RESPONSE_BODY_BYTES);
  return {
    ...response,
    body: truncated + '\n\n--- Response truncated (original size: ' + (response.fullBodySize || byteLen) + ' bytes). Use "Save Full Response" to download. ---',
    bodyTruncated: true,
    fullBodySize: response.fullBodySize || byteLen,
  };
}

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
  collectionPreScript?: string;
  collectionScript?: string;
  /** Optional AbortSignal to cancel the in-flight request (#15). */
  signal?: AbortSignal;
}

export const executeRequest = async ({
  request,
  collectionVariables = [],
  environmentVariables = [],
  inheritedAuth = null,
  collectionPreScript,
  collectionScript,
  signal,
}: ExecuteRequestOptions): Promise<ApiResponse> => {
  const startTime = performance.now();

  // Determine effective auth (use inherited if type is 'inherit')
  const effectiveAuth = request.auth.type === 'inherit' && inheritedAuth
    ? inheritedAuth
    : request.auth;

  const { updateTab, activeTabId } = useAppStore.getState();
  if (activeTabId) {
    updateTab(activeTabId, { scriptExecutionStatus: 'none' });
  }

  // ---------------------------------------------------------------------------
  // Run pre-scripts BEFORE variable replacement so that variables set by
  // fetchy.environment.set() / pm.environment.set() are available in the
  // request URL, headers, body, auth, and query parameters.
  // Collection pre-scripts run before request pre-scripts.
  //
  // We collect envUpdates locally so that even when no environment is active
  // (applyEnvUpdates early-returns), newly created variables are still
  // merged into the env used for variable replacement.
  // ---------------------------------------------------------------------------
  const allPreScriptOutputs: string[] = [];
  const allEnvUpdates: Array<{ key: string; value: string }> = [];

  if (collectionPreScript) {
    const collPreResult = await runScriptInWorker(collectionPreScript, 'pre', environmentVariables);
    applyEnvUpdates(collPreResult.envUpdates);
    if (collPreResult.envUpdates) allEnvUpdates.push(...collPreResult.envUpdates);
    if (collPreResult.output) allPreScriptOutputs.push('[Collection Pre-Script]\n' + collPreResult.output);
    if (collPreResult.error) {
      return {
        status: 0,
        statusText: 'Collection Pre-Script Error',
        headers: {},
        body: '',
        time: 0,
        size: 0,
        preScriptError: collPreResult.error,
        preScriptOutput: allPreScriptOutputs.join('\n') || undefined,
      };
    }
  }

  if (request.preScript) {
    // Build the env snapshot for the request pre-script: start from the store
    // (which includes collection pre-script updates when an environment is active),
    // then layer on locally-collected envUpdates so new variables created by the
    // collection pre-script are visible even without an active environment.
    const latestEnvForReqScript = mergeScriptEnvUpdates(
      useAppStore.getState().getActiveEnvironment()?.variables || environmentVariables,
      allEnvUpdates,
    );
    const preScriptResult = await runScriptInWorker(request.preScript, 'pre', latestEnvForReqScript);
    applyEnvUpdates(preScriptResult.envUpdates);
    if (preScriptResult.envUpdates) allEnvUpdates.push(...preScriptResult.envUpdates);
    if (preScriptResult.output) allPreScriptOutputs.push('[Request Pre-Script]\n' + preScriptResult.output);
    if (preScriptResult.error) {
      return {
        status: 0,
        statusText: 'Pre-Script Error',
        headers: {},
        body: '',
        time: 0,
        size: 0,
        preScriptError: preScriptResult.error,
        preScriptOutput: allPreScriptOutputs.join('\n') || undefined,
      };
    }
  }
  const preScriptOutput = allPreScriptOutputs.length > 0 ? allPreScriptOutputs.join('\n') : undefined;

  // Build the definitive environment for variable replacement.
  // Start from the store (captures applyEnvUpdates writes when an env is active),
  // then merge collected envUpdates on top so that:
  //  • newly created variables are present even without an active environment
  //  • the latest value always wins if a variable was set multiple times
  const resolvedEnvVars = mergeScriptEnvUpdates(
    useAppStore.getState().getActiveEnvironment()?.variables || environmentVariables,
    allEnvUpdates,
  );

  // Process URL with variables (collection vars take precedence over env vars)
  let url = replaceVariables(request.url, collectionVariables, resolvedEnvVars);

  // Strip any inline query params from the URL (they are already synced to request.params)
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    url = url.substring(0, qIndex);
  }

  // Add query parameters from Params tab — use encodeURIComponent for RFC 3986-compliant
  // encoding (%20 for spaces, not +) and resolve <<variable>> in both key and value.
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const qs = enabledParams
      .map(p => {
        const key = encodeURIComponent(replaceVariables(p.key, collectionVariables, resolvedEnvVars));
        const value = encodeURIComponent(replaceVariables(p.value, collectionVariables, resolvedEnvVars));
        return `${key}=${value}`;
      })
      .join('&');
    url = `${url}?${qs}`;
  }

  // Add API key to query if configured
  if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'query') {
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, resolvedEnvVars);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, resolvedEnvVars);
    // Only add query parameter if both key and value are not empty
    if (key && key.trim() && value && value.trim()) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(value);
      url = `${url}${url.includes('?') ? '&' : '?'}${encodedKey}=${encodedValue}`;
    }
  }

  // Build headers
  const headers: Record<string, string> = {};

  // Add request headers
  for (const header of request.headers) {
    if (header.enabled && header.key && header.key.trim()) {
      const headerValue = replaceVariables(header.value, collectionVariables, resolvedEnvVars);
      // Allow empty values for headers (some headers can be empty), but trim the key
      headers[header.key.trim()] = headerValue;
    }
  }

  // Add auth headers
  if (effectiveAuth.type === 'bearer' && effectiveAuth.bearer) {
    const token = replaceVariables(effectiveAuth.bearer.token, collectionVariables, resolvedEnvVars);
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (effectiveAuth.type === 'basic' && effectiveAuth.basic) {
    const username = replaceVariables(effectiveAuth.basic.username, collectionVariables, resolvedEnvVars);
    const password = replaceVariables(effectiveAuth.basic.password, collectionVariables, resolvedEnvVars);
    if (username && username.trim()) {
      const credentials = btoa(`${username}:${password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
  } else if (effectiveAuth.type === 'api-key' && effectiveAuth.apiKey?.addTo === 'header') {
    const key = replaceVariables(effectiveAuth.apiKey.key, collectionVariables, resolvedEnvVars);
    const value = replaceVariables(effectiveAuth.apiKey.value, collectionVariables, resolvedEnvVars);
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
        body = replaceVariables(request.body.raw || '', collectionVariables, resolvedEnvVars);
        break;
      case 'raw':
        body = replaceVariables(request.body.raw || '', collectionVariables, resolvedEnvVars);
        break;
      case 'x-www-form-urlencoded': {
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        for (const item of request.body.urlencoded || []) {
          if (item.enabled && item.key) {
            params.append(item.key, replaceVariables(item.value, collectionVariables, resolvedEnvVars));
          }
        }
        body = params.toString();
        break;
      }
      case 'form-data': {
        const formData = new FormData();
        for (const item of request.body.formData || []) {
          if (item.enabled && item.key) {
            formData.append(item.key, replaceVariables(item.value, collectionVariables, resolvedEnvVars));
          }
        }
        body = formData;
        // Don't set Content-Type for FormData, let the browser set it with boundary
        delete headers['Content-Type'];
        break;
      }
    }
  }

  try {
    // If in Electron, use the main process for HTTP requests to bypass CORS.
    if (checkIsElectron()) {
      // Generate a unique ID so the main process can track and abort this request (#15)
      const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // If an AbortSignal is provided, listen for abort and forward to main process
      let abortListener: (() => void) | undefined;
      if (signal) {
        if (signal.aborted) {
          return {
            status: 0, statusText: 'Aborted', headers: {}, body: JSON.stringify({ error: 'Request aborted by user' }),
            time: 0, size: 0,
          };
        }
        abortListener = () => {
          window.electronAPI!.abortHttpRequest(requestId).catch(() => {});
        };
        signal.addEventListener('abort', abortListener, { once: true });
      }

      try {
        // Serialise form-data entries for IPC transport (#24).
        // FormData cannot cross the IPC boundary, so we convert to a
        // structured array that the main process can reconstruct as multipart.
        let formDataEntries: Array<{ key: string; value: string }> | undefined;
        if (body instanceof FormData) {
          formDataEntries = [];
          body.forEach((value, key) => {
            formDataEntries!.push({ key, value: String(value) });
          });
        }

        const response = await window.electronAPI!.httpRequest({
          url,
          method: request.method,
          headers,
          body: typeof body === 'string' ? body : undefined,
          formData: formDataEntries,
          sslVerification: request.sslVerification !== false, // default true
          requestId,
        });

        // Run post-scripts: request script first, then collection script
        await runPostScripts(response, request.script, collectionScript, environmentVariables);
        // Attach pre-script output if any
        if (preScriptOutput) response.preScriptOutput = preScriptOutput;
        return capResponseBody(response);
      } finally {
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
      }
    }

    // Browser mode: use local CORS proxy
    const proxyResponse = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal, // pass the AbortSignal to fetch for browser mode (#15)
      body: JSON.stringify({
        url,
        method: request.method,
        headers,
        body: body as string | undefined,
      }),
    });

    const apiResponse: ApiResponse = await proxyResponse.json();

    // Run post-scripts: request script first, then collection script
    await runPostScripts(apiResponse, request.script, collectionScript, environmentVariables);
    // Attach pre-script output if any
    if (preScriptOutput) apiResponse.preScriptOutput = preScriptOutput;

    return capResponseBody(apiResponse);
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

/**
 * Run post-response scripts: request-level script first, then collection-level script.
 * Both outputs are combined into response.scriptOutput / response.scriptError.
 */
const runPostScripts = async (
  response: ApiResponse,
  requestScript: string | undefined,
  collectionScript: string | undefined,
  environmentVariables: KeyValue[],
): Promise<void> => {
  const allOutputs: string[] = [];
  let hasError = false;

  // Run request-level post-script first
  if (requestScript) {
    const scriptResult = await runScriptInWorker(requestScript, 'post', environmentVariables, response);
    applyEnvUpdates(scriptResult.envUpdates);
    if (scriptResult.output) allOutputs.push('[Request Post-Script]\n' + scriptResult.output);
    if (scriptResult.error) {
      hasError = true;
      response.scriptError = scriptResult.error;
    }
  }

  // Run collection-level post-script / tests
  if (collectionScript) {
    const collScriptResult = await runScriptInWorker(collectionScript, 'post', environmentVariables, response);
    applyEnvUpdates(collScriptResult.envUpdates);
    if (collScriptResult.output) allOutputs.push('[Collection Post-Script]\n' + collScriptResult.output);
    if (collScriptResult.error) {
      hasError = true;
      response.scriptError = (response.scriptError ? response.scriptError + '\n' : '') + collScriptResult.error;
    }
  }

  if (allOutputs.length > 0) {
    response.scriptOutput = allOutputs.join('\n');
  }

  // Update tab status
  if (requestScript || collectionScript) {
    const { updateTab, activeTabId } = useAppStore.getState();
    if (activeTabId) {
      updateTab(activeTabId, { scriptExecutionStatus: hasError ? 'error' : 'success' });
    }
  }
};

/**
 * Build an isolated Web Worker blob that embeds the user script directly as
 * source code. This avoids `new Function()` / eval(), which would require
 * `'unsafe-eval'` in the Content-Security-Policy. Because the script is part
 * of the blob's own JS source (allowed by `script-src blob:`), no extra CSP
 * directives are needed.
 *
 * Exported for unit testing.
 */
export const buildWorkerSource = (userScript: string) => `'use strict';
self.onmessage = function (e) {
  var data = e.data;
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

  // pm compatibility shim — allows Postman-style scripts to work without changes.
  // pm.environment / pm.variables / pm.globals / pm.collectionVariables all map
  // to fetchy.environment.  pm.response wraps fetchy.response.
  var pm = {
    environment: fetchy.environment,
    variables: fetchy.environment,
    globals: fetchy.environment,
    collectionVariables: fetchy.environment,
    response: {
      json: function () { return fetchy.response ? fetchy.response.data : null; },
      text: function () {
        if (!fetchy.response) return '';
        var d = fetchy.response.data;
        return typeof d === 'string' ? d : JSON.stringify(d);
      },
      code: fetchy.response ? fetchy.response.status : 0,
      status: fetchy.response ? fetchy.response.status : 0,
      responseTime: 0,
      headers: {
        get: function (name) {
          return (fetchy.response && fetchy.response.headers)
            ? fetchy.response.headers[name] || null
            : null;
        },
      },
    },
    test: function (_name, fn) { try { fn(); } catch (_e) {} },
    expect: function () {
      return { to: { equal: function () {}, eql: function () {}, have: { status: function () {} }, be: { ok: function () {}, truthy: function () {}, falsy: function () {} } } };
    },
  };

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
    (function(fetchy, console) {
${userScript}
    })(fetchy, _console);
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
    const blob = new Blob([buildWorkerSource(script)], { type: 'application/javascript' });
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

    // Build the serialisable payload for the worker.
    // Use effective value (currentValue > value > initialValue) so that
    // variables set by previous scripts are visible inside the worker.
    const fetchyData: Record<string, unknown> = {
      environment: environment.map(v => ({
        key: v.key,
        value: (v.currentValue !== undefined && v.currentValue !== '')
          ? v.currentValue
          : (v.value || v.initialValue || ''),
        enabled: v.enabled,
      })),
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

    worker.postMessage({ fetchyData, scriptType });
  });
};

/**
 * Apply environment variable mutations reported by the worker back to the store.
 *
 * Script-set values are written to `currentValue` so they are **transient** –
 * they override the initial/shared value at runtime but are automatically
 * cleared on the next app launch (see persistence.ts → stripTransientEnvValues).
 */
const applyEnvUpdates = (envUpdates?: Array<{ key: string; value: string }>) => {
  if (!envUpdates || envUpdates.length === 0) return;

  const { updateEnvironment, getActiveEnvironment } = useAppStore.getState();
  const activeEnvironment = getActiveEnvironment();
  if (!activeEnvironment) return;

  const variables = [...activeEnvironment.variables];
  for (const { key, value } of envUpdates) {
    const idx = variables.findIndex(v => v.key === key);
    if (idx > -1) {
      // Write to currentValue so the original initialValue / value are preserved
      // Mark _scriptOverride so persistence knows to strip it on restart
      variables[idx] = { ...variables[idx], currentValue: value, _scriptOverride: true } as any;
    } else {
      // New variable created by script – only currentValue is set.
      // On next app load it will be removed because it has no initialValue/value.
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `script-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      variables.push({ id: newId, key, value: '', currentValue: value, enabled: true, _fromScript: true } as any);
    }
  }
  updateEnvironment(activeEnvironment.id, { variables });
};

/**
 * Merge script-produced env updates into an existing environment variables array.
 * For existing keys, `currentValue` is overwritten; for new keys a new entry is
 * created.  This is a pure function — it does NOT mutate the input array.
 *
 * Used to guarantee that variables created/modified by pre-scripts are visible
 * for variable replacement even when no active environment is selected
 * (applyEnvUpdates cannot persist to the store without an active environment).
 */
const mergeScriptEnvUpdates = (
  base: KeyValue[],
  updates: Array<{ key: string; value: string }>,
): KeyValue[] => {
  if (!updates || updates.length === 0) return base;

  const merged = [...base];
  for (const { key, value } of updates) {
    const idx = merged.findIndex(v => v.key === key);
    if (idx > -1) {
      merged[idx] = { ...merged[idx], currentValue: value };
    } else {
      merged.push({
        id: `script-${key}-${Date.now()}`,
        key,
        value: '',
        currentValue: value,
        enabled: true,
      });
    }
  }
  return merged;
};

