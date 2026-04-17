/**
 * AI-Assisted Import – converts arbitrary file content into Fetchy-native
 * JSON (Collection, Environment, or ApiRequest) via an LLM call.
 *
 * The prompts are intentionally strict: the AI must only reformat the data
 * into the expected schema and must never fabricate, remove, or modify the
 * original information.
 */

import type { AIMessage, AISettings, Collection, Environment, ApiRequest } from '../types';
import { sendAIRequest } from './aiProvider';
import { v4 as uuidv4 } from 'uuid';

// ─── Fetchy format schemas (inlined into prompts) ────────────────────────

const COLLECTION_SCHEMA = `{
  "name": "string — collection name",
  "description": "string — optional description",
  "folders": [
    {
      "name": "string — folder name",
      "description": "string — optional",
      "requests": [ /* ApiRequest objects (see below) */ ],
      "folders": [ /* nested folders, same shape */ ]
    }
  ],
  "requests": [
    {
      "name": "string — descriptive request name",
      "method": "GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS",
      "url": "string — full URL with protocol",
      "headers": [
        { "key": "string", "value": "string", "enabled": true, "description": "" }
      ],
      "params": [
        { "key": "string", "value": "string", "enabled": true, "description": "" }
      ],
      "body": {
        "type": "none | json | form-data | x-www-form-urlencoded | raw",
        "raw": "string — body content when type is json/raw",
        "formData": [ { "key": "", "value": "", "enabled": true } ],
        "urlencoded": [ { "key": "", "value": "", "enabled": true } ]
      },
      "auth": {
        "type": "none | inherit | basic | bearer | api-key",
        "basic": { "username": "", "password": "" },
        "bearer": { "token": "" },
        "apiKey": { "key": "", "value": "", "addTo": "header | query" }
      },
      "preScript": "string — optional pre-request script",
      "script": "string — optional post-request test script"
    }
  ],
  "variables": [
    { "key": "string", "value": "string", "enabled": true, "description": "" }
  ],
  "auth": {
    "type": "none | basic | bearer | api-key",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" },
    "apiKey": { "key": "", "value": "", "addTo": "header | query" }
  }
}`;

const ENVIRONMENT_SCHEMA = `{
  "name": "string — environment name",
  "variables": [
    {
      "key": "string — variable name",
      "value": "string — variable value",
      "enabled": true,
      "isSecret": false,
      "description": "string — optional"
    }
  ]
}`;

const REQUEST_SCHEMA = `{
  "name": "string — descriptive request name",
  "method": "GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS",
  "url": "string — full URL with protocol",
  "headers": [
    { "key": "string", "value": "string", "enabled": true, "description": "" }
  ],
  "params": [
    { "key": "string", "value": "string", "enabled": true, "description": "" }
  ],
  "body": {
    "type": "none | json | form-data | x-www-form-urlencoded | raw",
    "raw": "string — body content when type is json/raw",
    "formData": [ { "key": "", "value": "", "enabled": true } ],
    "urlencoded": [ { "key": "", "value": "", "enabled": true } ]
  },
  "auth": {
    "type": "none | inherit | basic | bearer | api-key",
    "basic": { "username": "", "password": "" },
    "bearer": { "token": "" },
    "apiKey": { "key": "", "value": "", "addTo": "header | query" }
  }
}`;

// ─── Prompt builders ────────────────────────────────────────────────────────

const SAFETY_RULES = `CRITICAL RULES:
1. Do NOT fabricate, invent, or add ANY information that is not present in the input.
2. Do NOT remove or omit ANY information from the input.
3. Do NOT change URLs, header values, body content, variable values, or any user data.
4. ONLY reformat / restructure the data to match the target JSON schema.
5. If a field in the target schema has no corresponding data in the input, use the default empty value ("", false, "none", []).
6. Replace template variable syntax (e.g. {{var}}, \${var}, :var) with Fetchy's <<var>> syntax where appropriate.
7. Return ONLY a valid JSON object — no markdown fences, no explanation, no extra text.`;

export function buildCollectionConversionPrompt(content: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are a data format converter for Fetchy, a REST API client.
Your task is to convert the given API collection data (in any format) into Fetchy's native Collection JSON format.

Target schema:
${COLLECTION_SCHEMA}

${SAFETY_RULES}`,
    },
    {
      role: 'user',
      content: `Convert the following data into Fetchy Collection JSON format:\n\n${content}`,
    },
  ];
}

export function buildEnvironmentConversionPrompt(content: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are a data format converter for Fetchy, a REST API client.
Your task is to convert the given environment / variable data (in any format) into Fetchy's native Environment JSON format.

Target schema:
${ENVIRONMENT_SCHEMA}

${SAFETY_RULES}`,
    },
    {
      role: 'user',
      content: `Convert the following data into Fetchy Environment JSON format:\n\n${content}`,
    },
  ];
}

