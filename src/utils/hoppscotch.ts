/**
 * hoppscotch.ts — Hoppscotch collection and environment import parsers.
 *
 * Hoppscotch exports collections as JSON arrays of HoppCollection objects
 * and environments as JSON objects (or arrays) following the HoppEnvironment schema.
 *
 * Collection schema (simplified):
 *   { v: number, name: string, folders: [], requests: [], auth: {}, headers: [], variables: [], description: string|null }
 *
 * Request schema (HoppRESTRequest):
 *   { v: string, name, method, endpoint, params: [{key,value,active}], headers: [{key,value,active}],
 *     body: {contentType, body}, auth: {authType,...}, preRequestScript, testScript, requestVariables, description }
 *
 * Environment schema:
 *   { v: number, id: string, name: string, variables: [{key,initialValue,currentValue,secret}] }
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
// Types for the Hoppscotch JSON structures
// ---------------------------------------------------------------------------

interface HoppRESTHeader {
  key: string;
  value: string;
  active: boolean;
  description?: string;
}

interface HoppRESTParam {
  key: string;
  value: string;
  active: boolean;
  description?: string;
}

interface HoppRESTAuth {
  authType: string;
  authActive?: boolean;
  username?: string;
  password?: string;
  token?: string;
  key?: string;
  value?: string;
  addTo?: string;
  // OAuth2 and other advanced auth types are mapped to 'none' since Fetchy doesn't support them
}

interface HoppRESTBody {
  contentType: string | null;
  body: string | null;
}

interface HoppRESTRequest {
  v?: string;
  name: string;
  method: string;
  endpoint: string;
  params?: HoppRESTParam[];
  headers?: HoppRESTHeader[];
  body?: HoppRESTBody;
  auth?: HoppRESTAuth;
  preRequestScript?: string;
  testScript?: string;
  requestVariables?: HoppRESTParam[];
  description?: string | null;
}

interface HoppCollection {
  v?: number;
  name: string;
  folders?: HoppCollection[];
  requests?: HoppRESTRequest[];
  auth?: HoppRESTAuth;
  headers?: HoppRESTHeader[];
  variables?: Array<{
    key: string;
    initialValue?: string;
    currentValue?: string;
    value?: string;
    secret?: boolean;
  }>;
  description?: string | null;
}

interface HoppEnvironmentVariable {
  key: string;
  initialValue?: string;
  currentValue?: string;
  value?: string;
  secret?: boolean;
}

interface HoppEnvironment {
  v?: number;
  id?: string;
  name: string;
  variables: HoppEnvironmentVariable[];
}

// ---------------------------------------------------------------------------
// Auth conversion
// ---------------------------------------------------------------------------

const convertHoppAuth = (auth?: HoppRESTAuth): RequestAuth => {
  if (!auth || auth.authType === 'none' || !auth.authType) {
    return { type: 'none' };
  }

  if (auth.authType === 'inherit') {
    return { type: 'inherit' };
  }

  switch (auth.authType) {
    case 'basic':
      return {
        type: 'basic',
        basic: {
          username: auth.username || '',
          password: auth.password || '',
        },
      };
    case 'bearer':
      return {
        type: 'bearer',
        bearer: { token: auth.token || '' },
      };
    case 'api-key':
      return {
        type: 'api-key',
        apiKey: {
          key: auth.key || '',
          value: auth.value || '',
          addTo: auth.addTo === 'query' ? 'query' : 'header',
        },
      };
    default:
      // OAuth2, AWS, Digest, etc. are not supported — fall back to none
      return { type: 'none' };
  }
};

// ---------------------------------------------------------------------------
// Body conversion
// ---------------------------------------------------------------------------

const convertHoppBody = (body?: HoppRESTBody): RequestBody => {
  if (!body || !body.contentType) {
    return { type: 'none' };
  }

  switch (body.contentType) {
    case 'application/json':
      return { type: 'json', raw: body.body || '' };
    case 'application/x-www-form-urlencoded': {
      // Hoppscotch stores form-urlencoded as a stringified array or raw string
      let urlencoded: KeyValue[] = [];
      if (body.body) {
        try {
          const parsed = JSON.parse(body.body);
          if (Array.isArray(parsed)) {
            urlencoded = parsed.map((item: { key?: string; value?: string; active?: boolean }) => ({
              id: uuidv4(),
              key: item.key || '',
              value: item.value || '',
              enabled: item.active !== false,
            }));
          }
        } catch {
          // If not JSON, parse as URL-encoded string
          const pairs = body.body.split('&');
          urlencoded = pairs.map((pair) => {
            const [key = '', value = ''] = pair.split('=').map(decodeURIComponent);
            return { id: uuidv4(), key, value, enabled: true };
          });
        }
      }
      return { type: 'x-www-form-urlencoded', urlencoded };
    }
    case 'multipart/form-data': {
      let formData: KeyValue[] = [];
      if (body.body) {
        try {
          const parsed = JSON.parse(body.body);
          if (Array.isArray(parsed)) {
            formData = parsed.map((item: { key?: string; value?: string; active?: boolean }) => ({
              id: uuidv4(),
              key: item.key || '',
              value: item.value || '',
              enabled: item.active !== false,
            }));
          }
        } catch {
          // Can't parse — leave empty
        }
      }
      return { type: 'form-data', formData };
    }
    case 'text/plain':
    case 'application/xml':
    case 'text/xml':
    case 'text/html':
      return { type: 'raw', raw: body.body || '' };
    default:
      return { type: 'raw', raw: body.body || '' };
  }
};

// ---------------------------------------------------------------------------
// Request conversion
// ---------------------------------------------------------------------------

const convertHoppRequest = (req: HoppRESTRequest): ApiRequest => {
  const method = (req.method?.toUpperCase() || 'GET') as HttpMethod;
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const safeMethod = validMethods.includes(method) ? method : 'GET';

  const headers: KeyValue[] = (req.headers || []).map((h) => ({
    id: uuidv4(),
    key: h.key || '',
    value: h.value || '',
    enabled: h.active !== false,
    description: h.description,
  }));

  const params: KeyValue[] = (req.params || []).map((p) => ({
    id: uuidv4(),
    key: p.key || '',
    value: p.value || '',
    enabled: p.active !== false,
    description: p.description,
  }));

  return {
    id: uuidv4(),
    name: req.name || 'Untitled Request',
    method: safeMethod,
    url: req.endpoint || '',
    headers,
    params,
    body: convertHoppBody(req.body),
    auth: convertHoppAuth(req.auth),
    preScript: req.preRequestScript || undefined,
    script: req.testScript || undefined,
  };
};

// ---------------------------------------------------------------------------
// Folder / Collection conversion (recursive)
// ---------------------------------------------------------------------------

const convertHoppFolder = (folder: HoppCollection): RequestFolder => {
  const subFolders = (folder.folders || []).map(convertHoppFolder);
  const requests = (folder.requests || []).map(convertHoppRequest);

  return {
    id: uuidv4(),
    name: folder.name || 'Untitled Folder',
    description: folder.description || undefined,
    folders: subFolders,
    requests,
    expanded: true,
    auth: convertHoppAuth(folder.auth),
  };
};

const convertHoppCollection = (coll: HoppCollection): Collection => {
  const subFolders = (coll.folders || []).map(convertHoppFolder);
  const requests = (coll.requests || []).map(convertHoppRequest);

  const variables: KeyValue[] = (coll.variables || []).map((v) => ({
    id: uuidv4(),
    key: v.key || '',
    value: v.initialValue ?? v.value ?? '',
    initialValue: v.initialValue ?? v.value ?? '',
    currentValue: v.currentValue ?? '',
    enabled: true,
  }));

  return {
    id: uuidv4(),
    name: coll.name || 'Imported Collection',
    description: coll.description || undefined,
    folders: subFolders,
    requests,
    variables,
    expanded: true,
    auth: convertHoppAuth(coll.auth),
  };
};

// ---------------------------------------------------------------------------
// Public API — Collection Import
// ---------------------------------------------------------------------------

/**
 * Import a Hoppscotch collection from JSON string content.
 * Handles both single collection objects and arrays of collections.
 * Returns an array of Collection objects.
 */
