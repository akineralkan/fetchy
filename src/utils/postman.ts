import { v4 as uuidv4 } from 'uuid';
import {
  Collection,
  Environment,
  ApiRequest,
  RequestFolder,
  KeyValue,
  HttpMethod,
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanUrl,
} from '../types';
import { convertMustacheVarsDeep } from './helpers';
import { convertPostmanScript } from './scriptConverter';

// Helper to parse Postman URL
const parsePostmanUrl = (url: PostmanUrl | string): { url: string; params: KeyValue[] } => {
  if (typeof url === 'string') {
    return { url, params: [] };
  }

  const params: KeyValue[] = (url.query || []).map(q => ({
    id: uuidv4(),
    key: q.key,
    value: q.value,
    enabled: !q.disabled,
    description: q.description,
  }));

  return { url: url.raw, params };
};

// Helper to get value from Postman auth field (handles both array and object formats)
const getPostmanAuthValue = (
  authField: Array<{ key: string; value: string }> | Record<string, string> | undefined,
  key: string
): string => {
  if (!authField) return '';

  // If it is an array, use find
  if (Array.isArray(authField)) {
    return authField.find(b => b.key === key)?.value || '';
  }

  // If it is an object, access directly
  if (typeof authField === 'object') {
    return (authField as Record<string, string>)[key] || '';
  }

  return '';
};

// Helper to convert Postman auth
const convertPostmanAuth = (auth?: PostmanRequest['auth']): ApiRequest['auth'] => {
  if (!auth) return { type: 'none' };

  switch (auth.type) {
    case 'basic': {
      const username = getPostmanAuthValue(auth.basic, 'username');
      const password = getPostmanAuthValue(auth.basic, 'password');
      return { type: 'basic', basic: { username, password } };
    }
    case 'bearer': {
      const token = getPostmanAuthValue(auth.bearer, 'token');
      return { type: 'bearer', bearer: { token } };
    }
    case 'apikey': {
      const key = getPostmanAuthValue(auth.apikey, 'key');
      const value = getPostmanAuthValue(auth.apikey, 'value');
      const inValue = getPostmanAuthValue(auth.apikey, 'in');
      const addTo = inValue === 'query' ? 'query' : 'header';
      return { type: 'api-key', apiKey: { key, value, addTo } };
    }
    default:
      return { type: 'none' };
  }
};

// Convert Postman request to our format
const convertPostmanRequest = (item: PostmanItem): ApiRequest | null => {
  if (!item.request) return null;

  const request = item.request;
  const { url, params } = parsePostmanUrl(request.url);

  const headers: KeyValue[] = (request.header || []).map(h => ({
    id: uuidv4(),
    key: h.key,
    value: h.value,
    enabled: !h.disabled,
    description: h.description,
  }));

  let body: ApiRequest['body'] = { type: 'none' };

  if (request.body) {
    switch (request.body.mode) {
      case 'raw':
        body = {
          type: request.body.options?.raw?.language === 'json' ? 'json' : 'raw',
          raw: request.body.raw || '',
        };
        break;
      case 'urlencoded':
        body = {
          type: 'x-www-form-urlencoded',
          urlencoded: (request.body.urlencoded || []).map(u => ({
            id: uuidv4(),
            key: u.key,
            value: u.value,
            enabled: !u.disabled,
            description: u.description,
          })),
        };
        break;
      case 'formdata':
        body = {
          type: 'form-data',
          formData: (request.body.formdata || []).map(f => ({
            id: uuidv4(),
            key: f.key,
            value: f.value,
            enabled: !f.disabled,
            description: f.description,
          })),
        };
        break;
    }
  }

  // Extract pre-request and test scripts from Postman event array
  let preScript: string | undefined;
  let script: string | undefined;

  if (item.event) {
    for (const evt of item.event) {
      const exec = evt.script?.exec;
      if (!exec) continue;
      const raw = Array.isArray(exec) ? exec.join('\n') : exec;
      if (!raw.trim()) continue;

      if (evt.listen === 'prerequest') {
        preScript = convertPostmanScript(raw);
      } else if (evt.listen === 'test') {
        script = convertPostmanScript(raw);
      }
    }
  }

  return {
    id: uuidv4(),
    name: item.name,
    method: (request.method?.toUpperCase() || 'GET') as HttpMethod,
    url,
    headers,
    params,
    body,
    auth: convertPostmanAuth(request.auth),
    preScript,
    script,
  };
};

// Recursively convert Postman items to folders/requests
const convertPostmanItems = (items: PostmanItem[]): { folders: RequestFolder[]; requests: ApiRequest[] } => {
  const folders: RequestFolder[] = [];
  const requests: ApiRequest[] = [];

  for (const item of items) {
    if (item.item) {
      // It is a folder
      const subResult = convertPostmanItems(item.item);
      folders.push({
        id: uuidv4(),
        name: item.name,
        description: item.description,
        folders: subResult.folders,
        requests: subResult.requests,
        expanded: true,
      });
    } else if (item.request) {
      // It is a request
      const request = convertPostmanRequest(item);
      if (request) {
        requests.push(request);
      }
    }
  }

  return { folders, requests };
};

