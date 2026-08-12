/**
 * AI Provider utility – builds prompts for each AI feature and routes
 * requests through the Electron IPC bridge (or falls back to fetch in
 * browser mode for development).
 */

import type {
  AISettings,
  AIMessage,
  AIResponseResult,
  AIProvider,
  ApiRequest,
  ApiResponse,
} from '../types';

// ─── Default AI settings ────────────────────────────────────────────────────

export const defaultAISettings: AISettings = {
  enabled: true,
  provider: 'ollama',
  apiKey: '',
  model: 'llama3.1',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 2048,
  persistToFile: false,
};

// ─── Provider metadata ──────────────────────────────────────────────────────

export interface ProviderMeta {
  label: string;
  description: string;
  models: string[];
  defaultModel: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  baseUrlPlaceholder?: string;
}

export const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  gemini: {
    label: 'Google Gemini',
    description: 'Gemini 2.5 Flash',
    models: ['gemini-2.5-flash'],
    defaultModel: 'gemini-2.5-flash',
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run local models with Ollama – no API key needed',
    models: ['llama3.1'],
    defaultModel: 'llama3.1',
    requiresApiKey: false,
    requiresBaseUrl: true,
    baseUrlPlaceholder: 'http://localhost:11434',
  },
  siemens: {
    label: 'Siemens AI',
    description: 'Siemens LLM API – code.siemens.io/ai',
    models: [
      'mistral-7b-instruct',
      'qwen-3.5-27b',
      'qwen3-30b-a3b-instruct-2507',
      'deepseek-r1-0528-qwen3-8b',
      'gpt-oss-120b',
      'llama-3.1-8b-instruct',
    ],
    defaultModel: 'mistral-7b-instruct',
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
};

// ─── Prompt builders ────────────────────────────────────────────────────────

function requestSummary(req: ApiRequest): string {
  const parts = [`${req.method} ${req.url}`];
  const enabledHeaders = req.headers.filter((h) => h.enabled && h.key);
  if (enabledHeaders.length) {
    parts.push('Headers: ' + enabledHeaders.map((h) => `${h.key}: ${h.value}`).join(', '));
  }
  if (req.body.type !== 'none' && req.body.raw) {
    const bodyPreview = req.body.raw.length > 1000 ? req.body.raw.slice(0, 1000) + '…' : req.body.raw;
    parts.push(`Body (${req.body.type}): ${bodyPreview}`);
  }
  return parts.join('\n');
}

function responseSummary(res: ApiResponse): string {
  const parts = [`Status: ${res.status} ${res.statusText}`, `Time: ${res.time}ms`, `Size: ${res.size} bytes`];
  if (res.body) {
    const bodyPreview = res.body.length > 2000 ? res.body.slice(0, 2000) + '…' : res.body;
    parts.push(`Body:\n${bodyPreview}`);
  }
  return parts.join('\n');
}

export function buildGenerateRequestPrompt(description: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert API developer assistant integrated into a REST client application called Fetchy.
When the user describes an API request in natural language, generate a valid JSON object with this exact structure:
{
  "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|QUERY",
  "url": "full URL with protocol",
  "headers": [{"key": "Content-Type", "value": "application/json", "enabled": true}],
  "params": [{"key": "param", "value": "value", "enabled": true}],
  "body": {"type": "none|json|form-data|x-www-form-urlencoded|raw", "raw": "body content if applicable"},
  "name": "A descriptive name for the request"
}
Return ONLY the JSON object, no markdown fences, no explanation.`,
    },
    { role: 'user', content: description },
  ];
}

export function buildGenerateScriptPrompt(
  req: ApiRequest,
  res: ApiResponse | undefined,
  scriptType: 'pre-request' | 'test'
): AIMessage[] {
  const context = [`Request:\n${requestSummary(req)}`];
  if (res) context.push(`Response:\n${responseSummary(res)}`);

  const scriptPurpose =
    scriptType === 'pre-request'
      ? 'a pre-request script that runs before the request is sent. It can set environment variables, log information, generate dynamic values, etc.'
      : 'a test/post-request script that runs after receiving the response. It should validate the response status, check response body content, extract and store values, etc.';

  const preRequestAPI = `Pre-request script API:
- fetchy.environment.get(key)        → returns the value of an environment variable
- fetchy.environment.set(key, value) → sets an environment variable
- fetchy.environment.all()           → returns an array of all environment variables
- console.log(...)                   → print output to the Console tab`;

  const postRequestAPI = `Post-request (test) script API:
- fetchy.response.data               → parsed JSON response body (object)
- fetchy.response.headers            → response headers object
- fetchy.response.status             → HTTP status code (number, e.g. 200)
- fetchy.response.statusText         → HTTP status text (string, e.g. "OK")
- fetchy.environment.get(key)        → returns the value of an environment variable
- fetchy.environment.set(key, value) → sets an environment variable
- fetchy.environment.all()           → returns an array of all environment variables
- console.log(...)                   → print output to the Console tab`;

  const apiReference = scriptType === 'pre-request' ? preRequestAPI : postRequestAPI;

  return [
    {
      role: 'system',
      content: `You are an expert API testing assistant integrated into Fetchy, a REST client application.
Generate ${scriptPurpose}

IMPORTANT: Fetchy uses its own scripting API. Do NOT use pm.*, postman.*, pw.*, bru.*, or any other API client globals.
Only use the fetchy.* API described below.

${apiReference}

Use standard JavaScript conditionals and console.log for assertions/validation (there is no pm.test or pm.expect).

Return ONLY the JavaScript code, no markdown fences, no explanation.`,
    },
    {
      role: 'user',
      content: `Generate a ${scriptType} script for this request:\n\n${context.join('\n\n')}`,
    },
  ];
}

export function buildExplainResponsePrompt(req: ApiRequest, res: ApiResponse): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert API developer assistant integrated into Fetchy, a REST client application.
Explain the API response in a clear, concise and developer-friendly way. Include:
1. What the status code means
2. A summary of the response headers (only notable ones)
3. An explanation of the response body structure and content
4. Any potential issues or things to note
Keep it brief but informative. Use markdown formatting.`,
    },
    {
      role: 'user',
      content: `Explain this API response:\n\nRequest: ${req.method} ${req.url}\n\n${responseSummary(res)}`,
    },
  ];
}

