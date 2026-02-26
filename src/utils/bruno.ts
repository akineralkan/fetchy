/**
 * bruno.ts — Bruno collection and environment import parsers.
 *
 * Supports two input formats:
 *   1. Bruno .bru markup files (single request or environment)
 *   2. Bruno JSON export format (collection or environment)
 *
 * .bru request file example:
 *   meta { name: Get Users  type: http  seq: 1 }
 *   get { url: https://api.example.com/users }
 *   headers { Content-Type: application/json }
 *   body:json { {"key":"val"} }
 *
 * .bru environment file example:
 *   vars { API_URL: https://api.example.com  ~DISABLED: val }
 *   vars:secret [ SECRET_KEY, ~DISABLED_SECRET ]
 *
 * Bruno JSON collection export:
 *   { name, version, items: [{ type: "http-request"|"folder", name, request, items }] }
 *
 * Bruno JSON environment export:
 *   { name, variables: [{ name, value, enabled, secret }] }
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Collection,
  Environment,
  ApiRequest,
  RequestFolder,
  KeyValue,
  HttpMethod,
  RequestAuth,
  RequestBody,
} from '../types';

// ---------------------------------------------------------------------------
// .bru file parser — lightweight regex-based parser
// ---------------------------------------------------------------------------

interface BruBlock {
  tag: string;
  content: string;
}

/**
 * Parse a .bru file into blocks. A block is a tag followed by { ... }.
 * Handles nested braces in text blocks like body:json.
 */
const parseBruBlocks = (input: string): BruBlock[] => {
  const blocks: BruBlock[] = [];
  const lines = input.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Match block start: "tagname {" or "tagname:subtype {" or "tagname ["
    const blockMatch = line.match(/^([\w:.\-]+(?:\s*\([^)]*\))?)\s*([\{\[])$/);
    if (blockMatch) {
      const tag = blockMatch[1].trim();
      const openChar = blockMatch[2];
      const closeChar = openChar === '{' ? '}' : ']';
      const contentLines: string[] = [];
      i++;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const currentLine = lines[i];
        // Count matching delimiters (simple heuristic for text blocks)
        for (const ch of currentLine) {
          if (ch === openChar) depth++;
          if (ch === closeChar) depth--;
          if (depth === 0) break;
        }
        if (depth > 0) {
          contentLines.push(currentLine);
        } else {
          // The closing delimiter line — include content before it
          const trimmedLine = currentLine.trimEnd();
          if (trimmedLine !== closeChar) {
            // There's content before the closing delimiter
            const re = closeChar === '}' ? /\}\s*$/ : /\]\s*$/;
            contentLines.push(trimmedLine.replace(re, ''));
          }
        }
        i++;
      }

      blocks.push({ tag, content: contentLines.join('\n') });
    } else {
      i++;
    }
  }

  return blocks;
};

/**
 * Parse key-value pairs from a dictionary block.
 * Format: "  key: value" or "  ~key: value" (~ means disabled)
 */
const parseDictionary = (content: string): Array<{ key: string; value: string; enabled: boolean }> => {
  const pairs: Array<{ key: string; value: string; enabled: boolean }> = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match "key: value" or "~key: value"
    const match = trimmed.match(/^(~?)(.*?):\s*(.*)$/);
    if (match) {
      const disabled = match[1] === '~';
      const key = match[2].trim();
      const value = match[3].trim();
      if (key) {
        pairs.push({ key, value, enabled: !disabled });
      }
    }
  }

  return pairs;
};

/**
 * Parse a list block (used in vars:secret).
 * Format: "  item1,\n  item2" or "  item1\n  item2"
 */
const parseList = (content: string): Array<{ name: string; enabled: boolean }> => {
  const items: Array<{ name: string; enabled: boolean }> = [];
  // Remove surrounding brackets if present
  const cleaned = content.replace(/^\s*\[/, '').replace(/\]\s*$/, '');
  const parts = cleaned.split(/[,\n]+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const disabled = trimmed.startsWith('~');
    const name = disabled ? trimmed.slice(1).trim() : trimmed;
    if (name) {
      items.push({ name, enabled: !disabled });
    }
  }

  return items;
};

