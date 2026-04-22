/**
 * Tests for src/types/index.ts — TypeScript type definitions.
 *
 * Since types/index.ts contains only TypeScript interfaces and type aliases
 * with no runtime logic, these tests verify the runtime shape of objects
 * that conform to the exported types, ensuring the module imports correctly
 * and documented type shapes are used consistently.
 *
 * Covers:
 *  - KeyValue shape
 *  - RequestAuth shape and all type variants
 *  - RequestBody shape and all type variants
 *  - ApiRequest default shape
 *  - HttpMethod values
 *  - AppMode values
 */

import { describe, expect, it } from 'vitest';
import type {
  KeyValue,
  RequestAuth,
  RequestBody,
  ApiRequest,
  HttpMethod,
  AppMode,
} from '../src/types';

// ─── HttpMethod ───────────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

describe('HttpMethod', () => {
  it('includes all 7 standard HTTP methods', () => {
    expect(HTTP_METHODS).toHaveLength(7);
  });

  it('includes GET, POST, PUT, PATCH, DELETE', () => {
    expect(HTTP_METHODS).toContain('GET');
    expect(HTTP_METHODS).toContain('POST');
    expect(HTTP_METHODS).toContain('PUT');
    expect(HTTP_METHODS).toContain('PATCH');
    expect(HTTP_METHODS).toContain('DELETE');
  });

  it('includes HEAD and OPTIONS', () => {
    expect(HTTP_METHODS).toContain('HEAD');
    expect(HTTP_METHODS).toContain('OPTIONS');
  });
});

// ─── AppMode ──────────────────────────────────────────────────────────────────

const APP_MODES: AppMode[] = ['rest', 'graphql', 'grpc', 'websocket', 'mqtt', 'socketio', 'sse'];

describe('AppMode', () => {
  it('includes all 7 application modes', () => {
    expect(APP_MODES).toHaveLength(7);
  });

  it('includes rest and graphql', () => {
    expect(APP_MODES).toContain('rest');
    expect(APP_MODES).toContain('graphql');
  });
});

// ─── KeyValue ─────────────────────────────────────────────────────────────────

describe('KeyValue shape', () => {
  it('can represent a basic key-value pair', () => {
    const kv: KeyValue = { id: 'kv-1', key: 'Authorization', value: 'Bearer token', enabled: true };
    expect(kv.id).toBe('kv-1');
    expect(kv.key).toBe('Authorization');
    expect(kv.value).toBe('Bearer token');
    expect(kv.enabled).toBe(true);
  });

  it('supports optional currentValue, initialValue, isSecret', () => {
    const kv: KeyValue = {
      id: 'kv-2',
      key: 'secret',
      value: '',
      currentValue: 'runtime-value',
      initialValue: 'preset-value',
      enabled: true,
      isSecret: true,
    };
    expect(kv.isSecret).toBe(true);
    expect(kv.currentValue).toBe('runtime-value');
    expect(kv.initialValue).toBe('preset-value');
  });

  it('supports optional description', () => {
    const kv: KeyValue = { id: 'kv-3', key: 'x', value: 'y', enabled: true, description: 'A header' };
    expect(kv.description).toBe('A header');
  });
});

// ─── RequestAuth ─────────────────────────────────────────────────────────────

describe('RequestAuth shape', () => {
  it('supports "none" auth type', () => {
    const auth: RequestAuth = { type: 'none' };
    expect(auth.type).toBe('none');
  });

  it('supports "inherit" auth type', () => {
    const auth: RequestAuth = { type: 'inherit' };
    expect(auth.type).toBe('inherit');
  });

  it('supports "basic" auth with username and password', () => {
    const auth: RequestAuth = { type: 'basic', basic: { username: 'admin', password: 'pass' } };
    expect(auth.basic?.username).toBe('admin');
    expect(auth.basic?.password).toBe('pass');
  });

  it('supports "bearer" auth with token', () => {
    const auth: RequestAuth = { type: 'bearer', bearer: { token: 'mytoken' } };
    expect(auth.bearer?.token).toBe('mytoken');
  });

  it('supports "api-key" auth with key, value, addTo variants', () => {
    const authHeader: RequestAuth = {
      type: 'api-key',
      apiKey: { key: 'X-API-Key', value: 'secret', addTo: 'header' },
    };
    expect(authHeader.apiKey?.addTo).toBe('header');

    const authQuery: RequestAuth = {
      type: 'api-key',
      apiKey: { key: 'api_key', value: 'secret', addTo: 'query' },
    };
    expect(authQuery.apiKey?.addTo).toBe('query');
  });
});

// ─── RequestBody ─────────────────────────────────────────────────────────────

describe('RequestBody shape', () => {
  it('supports "none" body type', () => {
    const body: RequestBody = { type: 'none' };
    expect(body.type).toBe('none');
  });

  it('supports "json" body with raw content', () => {
    const body: RequestBody = { type: 'json', raw: '{"key":"val"}' };
    expect(body.raw).toBe('{"key":"val"}');
  });

  it('supports "form-data" body with formData array', () => {
    const body: RequestBody = {
      type: 'form-data',
      formData: [{ id: '1', key: 'name', value: 'Alice', enabled: true }],
    };
    expect(body.formData).toHaveLength(1);
    expect(body.formData?.[0].key).toBe('name');
  });

  it('supports "x-www-form-urlencoded" body with urlencoded array', () => {
    const body: RequestBody = {
      type: 'x-www-form-urlencoded',
      urlencoded: [{ id: '2', key: 'q', value: 'search', enabled: true }],
    };
    expect(body.urlencoded?.[0].value).toBe('search');
  });

  it('supports "raw" body type', () => {
    const body: RequestBody = { type: 'raw', raw: 'plain text' };
    expect(body.type).toBe('raw');
    expect(body.raw).toBe('plain text');
  });

  it('supports "binary" body type', () => {
    const body: RequestBody = { type: 'binary' };
    expect(body.type).toBe('binary');
  });
});

// ─── ApiRequest ───────────────────────────────────────────────────────────────

describe('ApiRequest shape', () => {
  it('can represent a minimal GET request', () => {
    const req: ApiRequest = {
      id: 'req-1',
      name: 'Get Users',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [],
      params: [],
      body: { type: 'none' },
      auth: { type: 'none' },
    };
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.example.com/users');
    expect(req.headers).toHaveLength(0);
  });

  it('supports optional preScript, script, sslVerification', () => {
    const req: ApiRequest = {
      id: 'req-2',
      name: 'Scripted',
      method: 'POST',
      url: 'https://api.dev',
      headers: [],
      params: [],
      body: { type: 'json' },
      auth: { type: 'none' },
      preScript: 'console.log("pre")',
      script: 'console.log("post")',
      sslVerification: false,
    };
    expect(req.sslVerification).toBe(false);
    expect(req.preScript).toBe('console.log("pre")');
  });
});