export function buildGenerateDocsPrompt(req: ApiRequest, res?: ApiResponse): AIMessage[] {
  const context = [requestSummary(req)];
  if (res) context.push(responseSummary(res));
  return [
    {
      role: 'system',
      content: `You are an expert technical writer integrated into Fetchy, a REST client application.
Generate clear API documentation in markdown for the given request/response. Include:
1. Endpoint description
2. HTTP method and URL
3. Request headers (table)
4. Request parameters (table)
5. Request body schema (if applicable)
6. Response format with example
7. Status codes and their meanings
Be concise and professional.`,
    },
    {
      role: 'user',
      content: `Generate API documentation for:\n\n${context.join('\n\n')}`,
    },
  ];
}

export function buildSuggestNamePrompt(req: ApiRequest): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are an API naming assistant. Given an API request, suggest a short, descriptive name (3-6 words max).
Return ONLY the name, nothing else. No quotes, no explanation.`,
    },
    {
      role: 'user',
      content: `Suggest a name for: ${req.method} ${req.url}${req.body.type !== 'none' ? ` (body: ${req.body.type})` : ''}`,
    },
  ];
}

export function buildGenerateBugReportPrompt(req: ApiRequest, res: ApiResponse, userNote: string): AIMessage[] {
  // Format: YYYY-MM-DD HH:MM:SS (user's local timezone)
  const now = new Date();
  const reportDate = now.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const fullHeaders = req.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => `${h.key}: ${h.value}`)
    .join('\n');

  const fullParams = req.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${p.key}=${p.value}`)
    .join('\n');

  let requestBody = '(none)';
  if (req.body.type !== 'none') {
    if (req.body.raw) {
      requestBody = `[${req.body.type}]\n${req.body.raw}`;
    } else if (req.body.type === 'form-data' && req.body.formData) {
      requestBody = `[form-data]\n${req.body.formData.filter(f => f.enabled).map(f => `${f.key}: ${f.value}`).join('\n')}`;
    } else if (req.body.type === 'x-www-form-urlencoded' && req.body.urlencoded) {
      requestBody = `[x-www-form-urlencoded]\n${req.body.urlencoded.filter(f => f.enabled).map(f => `${f.key}=${f.value}`).join('&')}`;
    }
  }

  const responseHeaders = Object.entries(res.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let responseBody = res.body || '(empty)';
  if (responseBody.length > 5000) {
    responseBody = responseBody.slice(0, 5000) + '\n... (truncated)';
  }

  return [
    {
      role: 'system',
      content: `You are an expert QA engineer and bug report writer integrated into Fetchy, a REST client application.
Generate a detailed, well-structured bug report in markdown using EXACTLY this template:

---

# 🐛 Bug Report

## Title
<A concise, descriptive one-line title>

## Severity
<Critical / High / Medium / Low – infer from the status code and issue>

## Environment
- **Tool:** Fetchy REST Client
- **Date:** ${reportDate}

## Description
<2-3 sentence summary of the issue based on the user's note and the actual response>

## Steps to Reproduce
1. Open Fetchy REST Client
2. Create a new **<METHOD>** request to \`<URL>\`
3. Set the following headers: <list headers or "(none)">
4. Set the following query parameters: <list params or "(none)">
5. Set the request body: <describe body or "(none)">
6. Send the request

## Expected Result
<What the user expected based on their note>

## Actual Result
- **Status Code:** <status> <statusText>
- **Response Time:** <time>ms
- **Response Size:** <size> bytes

### Response Headers
\`\`\`
<response headers>
\`\`\`

### Response Body
\`\`\`json
<response body>
\`\`\`

## Request Details (for reproduction)

### Request Headers
\`\`\`
<request headers>
\`\`\`

### Request Body
\`\`\`
<request body>
\`\`\`

## Analysis
<Brief technical analysis of what might be going wrong, based on the status code, headers, and response body>

## Suggested Next Steps
- <action 1>
- <action 2>
- <action 3>

---

Fill in ALL sections using the provided request/response data. Use markdown formatting. Do NOT skip any section.`,
    },
    {
      role: 'user',
      content: `Generate a bug report for this API issue.

User's note: ${userNote}

--- REQUEST ---
Method: ${req.method}
URL: ${req.url}
Headers:
${fullHeaders || '(none)'}
Query Parameters:
${fullParams || '(none)'}
Body:
${requestBody}
Authentication: ${req.auth.type !== 'none' ? req.auth.type : '(none)'}

--- RESPONSE ---
Status: ${res.status} ${res.statusText}
Time: ${res.time}ms
Size: ${res.size} bytes
Headers:
${responseHeaders}
Body:
${responseBody}`,
    },
  ];
}