// Import Postman collection
export const importPostmanCollection = (content: string): Collection | null => {
  try {
    // Trim whitespace from content
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('Empty content provided');
    }

    const postman: PostmanCollection = JSON.parse(trimmedContent);

    if (!postman || typeof postman !== 'object') {
      throw new Error('Invalid Postman collection: parsed content is not an object');
    }

    if (!postman.info) {
      throw new Error('Invalid Postman collection format: missing "info" field');
    }

    if (!postman.item) {
      throw new Error('Invalid Postman collection format: missing "item" field');
    }

    const { folders, requests } = convertPostmanItems(postman.item);

    const variables: KeyValue[] = (postman.variable || []).map(v => ({
      id: uuidv4(),
      key: v.key,
      value: v.value, // For backward compatibility
      initialValue: v.value, // Set imported value as initial
      currentValue: '', // Start with empty current value
      enabled: !v.disabled,
    }));

    return convertMustacheVarsDeep({
      id: uuidv4(),
      name: postman.info.name,
      description: postman.info.description,
      folders,
      requests,
      variables,
      expanded: true,
    });
  } catch (error) {
    console.error('Error importing Postman collection:', error);
    throw error; // Re-throw to provide better error messages to the user
  }
};

// Export collection to Postman format
export const exportToPostman = (collection: Collection): string => {
  const convertRequest = (request: ApiRequest): PostmanItem => {
    const headers = request.headers.map(h => ({
      key: h.key,
      value: h.value,
      disabled: !h.enabled,
      description: h.description,
    }));

    let body: PostmanRequest['body'];
    switch (request.body.type) {
      case 'json':
      case 'raw':
        body = {
          mode: 'raw',
          raw: request.body.raw || '',
          options: request.body.type === 'json' ? { raw: { language: 'json' } } : undefined,
        };
        break;
      case 'x-www-form-urlencoded':
        body = {
          mode: 'urlencoded',
          urlencoded: (request.body.urlencoded || []).map(u => ({
            key: u.key,
            value: u.value,
            disabled: !u.enabled,
            description: u.description,
          })),
        };
        break;
      case 'form-data':
        body = {
          mode: 'formdata',
          formdata: (request.body.formData || []).map(f => ({
            key: f.key,
            value: f.value,
            disabled: !f.enabled,
            description: f.description,
          })),
        };
        break;
    }

    return {
      name: request.name,
      request: {
        method: request.method,
        header: headers,
        body,
        url: {
          raw: request.url,
          query: request.params.map(p => ({
            key: p.key,
            value: p.value,
            disabled: !p.enabled,
            description: p.description,
          })),
        },
      },
    };
  };

  const convertFolder = (folder: RequestFolder): PostmanItem => ({
    name: folder.name,
    description: folder.description,
    item: [
      ...folder.folders.map(convertFolder),
      ...folder.requests.map(convertRequest),
    ],
  });

  const postmanCollection: PostmanCollection = {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      ...collection.folders.map(convertFolder),
      ...collection.requests.map(convertRequest),
    ],
    variable: collection.variables?.map(v => ({
      key: v.key,
      value: v.initialValue ?? v.value ?? '', // Export initial value
      disabled: !v.enabled,
    })),
  };

  return JSON.stringify(postmanCollection, null, 2);
};
// ---------------------------------------------------------------------------
// Postman Environment Import
// ---------------------------------------------------------------------------

/**
 * Postman environment export format:
 * {
 *   "id": "uuid",
 *   "name": "Environment Name",
 *   "values": [
 *     { "key": "varName", "value": "varValue", "type": "default"|"secret", "enabled": true }
 *   ],
 *   "_postman_variable_scope": "environment",
 *   "_postman_exported_at": "...",
 *   "_postman_exported_using": "..."
 * }
 */

interface PostmanEnvironment {
  id?: string;
  name: string;
  values: Array<{
    key: string;
    value: string;
    type?: string;
    enabled?: boolean;
    description?: string;
  }>;
  _postman_variable_scope?: string;
}

/**
 * Import a Postman environment from JSON string content.
 * Handles both single environment and arrays of environments.
 * Also handles Postman global variables (same format with _postman_variable_scope: "globals").
 */
export const importPostmanEnvironment = (content: string): Environment[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON: Could not parse the Postman environment file');
  }

  // Handle array of environments
  const envList: PostmanEnvironment[] = Array.isArray(parsed)
    ? parsed
    : [parsed as PostmanEnvironment];

  if (envList.length === 0) {
    throw new Error('No environments found in the file');
  }

  return envList.map((env) => {
    if (!env || typeof env !== 'object') {
      throw new Error('Invalid Postman environment: item is not an object');
    }

    // Validate it looks like a Postman environment
    if (!env.name && !env.values) {
      throw new Error(
        'Invalid Postman environment format: expected "name" and "values" fields'
      );
    }

    const variables: KeyValue[] = (env.values || []).map((v) => ({
      id: uuidv4(),
      key: v.key || '',
      value: v.value || '',
      initialValue: v.value || '',
      currentValue: v.value || '',
      enabled: v.enabled !== false,
      description: v.description,
      isSecret: v.type === 'secret',
    }));

    return convertMustacheVarsDeep({
      id: uuidv4(),
      name: env.name || 'Imported Postman Environment',
      variables,
    });
  });
};