export function buildRequestConversionPrompt(content: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: `You are a data format converter for Fetchy, a REST API client.
Your task is to convert the given request data (which may be a cURL command, HTTP snippet, or any other format) into Fetchy's native Request JSON format.

Target schema:
${REQUEST_SCHEMA}

${SAFETY_RULES}`,
    },
    {
      role: 'user',
      content: `Convert the following data into Fetchy Request JSON format:\n\n${content}`,
    },
  ];
}

// ─── ID injection helpers ───────────────────────────────────────────────────

function injectRequestIds(req: Partial<ApiRequest>): ApiRequest {
  return {
    id: uuidv4(),
    name: req.name || 'Imported Request',
    method: req.method || 'GET',
    url: req.url || '',
    headers: (req.headers || []).map((h) => ({ ...h, id: h.id || uuidv4() })),
    params: (req.params || []).map((p) => ({ ...p, id: p.id || uuidv4() })),
    body: req.body || { type: 'none' },
    auth: req.auth || { type: 'none' },
    preScript: req.preScript,
    script: req.script,
  };
}

function injectFolderIds(folder: any): any {
  return {
    id: uuidv4(),
    name: folder.name || 'Folder',
    description: folder.description || '',
    requests: (folder.requests || []).map(injectRequestIds),
    folders: (folder.folders || []).map(injectFolderIds),
    expanded: false,
    auth: folder.auth || undefined,
  };
}

function injectCollectionIds(raw: any): Collection {
  return {
    id: uuidv4(),
    name: raw.name || 'AI Imported Collection',
    description: raw.description || '',
    folders: (raw.folders || []).map(injectFolderIds),
    requests: (raw.requests || []).map(injectRequestIds),
    variables: (raw.variables || []).map((v: any) => ({
      id: uuidv4(),
      key: v.key || '',
      value: v.value || '',
      enabled: v.enabled !== false,
      description: v.description || '',
    })),
    expanded: true,
    auth: raw.auth || undefined,
  };
}

function injectEnvironmentIds(raw: any): Environment {
  return {
    id: uuidv4(),
    name: raw.name || 'AI Imported Environment',
    variables: (raw.variables || []).map((v: any) => ({
      id: uuidv4(),
      key: v.key || '',
      value: v.value || '',
      initialValue: v.value || '',
      currentValue: '',
      enabled: v.enabled !== false,
      isSecret: v.isSecret || false,
      description: v.description || '',
    })),
  };
}

// ─── Conversion functions ───────────────────────────────────────────────────

function extractJson(text: string): string {
  // Try to extract JSON from markdown fences or raw text
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Try to find the first { ... } or [ ... ] block
  const braceStart = text.indexOf('{');
  const bracketStart = text.indexOf('[');
  if (braceStart === -1 && bracketStart === -1) return text.trim();
  const start = braceStart === -1 ? bracketStart : bracketStart === -1 ? braceStart : Math.min(braceStart, bracketStart);
  // Find matching closing brace/bracket
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

export async function aiConvertCollection(
  settings: AISettings,
  content: string
): Promise<{ collection: Collection | null; error: string | null }> {
  const messages = buildCollectionConversionPrompt(content);
  const result = await sendAIRequest(settings, messages);
  if (!result.success) {
    return { collection: null, error: result.error || 'AI conversion failed' };
  }
  try {
    const parsed = JSON.parse(extractJson(result.content));
    const collection = injectCollectionIds(parsed);
    return { collection, error: null };
  } catch {
    return { collection: null, error: 'AI returned invalid JSON. Please try again or import manually.' };
  }
}

export async function aiConvertEnvironment(
  settings: AISettings,
  content: string
): Promise<{ environment: Environment | null; error: string | null }> {
  const messages = buildEnvironmentConversionPrompt(content);
  const result = await sendAIRequest(settings, messages);
  if (!result.success) {
    return { environment: null, error: result.error || 'AI conversion failed' };
  }
  try {
    const parsed = JSON.parse(extractJson(result.content));
    const environment = injectEnvironmentIds(parsed);
    return { environment, error: null };
  } catch {
    return { environment: null, error: 'AI returned invalid JSON. Please try again or import manually.' };
  }
}

export async function aiConvertRequest(
  settings: AISettings,
  content: string
): Promise<{ request: ApiRequest | null; error: string | null }> {
  const messages = buildRequestConversionPrompt(content);
  const result = await sendAIRequest(settings, messages);
  if (!result.success) {
    return { request: null, error: result.error || 'AI conversion failed' };
  }
  try {
    const parsed = JSON.parse(extractJson(result.content));
    const request = injectRequestIds(parsed);
    return { request, error: null };
  } catch {
    return { request: null, error: 'AI returned invalid JSON. Please try again or import manually.' };
  }
}