export function buildCustomChatPrompt(req: ApiRequest, res: ApiResponse, userMessage: string): AIMessage[] {
  const fullHeaders = req.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => `${h.key}: ${h.value}`)
    .join('\n');

  const fullParams = req.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${p.key}=${p.value}`)
    .join('\n');

  let requestBody = '(none)';
  if (req.body.type !== 'none') {
    if (req.body.raw) {
      requestBody = `[${req.body.type}]\n${req.body.raw}`;
    } else if (req.body.type === 'form-data' && req.body.formData) {
      requestBody = `[form-data]\n${req.body.formData.filter(f => f.enabled).map(f => `${f.key}: ${f.value}`).join('\n')}`;
    } else if (req.body.type === 'x-www-form-urlencoded' && req.body.urlencoded) {
      requestBody = `[x-www-form-urlencoded]\n${req.body.urlencoded.filter(f => f.enabled).map(f => `${f.key}=${f.value}`).join('&')}`;
    }
  }

  const responseHeaders = Object.entries(res.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let responseBody = res.body || '(empty)';
  if (responseBody.length > 5000) {
    responseBody = responseBody.slice(0, 5000) + '\n... (truncated)';
  }

  const context = `--- REQUEST ---
Method: ${req.method}
URL: ${req.url}
Headers:
${fullHeaders || '(none)'}
Query Parameters:
${fullParams || '(none)'}
Body:
${requestBody}
Authentication: ${req.auth.type !== 'none' ? req.auth.type : '(none)'}

--- RESPONSE ---
Status: ${res.status} ${res.statusText}
Time: ${res.time}ms
Size: ${res.size} bytes
Headers:
${responseHeaders}
Body:
${responseBody}`;

  return [
    {
      role: 'system',
      content: `You are an expert API developer assistant integrated into Fetchy, a REST client application.
The user is asking a custom question about the API request and response shown below. Answer helpfully, accurately, and concisely. Use markdown formatting where appropriate.\n\n${context}`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];
}

export function buildConvertToFetchySyntaxPrompt(scriptCode: string, scriptType: 'pre' | 'post'): AIMessage[] {
  const typeLabel = scriptType === 'pre' ? 'pre-request' : 'post-request';

  const preExamples = `
// Set an environment variable
fetchy.environment.set('key', 'value');

// Get an environment variable
const value = fetchy.environment.get('key');

// Get all environment variables
const vars = fetchy.environment.all();
console.log(vars);

// Log output to the Console tab
console.log('message');

// Generate a UUID and store it
const uuid = crypto.randomUUID();
fetchy.environment.set('uuid', uuid);
console.log('UUID:', uuid);

// Store the current Unix timestamp
const ts = String(Date.now());
fetchy.environment.set('timestamp', ts);
console.log('Timestamp:', ts);

// Generate a random integer
const rand = String(Math.floor(Math.random() * 1000));
fetchy.environment.set('randomNum', rand);
`;

  const postExamples = `
// Log the full response body
console.log(fetchy.response.data);

// Read the HTTP status code
const status = fetchy.response.status;
console.log('Status:', status);

// Read a specific response header
const ct = fetchy.response.headers['content-type'];
console.log('Content-Type:', ct);

// Extract a field from the JSON response and save it
const value = fetchy.response.data.field;
fetchy.environment.set('key', value);

// Save an access token from the response body
const token = fetchy.response.data.access_token
  || fetchy.response.data.token;