// ---------------------------------------------------------------------------
// Convert parsed .bru data to Fetchy types
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

interface ParsedBruRequest {
  meta: Record<string, string>;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  pathParams: Array<{ key: string; value: string; enabled: boolean }>;
  body: RequestBody;
  auth: RequestAuth;
  preScript: string;
  postScript: string;
}

const parseBruRequestFile = (content: string): ParsedBruRequest => {
  const blocks = parseBruBlocks(content);
  const result: ParsedBruRequest = {
    meta: {},
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    pathParams: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    postScript: '',
  };

  for (const block of blocks) {
    const tag = block.tag.toLowerCase();

    // Meta block
    if (tag === 'meta') {
      const pairs = parseDictionary(block.content);
      for (const p of pairs) {
        result.meta[p.key] = p.value;
      }
    }

    // HTTP method blocks
    if (HTTP_METHODS.includes(tag) || tag === 'http') {
      const pairs = parseDictionary(block.content);
      const urlPair = pairs.find((p) => p.key === 'url');
      const methodPair = pairs.find((p) => p.key === 'method');

      if (tag === 'http') {
        result.method = (methodPair?.value || 'GET').toUpperCase();
      } else {
        result.method = tag.toUpperCase();
      }
      result.url = urlPair?.value || '';
    }

    // Headers
    if (tag === 'headers') {
      result.headers = parseDictionary(block.content);
    }

    // Query params
    if (tag === 'query' || tag === 'params:query') {
      result.queryParams = parseDictionary(block.content);
    }

    // Path params
    if (tag === 'params:path') {
      result.pathParams = parseDictionary(block.content);
    }

    // Body blocks
    if (tag === 'body:json' || tag === 'body') {
      result.body = { type: 'json', raw: block.content.trim() };
    } else if (tag === 'body:text') {
      result.body = { type: 'raw', raw: block.content.trim() };
    } else if (tag === 'body:xml') {
      result.body = { type: 'raw', raw: block.content.trim() };
    } else if (tag === 'body:form-urlencoded') {
      const pairs = parseDictionary(block.content);
      result.body = {
        type: 'x-www-form-urlencoded',
        urlencoded: pairs.map((p) => ({
          id: uuidv4(),
          key: p.key,
          value: p.value,
          enabled: p.enabled,
        })),
      };
    } else if (tag === 'body:multipart-form') {
      const pairs = parseDictionary(block.content);
      result.body = {
        type: 'form-data',
        formData: pairs.map((p) => ({
          id: uuidv4(),
          key: p.key,
          value: p.value,
          enabled: p.enabled,
        })),
      };
    }

    // Auth blocks
    if (tag === 'auth:basic') {
      const pairs = parseDictionary(block.content);
      const username = pairs.find((p) => p.key === 'username')?.value || '';
      const password = pairs.find((p) => p.key === 'password')?.value || '';
      result.auth = { type: 'basic', basic: { username, password } };
    } else if (tag === 'auth:bearer') {
      const pairs = parseDictionary(block.content);
      const token = pairs.find((p) => p.key === 'token')?.value || '';
      result.auth = { type: 'bearer', bearer: { token } };
    } else if (tag === 'auth:apikey') {
      const pairs = parseDictionary(block.content);
      const key = pairs.find((p) => p.key === 'key')?.value || '';
      const value = pairs.find((p) => p.key === 'value')?.value || '';
      const placement = pairs.find((p) => p.key === 'placement')?.value || 'header';
      result.auth = {
        type: 'api-key',
        apiKey: { key, value, addTo: placement === 'queryparams' ? 'query' : 'header' },
      };
    }

    // Scripts
    if (tag === 'script:pre-request') {
      result.preScript = block.content.trim();
    }
    if (tag === 'script:post-response') {
      result.postScript = block.content.trim();
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// Bruno JSON format types
// ---------------------------------------------------------------------------

interface BrunoJsonRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string> | Array<{ name: string; value: string; enabled?: boolean }>;
  body?: {
    mode?: string;
    json?: string;
    text?: string;
    xml?: string;
    formUrlEncoded?: Array<{ name: string; value: string; enabled?: boolean }>;
    multipartForm?: Array<{ name: string; value: string; enabled?: boolean; type?: string }>;
  };
  auth?: {
    mode?: string;
    basic?: { username: string; password: string };
    bearer?: { token: string };
    apikey?: { key: string; value: string; placement?: string };
  };
  params?: Array<{ name: string; value: string; enabled?: boolean; type?: string }>;
  script?: {
    req?: string;
    res?: string;
  };
}

interface BrunoJsonItem {
  type?: string;
  name: string;
  request?: BrunoJsonRequest;
  items?: BrunoJsonItem[];
  // For raw .bru content embedded in JSON
  raw?: string;
  seq?: number;
}

interface BrunoJsonCollection {
  name: string;
  version?: string;
  items?: BrunoJsonItem[];
  // Alternative structure (flat)
  requests?: BrunoJsonItem[];
  folders?: BrunoJsonCollection[];
  environments?: BrunoJsonEnvironment[];
}

interface BrunoJsonEnvironmentVariable {
  name?: string;
  key?: string;
  value: string;
  enabled?: boolean;
  secret?: boolean;
}

interface BrunoJsonEnvironment {
  name: string;
  variables?: BrunoJsonEnvironmentVariable[];
}

// ---------------------------------------------------------------------------
// Convert Bruno JSON item to Fetchy types
// ---------------------------------------------------------------------------

const convertBrunoJsonAuth = (auth?: BrunoJsonRequest['auth']): RequestAuth => {
  if (!auth || !auth.mode || auth.mode === 'none') {
    return { type: 'none' };
  }

  switch (auth.mode) {
    case 'basic':
      return {
        type: 'basic',
        basic: {
          username: auth.basic?.username || '',
          password: auth.basic?.password || '',
        },
      };
    case 'bearer':
      return {
        type: 'bearer',
        bearer: { token: auth.bearer?.token || '' },
      };
    case 'apikey':
      return {
        type: 'api-key',
        apiKey: {
          key: auth.apikey?.key || '',
          value: auth.apikey?.value || '',
          addTo: auth.apikey?.placement === 'queryparams' ? 'query' : 'header',
        },
      };
    default:
      return { type: 'none' };
  }
};

const convertBrunoJsonBody = (body?: BrunoJsonRequest['body']): RequestBody => {
  if (!body || !body.mode) {
    // Check for direct body content
    if (body?.json) return { type: 'json', raw: body.json };
    if (body?.text) return { type: 'raw', raw: body.text };
    if (body?.xml) return { type: 'raw', raw: body.xml };
    return { type: 'none' };
  }

  switch (body.mode) {
    case 'json':
      return { type: 'json', raw: body.json || '' };
    case 'text':
      return { type: 'raw', raw: body.text || '' };
    case 'xml':
      return { type: 'raw', raw: body.xml || '' };
    case 'formUrlEncoded':
      return {
        type: 'x-www-form-urlencoded',
        urlencoded: (body.formUrlEncoded || []).map((f) => ({
          id: uuidv4(),
          key: f.name,
          value: f.value,
          enabled: f.enabled !== false,
        })),
      };
    case 'multipartForm':
      return {
        type: 'form-data',
        formData: (body.multipartForm || [])
          .filter((f) => f.type !== 'file') // Skip file entries
          .map((f) => ({
            id: uuidv4(),
            key: f.name,
            value: f.value,
            enabled: f.enabled !== false,
          })),
      };
    default:
      return { type: 'none' };
  }
};

const convertBrunoJsonHeaders = (
  headers?: BrunoJsonRequest['headers']
): KeyValue[] => {
  if (!headers) return [];

  if (Array.isArray(headers)) {
    return headers.map((h) => ({
      id: uuidv4(),
      key: h.name || '',
      value: h.value || '',
      enabled: h.enabled !== false,
    }));
  }

  // Object format: Record<string, string>
  return Object.entries(headers).map(([key, value]) => ({
    id: uuidv4(),
    key,
    value: String(value),
    enabled: true,
  }));
};

const convertBrunoJsonRequest = (item: BrunoJsonItem): ApiRequest | null => {
  const req = item.request;
  if (!req) {
    // If there's embedded .bru content, parse it
    if (item.raw) {
      return convertBruFileToRequest(item.raw, item.name);
    }
    return null;
  }

  const method = (req.method?.toUpperCase() || 'GET') as HttpMethod;
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const safeMethod = validMethods.includes(method) ? method : 'GET';

  const params: KeyValue[] = (req.params || []).map((p) => ({
    id: uuidv4(),
    key: p.name || '',
    value: p.value || '',
    enabled: p.enabled !== false,
  }));

  return {
    id: uuidv4(),
    name: item.name || 'Untitled Request',
    method: safeMethod,
    url: req.url || '',
    headers: convertBrunoJsonHeaders(req.headers),
    params,
    body: convertBrunoJsonBody(req.body),
    auth: convertBrunoJsonAuth(req.auth),
    preScript: req.script?.req || undefined,
    script: req.script?.res || undefined,
  };
};

const convertBrunoJsonItems = (
  items: BrunoJsonItem[]
): { folders: RequestFolder[]; requests: ApiRequest[] } => {
  const folders: RequestFolder[] = [];
  const requests: ApiRequest[] = [];

  for (const item of items) {
    if (item.type === 'folder' || (item.items && item.items.length > 0)) {
      const subResult = convertBrunoJsonItems(item.items || []);
      folders.push({
        id: uuidv4(),
        name: item.name || 'Untitled Folder',
        folders: subResult.folders,
        requests: subResult.requests,
        expanded: true,
      });
    } else {
      const request = convertBrunoJsonRequest(item);
      if (request) {
        requests.push(request);
      }
    }
  }

  return { folders, requests };
};

// ---------------------------------------------------------------------------
// Convert .bru file content to a single ApiRequest
// ---------------------------------------------------------------------------

const convertBruFileToRequest = (content: string, name?: string): ApiRequest => {
  const parsed = parseBruRequestFile(content);
  const method = (parsed.method || 'GET') as HttpMethod;
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const safeMethod = validMethods.includes(method) ? method : 'GET';

  // Merge query params and path params into params
  const allParams: KeyValue[] = [
    ...parsed.queryParams.map((p) => ({
      id: uuidv4(),
      key: p.key,
      value: p.value,
      enabled: p.enabled,
    })),
    ...parsed.pathParams.map((p) => ({
      id: uuidv4(),
      key: p.key,
      value: p.value,
      enabled: p.enabled,
    })),
  ];

  const headers: KeyValue[] = parsed.headers.map((h) => ({
    id: uuidv4(),
    key: h.key,
    value: h.value,
    enabled: h.enabled,
  }));

  return {
    id: uuidv4(),
    name: name || parsed.meta.name || 'Imported Request',
    method: safeMethod,
    url: parsed.url,
    headers,
    params: allParams,
    body: parsed.body,
    auth: parsed.auth,
    preScript: parsed.preScript || undefined,
    script: parsed.postScript || undefined,
  };
};

// ---------------------------------------------------------------------------
// Public API — Collection Import
// ---------------------------------------------------------------------------

/**
 * Detect whether the content is a .bru file or JSON.
 */
const isBruMarkup = (content: string): boolean => {
  const trimmed = content.trim();
  // .bru files don't start with { or [
  // They start with block tags like "meta", "get", "post", etc.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  // Check for common .bru block patterns
  return /^(meta|get|post|put|delete|patch|options|head|connect|trace|http)\s*\{/m.test(trimmed);
};

/**
 * Detect whether the content is a .bru environment file.
 */
const isBruEnvironment = (content: string): boolean => {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  return /^(vars|vars:secret)\s*[\{[]/m.test(trimmed);
};

/**
 * Import a Bruno collection from .bru file content or JSON.
 * - .bru file: creates a collection with a single request
 * - JSON: parses Bruno collection JSON format
 */
export const importBrunoCollection = (content: string): Collection => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  // Handle .bru file format
  if (isBruMarkup(trimmed)) {
    const request = convertBruFileToRequest(trimmed);
    return {
      id: uuidv4(),
      name: request.name !== 'Imported Request' ? `${request.name} (Bruno Import)` : 'Bruno Import',
      description: 'Imported from Bruno .bru file',
      folders: [],
      requests: [request],
      variables: [],
      expanded: true,
    };
  }

  // Handle JSON format
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid content: not a valid .bru file or JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Bruno collection: parsed content is not an object');
  }

  const data = parsed as BrunoJsonCollection;

  if (!data.name && !data.items && !data.requests) {
    throw new Error('Invalid Bruno collection format: missing "name", "items", or "requests" field');
  }

  const items = data.items || data.requests || [];
  const { folders: subFolders, requests } = convertBrunoJsonItems(items);

  // Handle nested folders from the JSON format
  const additionalFolders: RequestFolder[] = (data.folders || []).map((f) => {
    const fItems = f.items || f.requests || [];
    const result = convertBrunoJsonItems(fItems);
    return {
      id: uuidv4(),
      name: f.name || 'Untitled Folder',
      folders: result.folders,
      requests: result.requests,
      expanded: true,
    };
  });

  return {
    id: uuidv4(),
    name: data.name || 'Bruno Import',
    description: 'Imported from Bruno collection',
    folders: [...subFolders, ...additionalFolders],
    requests,
    variables: [],
    expanded: true,
  };
};

// ---------------------------------------------------------------------------
// Public API — Environment Import
// ---------------------------------------------------------------------------

/**
 * Parse a .bru environment file content.
 */
const parseBruEnvironmentFile = (content: string): { variables: KeyValue[]; name?: string } => {
  const blocks = parseBruBlocks(content);
  const variables: KeyValue[] = [];

  for (const block of blocks) {
    const tag = block.tag.toLowerCase();

    if (tag === 'vars') {
      const pairs = parseDictionary(block.content);
      for (const p of pairs) {
        variables.push({
          id: uuidv4(),
          key: p.key,
          value: p.value,
          initialValue: p.value,
          currentValue: p.value,
          enabled: p.enabled,
          isSecret: false,
        });
      }
    }

    if (tag === 'vars:secret') {
      const items = parseList(block.content);
      for (const item of items) {
        variables.push({
          id: uuidv4(),
          key: item.name,
          value: '',
          initialValue: '',
          currentValue: '',
          enabled: item.enabled,
          isSecret: true,
        });
      }
    }
  }

  return { variables };
};

/**
 * Import Bruno environment(s) from .bru file content or JSON.
 * Returns an array of Environment objects.
 */
export const importBrunoEnvironment = (content: string): Environment[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  // Handle .bru environment file format
  if (isBruEnvironment(trimmed)) {
    const parsed = parseBruEnvironmentFile(trimmed);
    return [
      {
        id: uuidv4(),
        name: 'Bruno Environment',
        variables: parsed.variables,
      },
    ];
  }

  // Handle JSON format
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid content: not a valid Bruno environment .bru file or JSON');
  }

  // Handle array of environments
  const envList: BrunoJsonEnvironment[] = Array.isArray(parsed)
    ? parsed
    : [parsed as BrunoJsonEnvironment];

  if (envList.length === 0) {
    throw new Error('No environments found in the file');
  }

  return envList.map((env) => {
    if (!env || typeof env !== 'object') {
      throw new Error('Invalid Bruno environment: item is not an object');
    }
    if (!env.name && !env.variables) {
      throw new Error('Invalid Bruno environment format: expected "name" or "variables" field');
    }

    const variables: KeyValue[] = (env.variables || []).map((v) => ({
      id: uuidv4(),
      key: v.name || v.key || '',
      value: v.value || '',
      initialValue: v.value || '',
      currentValue: v.value || '',
      enabled: v.enabled !== false,
      isSecret: v.secret || false,
    }));

    return {
      id: uuidv4(),
      name: env.name || 'Bruno Environment',
      variables,
    };
  });
};