export const importHoppscotchCollection = (content: string): Collection[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON: Could not parse the Hoppscotch collection file');
  }

  // Hoppscotch exports either a single collection object or an array of collections
  const collections: HoppCollection[] = Array.isArray(parsed) ? parsed : [parsed];

  if (collections.length === 0) {
    throw new Error('No collections found in the file');
  }

  // Validate basic structure
  for (const coll of collections) {
    if (!coll || typeof coll !== 'object') {
      throw new Error('Invalid Hoppscotch collection: item is not an object');
    }
    if (!coll.name && !coll.requests && !coll.folders) {
      throw new Error(
        'Invalid Hoppscotch collection format: expected "name", "requests", or "folders" field'
      );
    }
  }

  return collections.map(convertHoppCollection);
};

// ---------------------------------------------------------------------------
// Public API — Environment Import
// ---------------------------------------------------------------------------

/**
 * Import Hoppscotch environment(s) from JSON string content.
 * Handles: single environment, array of environments, or bulk export format.
 */
export const importHoppscotchEnvironment = (content: string): Environment[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty content provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON: Could not parse the Hoppscotch environment file');
  }

  const envList: HoppEnvironment[] = Array.isArray(parsed) ? parsed : [parsed as HoppEnvironment];

  if (envList.length === 0) {
    throw new Error('No environments found in the file');
  }

  return envList.map((env) => {
    if (!env || typeof env !== 'object') {
      throw new Error('Invalid Hoppscotch environment: item is not an object');
    }
    if (!env.name && !env.variables) {
      throw new Error(
        'Invalid Hoppscotch environment format: expected "name" or "variables" field'
      );
    }

    const variables: KeyValue[] = (env.variables || []).map((v) => ({
      id: uuidv4(),
      key: v.key || '',
      value: v.initialValue ?? v.value ?? '',
      initialValue: v.initialValue ?? v.value ?? '',
      currentValue: v.currentValue ?? '',
      enabled: true,
      isSecret: v.secret || false,
    }));

    return {
      id: uuidv4(),
      name: env.name || 'Imported Environment',
      variables,
    };
  });
};