if (token) {
  fetchy.environment.set('token', token);
  console.log('Token saved.');
}

// Check status code and branch
if (fetchy.response.status === 200) {
  console.log('Request succeeded!');
} else {
  console.log('Unexpected status:', fetchy.response.status);
}

// Set an environment variable from the response
fetchy.environment.set('key', 'value');

// Get an environment variable
const envValue = fetchy.environment.get('key');

// Log all environment variables
const allVars = fetchy.environment.all();
console.log(allVars);
`;

  const examples = scriptType === 'pre' ? preExamples : postExamples;

  return [
    {
      role: 'system',
      content: `You are an expert JavaScript developer assistant integrated into Fetchy, a REST client application.
Fetchy scripts use a built-in \`fetchy\` API for interacting with the environment and response. Convert the provided script to use proper Fetchy syntax.

Fetchy API reference:
- \`fetchy.environment.set(key, value)\` — set an environment variable
- \`fetchy.environment.get(key)\` — get an environment variable (returns string or undefined)
- \`fetchy.environment.all()\` — get all variables as an array of { key, value } objects
${scriptType === 'post' ? `- \`fetchy.response.status\` — HTTP status code (number)
- \`fetchy.response.statusText\` — status text string
- \`fetchy.response.data\` — parsed response body (object if JSON, otherwise string)
- \`fetchy.response.headers\` — response headers as an object (keys lowercased)
- \`fetchy.response.time\` — response time in ms
- \`fetchy.response.size\` — response size in bytes` : ''}
- \`console.log(...)\` — print to the Fetchy Console tab

Real Fetchy snippet examples (use these as conversion patterns):
\`\`\`javascript${examples}\`\`\`

Rules:
- Return ONLY the converted JavaScript code, no explanations, no markdown fences.
- Replace any fetch/axios calls, localStorage, or non-Fetchy APIs with the appropriate Fetchy equivalents.
- Use the snippet examples above as authoritative patterns for correct Fetchy syntax.
- Keep the original logic and comments intact.
- If something cannot be converted, add a \`// TODO:\` comment explaining why.`,
    },
    {
      role: 'user',
      content: `Convert this ${typeLabel} script to use Fetchy syntax:\n\n${scriptCode || '// (empty script)'}`,
    },
  ];
}

export function buildScriptChatPrompt(scriptCode: string, scriptType: 'pre' | 'post', userMessage: string): AIMessage[] {
  const typeLabel = scriptType === 'pre' ? 'pre-request' : 'post-request';
  return [
    {
      role: 'system',
      content: `You are an expert JavaScript developer assistant integrated into Fetchy, a REST client application.
The user is working on a ${typeLabel} script in Fetchy. Fetchy scripts use a built-in \`fetchy\` API:

- \`fetchy.environment.set(key, value)\` — set an environment variable
- \`fetchy.environment.get(key)\` — get an environment variable (returns string or undefined)
- \`fetchy.environment.all()\` — get all variables as an array of { key, value } objects
${scriptType === 'post' ? `- \`fetchy.response.status\` — HTTP status code (number)
- \`fetchy.response.statusText\` — status text string
- \`fetchy.response.data\` — parsed response body (object if JSON, otherwise string)
- \`fetchy.response.headers\` — response headers as an object (keys lowercased)
- \`fetchy.response.time\` — response time in ms
- \`fetchy.response.size\` — response size in bytes` : ''}
- \`console.log(...)\` — print to the Fetchy Console tab

Current script:
\`\`\`javascript
${scriptCode || '// (empty script)'}
\`\`\`

Answer the user's question helpfully and concisely. Use markdown formatting. When showing code, use \`\`\`javascript fences.`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];
}

// ─── Request execution ──────────────────────────────────────────────────────

export async function sendAIRequest(
  settings: AISettings,
  messages: AIMessage[]
): Promise<AIResponseResult> {
  if (!settings.enabled) {
    return { success: false, content: '', error: 'AI features are not enabled. Configure them in Settings → AI.' };
  }

  const meta = PROVIDER_META[settings.provider];
  if (meta.requiresApiKey && !settings.apiKey) {
    return { success: false, content: '', error: `API key is required for ${meta.label}. Configure it in Settings → AI.` };
  }
  if (meta.requiresBaseUrl && !settings.baseUrl && settings.provider !== 'ollama') {
    return { success: false, content: '', error: `Base URL is required for ${meta.label}. Configure it in Settings → AI.` };
  }

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  if (isElectron && window.electronAPI) {
    return window.electronAPI.aiRequest({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model || meta.defaultModel,
      baseUrl: settings.baseUrl,
      messages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
  }

  // Browser fallback – direct fetch (will be blocked by CORS for most providers)
  return { success: false, content: '', error: 'AI features require the Electron desktop app.' };
}
