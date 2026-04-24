/**
 * Tests for src/utils/httpClient.ts
 *
 * Covers:
 *  - buildWorkerSource: generates valid worker source code
 *  - executeRequest: various auth types, body types, query params, headers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkerSource } from '../src/utils/httpClient';

// ─── buildWorkerSource ──────────────────────────────────────────────────────

describe('buildWorkerSource', () => {
  it('returns a string containing the user script', () => {
    const script = 'console.log("hello world");';
    const source = buildWorkerSource(script);
    expect(source).toContain(script);
  });

  it('wraps the script in a self.onmessage handler', () => {
    const source = buildWorkerSource('var x = 1;');
    expect(source).toContain('self.onmessage');
  });

  it('includes fetchy.environment API', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('fetchy');
    expect(source).toContain('environment');
    expect(source).toContain('get:');
    expect(source).toContain('set:');
    expect(source).toContain('all:');
  });

  it('includes pm compatibility shim', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('var pm');
    expect(source).toContain('environment: fetchy.environment');
    expect(source).toContain('test: function');
    expect(source).toContain('expect: function');
  });

  it('includes console.log interception', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('_console');
    expect(source).toContain('logs.push');
  });

  it('includes error handling with try/catch', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('try');
    expect(source).toContain('catch');
    expect(source).toContain("type: 'error'");
    expect(source).toContain("type: 'done'");
  });

  it('posts envUpdates on completion', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('envUpdates');
    expect(source).toContain('self.postMessage');
  });

  it('includes response data access for post scripts', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('fetchy.response');
    expect(source).toContain("scriptType === 'post'");
  });

  it('uses strict mode', () => {
    const source = buildWorkerSource('');
    expect(source).toMatch(/^'use strict'/);
  });

  it('pm.response provides json and text methods', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('json: function');
    expect(source).toContain('text: function');
  });

  it('pm.response.headers provides get method', () => {
    const source = buildWorkerSource('');
    expect(source).toContain('headers:');
    expect(source).toContain('get: function');
  });
});

// ─── executeRequest ─────────────────────────────────────────────────────────
// The main executeRequest function requires heavy mocking of the store and
// electron API. We test it via mock of the store and window.electronAPI.

describe('executeRequest', () => {
  let executeRequest: any;
  let mockGetState: any;
  let mockUpdateTab: any;
  let mockUpdateEnvironment: any;
  let mockGetActiveEnvironment: any;

  beforeEach(async () => {
    // Clear module cache to get fresh mocks
    vi.resetModules();

    mockUpdateTab = vi.fn();
    mockUpdateEnvironment = vi.fn();
    mockGetActiveEnvironment = vi.fn().mockReturnValue(null);
    mockGetState = vi.fn().mockReturnValue({
      updateTab: mockUpdateTab,
      activeTabId: 'tab-1',
      getActiveEnvironment: mockGetActiveEnvironment,
      updateEnvironment: mockUpdateEnvironment,
    });

    // Mock useAppStore
    vi.doMock('../src/store/appStore', () => ({
      useAppStore: { getState: mockGetState },
    }));

    // Mock replaceVariables to be a passthrough
    vi.doMock('../src/utils/helpers', () => ({
      replaceVariables: vi.fn((val: string) => val),
    }));

    const mod = await import('../src/utils/httpClient');
    executeRequest = mod.executeRequest;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  const baseRequest = {
    id: 'req-1',
    name: 'Test',
    method: 'GET' as const,
    url: 'https://api.example.com/data',
    headers: [],
    params: [],
    body: { type: 'none' as const },
    auth: { type: 'none' as const },
    preScript: '',
    script: '',
  };

  it('returns an error response when fetch fails in browser mode', async () => {
    // No electronAPI, mock fetch to reject
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await executeRequest({ request: baseRequest });
    expect(result.status).toBe(0);
    expect(result.statusText).toBe('Error');
    expect(result.body).toContain('Network error');

    globalThis.fetch = originalFetch;
  });

  it('calls fetch with correct proxy URL in browser mode', async () => {
    const mockApiResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      time: 50,
      size: 2,
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockApiResponse),
    });

    const result = await executeRequest({ request: baseRequest });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/proxy',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.status).toBe(200);

    globalThis.fetch = originalFetch;
  });

  it('builds query parameters from enabled params', async () => {
    const req = {
      ...baseRequest,
      params: [
        { id: '1', key: 'page', value: '1', enabled: true },
        { id: '2', key: 'limit', value: '10', enabled: true },
        { id: '3', key: 'disabled', value: 'skip', enabled: false },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).toContain('page=1');
    expect(callBody.url).toContain('limit=10');
    expect(callBody.url).not.toContain('disabled');

    globalThis.fetch = originalFetch;
  });

  it('adds Bearer auth header', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'bearer' as const, bearer: { token: 'my-token' } },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['Authorization']).toBe('Bearer my-token');

    globalThis.fetch = originalFetch;
  });

  it('adds Basic auth header', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'basic' as const, basic: { username: 'user', password: 'pass' } },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['Authorization']).toContain('Basic');

    globalThis.fetch = originalFetch;
  });

  it('adds API key to header when addTo is header', async () => {
    const req = {
      ...baseRequest,
      auth: {
        type: 'api-key' as const,
        apiKey: { key: 'X-API-Key', value: 'secret', addTo: 'header' as const },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['X-API-Key']).toBe('secret');

    globalThis.fetch = originalFetch;
  });

  it('adds API key to query when addTo is query', async () => {
    const req = {
      ...baseRequest,
      auth: {
        type: 'api-key' as const,
        apiKey: { key: 'api_key', value: 'secret', addTo: 'query' as const },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).toContain('api_key=secret');

    globalThis.fetch = originalFetch;
  });

  it('sets Content-Type for JSON body', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      body: { type: 'json' as const, raw: '{"key": "value"}' },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['Content-Type']).toBe('application/json');
    expect(callBody.body).toBe('{"key": "value"}');

    globalThis.fetch = originalFetch;
  });

  it('sets Content-Type for urlencoded body', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      body: {
        type: 'x-www-form-urlencoded' as const,
        urlencoded: [
          { id: '1', key: 'a', value: '1', enabled: true },
          { id: '2', key: 'b', value: '2', enabled: true },
        ],
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(callBody.body).toContain('a=1');

    globalThis.fetch = originalFetch;
  });

  it('sends raw body without adding Content-Type', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      body: { type: 'raw' as const, raw: 'plain text body' },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.body).toBe('plain text body');

    globalThis.fetch = originalFetch;
  });

  it('strips inline query params from URL', async () => {
    const req = {
      ...baseRequest,
      url: 'https://api.example.com/data?inline=yes',
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).not.toContain('inline=yes');

    globalThis.fetch = originalFetch;
  });

  it('uses inherited auth when request auth is inherit', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'inherit' as const },
    };
    const inheritedAuth = { type: 'bearer' as const, bearer: { token: 'inherited-token' } };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req, inheritedAuth });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['Authorization']).toBe('Bearer inherited-token');

    globalThis.fetch = originalFetch;
  });

  it('includes enabled request headers', async () => {
    const req = {
      ...baseRequest,
      headers: [
        { id: '1', key: 'X-Custom', value: 'test', enabled: true },
        { id: '2', key: 'X-Disabled', value: 'skip', enabled: false },
        { id: '3', key: '', value: 'no-key', enabled: true },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers['X-Custom']).toBe('test');
    expect(callBody.headers).not.toHaveProperty('X-Disabled');

    globalThis.fetch = originalFetch;
  });

  it('does not set body for GET requests', async () => {
    const req = {
      ...baseRequest,
      method: 'GET' as const,
      body: { type: 'json' as const, raw: '{"should": "not send"}' },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.body).toBeUndefined();

    globalThis.fetch = originalFetch;
  });

  it('does not set body for HEAD requests', async () => {
    const req = {
      ...baseRequest,
      method: 'HEAD' as const,
      body: { type: 'json' as const, raw: '{"ignore":"this"}' },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.body).toBeUndefined();

    globalThis.fetch = originalFetch;
  });

  it('returns aborted response when signal is already aborted', async () => {
    // Simulate Electron mode
    (globalThis as any).window = {
      electronAPI: {
        httpRequest: vi.fn(),
        abortHttpRequest: vi.fn(),
      },
    };

    const controller = new AbortController();
    controller.abort();

    const result = await executeRequest({ request: baseRequest, signal: controller.signal });
    expect(result.statusText).toBe('Aborted');
    expect(result.status).toBe(0);
  });

  it('calls electronAPI.httpRequest in Electron mode', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      time: 100,
      size: 11,
    };

    (globalThis as any).window = {
      electronAPI: {
        httpRequest: vi.fn().mockResolvedValue(mockResponse),
        abortHttpRequest: vi.fn(),
      },
    };

    const result = await executeRequest({ request: baseRequest });
    expect(result.status).toBe(200);
    expect((globalThis as any).window.electronAPI.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/data',
        method: 'GET',
      }),
    );
  });

  it('sends form-data body as serialized entries in Electron mode', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      body: {
        type: 'form-data' as const,
        formData: [
          { id: '1', key: 'name', value: 'John', enabled: true },
          { id: '2', key: 'age', value: '30', enabled: true },
        ],
      },
    };

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      time: 10,
      size: 2,
    };

    (globalThis as any).window = {
      electronAPI: {
        httpRequest: vi.fn().mockResolvedValue(mockResponse),
        abortHttpRequest: vi.fn(),
      },
    };

    await executeRequest({ request: req });
    expect((globalThis as any).window.electronAPI.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: expect.arrayContaining([
          { key: 'name', value: 'John' },
          { key: 'age', value: '30' },
        ]),
      }),
    );
  });

  it('does not add API key header when key is empty', async () => {
    const req = {
      ...baseRequest,
      auth: {
        type: 'api-key' as const,
        apiKey: { key: '', value: 'secret', addTo: 'header' as const },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    // Should not have any API key header since key is empty
    expect(Object.keys(callBody.headers).length).toBe(0);

    globalThis.fetch = originalFetch;
  });

  it('does not add API key to query when value is empty', async () => {
    const req = {
      ...baseRequest,
      auth: {
        type: 'api-key' as const,
        apiKey: { key: 'api_key', value: '', addTo: 'query' as const },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).not.toContain('api_key');

    globalThis.fetch = originalFetch;
  });

  it('does not add Basic auth when username is empty', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'basic' as const, basic: { username: '', password: 'pass' } },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers).not.toHaveProperty('Authorization');

    globalThis.fetch = originalFetch;
  });

  it('does not add Bearer auth when token is empty', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'bearer' as const, bearer: { token: '' } },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.headers).not.toHaveProperty('Authorization');

    globalThis.fetch = originalFetch;
  });

  it('handles empty urlencoded items', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      body: {
        type: 'x-www-form-urlencoded' as const,
        urlencoded: [
          { id: '1', key: '', value: 'skip-me', enabled: true },
          { id: '2', key: 'valid', value: 'yes', enabled: true },
        ],
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.body).toContain('valid=yes');

    globalThis.fetch = originalFetch;
  });

  it('passes signal to fetch in browser mode', async () => {
    const controller = new AbortController();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: baseRequest, signal: controller.signal });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/proxy',
      expect.objectContaining({ signal: controller.signal }),
    );

    globalThis.fetch = originalFetch;
  });

  it('uses request auth when type is not inherit', async () => {
    const req = {
      ...baseRequest,
      auth: { type: 'bearer' as const, bearer: { token: 'my-own-token' } },
    };
    const inheritedAuth = { type: 'bearer' as const, bearer: { token: 'inherited-token' } };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req, inheritedAuth });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    // Should use request's own auth, not inherited
    expect(callBody.headers['Authorization']).toBe('Bearer my-own-token');

    globalThis.fetch = originalFetch;
  });

  it('concatenates query params with & separator', async () => {
    const req = {
      ...baseRequest,
      params: [
        { id: '1', key: 'a', value: '1', enabled: true },
        { id: '2', key: 'b', value: '2', enabled: true },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).toContain('a=1&b=2');

    globalThis.fetch = originalFetch;
  });

  it('preserves user-set Content-Type for JSON body', async () => {
    const req = {
      ...baseRequest,
      method: 'POST' as const,
      headers: [
        { id: '1', key: 'Content-Type', value: 'application/json; charset=utf-8', enabled: true },
      ],
      body: { type: 'json' as const, raw: '{}' },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    // Should keep the user's custom Content-Type
    expect(callBody.headers['Content-Type']).toBe('application/json; charset=utf-8');

    globalThis.fetch = originalFetch;
  });

  it('adds API key to query with proper separator when params already exist', async () => {
    const req = {
      ...baseRequest,
      params: [
        { id: '1', key: 'page', value: '1', enabled: true },
      ],
      auth: {
        type: 'api-key' as const,
        apiKey: { key: 'token', value: 'abc', addTo: 'query' as const },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0 }),
    });

    await executeRequest({ request: req });
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(callBody.url).toContain('page=1&token=abc');

    globalThis.fetch = originalFetch;
  });
});

// ─── capResponseBody ────────────────────────────────────────────────────────

describe('capResponseBody (via executeRequest)', () => {
  let executeRequest: any;
  let mockGetState: any;

  beforeEach(async () => {
    vi.resetModules();

    mockGetState = vi.fn().mockReturnValue({
      updateTab: vi.fn(),
      activeTabId: 'tab-1',
      getActiveEnvironment: vi.fn().mockReturnValue(null),
      updateEnvironment: vi.fn(),
    });

    vi.doMock('../src/store/appStore', () => ({
      useAppStore: { getState: mockGetState },
    }));

    vi.doMock('../src/utils/helpers', () => ({
      replaceVariables: vi.fn((val: string) => val),
    }));

    const mod = await import('../src/utils/httpClient');
    executeRequest = mod.executeRequest;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  it('truncates large response bodies from Electron', async () => {
    // Create a large response body > 5MB
    const largeBody = 'x'.repeat(6 * 1024 * 1024);
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: largeBody,
      time: 100,
      size: largeBody.length,
    };

    (globalThis as any).window = {
      electronAPI: {
        httpRequest: vi.fn().mockResolvedValue(mockResponse),
        abortHttpRequest: vi.fn(),
      },
    };

    const req = {
      id: 'req-1',
      name: 'Test',
      method: 'GET' as const,
      url: 'https://api.example.com/data',
      headers: [],
      params: [],
      body: { type: 'none' as const },
      auth: { type: 'none' as const },
      preScript: '',
      script: '',
    };

    const result = await executeRequest({ request: req });
    expect(result.bodyTruncated).toBe(true);
    expect(result.body.length).toBeLessThan(largeBody.length);
  });
});
