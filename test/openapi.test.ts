/**
 * Tests for src/utils/openapi.ts
 *
 * Covers:
 *  - importOpenAPISpec: JSON and YAML parsing
 *  - Empty content / missing fields validation
 *  - Path parameter conversion (<<param>>)
 *  - Tag-based folder grouping
 *  - Request body content type handling
 *  - Header and query parameter extraction
 *  - Base URL extraction from servers
 */

import { describe, expect, it } from 'vitest';
import { importOpenAPISpec } from '../src/utils/openapi';

// ─── Minimal valid spec factory ───────────────────────────────────────────────

function minimalSpec(overrides?: object) {
  return JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          summary: 'List users',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    ...overrides,
  });
}

// ─── Validation errors ────────────────────────────────────────────────────────

describe('importOpenAPISpec – validation', () => {
  it('throws for empty content', () => {
    expect(() => importOpenAPISpec('')).toThrow('Empty content');
  });

  it('throws for whitespace-only content', () => {
    expect(() => importOpenAPISpec('   ')).toThrow('Empty content');
  });

  it('throws for invalid JSON/YAML', () => {
    expect(() => importOpenAPISpec('{{{')).toThrow();
  });

  it('throws when info field is missing', () => {
    const spec = JSON.stringify({ openapi: '3.0.0', paths: { '/x': {} } });
    expect(() => importOpenAPISpec(spec)).toThrow('info');
  });

  it('throws when paths field is missing', () => {
    const spec = JSON.stringify({ openapi: '3.0.0', info: { title: 'T', version: '1' } });
    expect(() => importOpenAPISpec(spec)).toThrow('paths');
  });

  it('throws when paths is an empty object', () => {
    const spec = JSON.stringify({ openapi: '3.0.0', info: { title: 'T', version: '1' }, paths: {} });
    expect(() => importOpenAPISpec(spec)).toThrow('empty');
  });
});

// ─── Basic parsing ────────────────────────────────────────────────────────────

describe('importOpenAPISpec – basic parsing', () => {
  it('returns a Collection with the spec title as name', () => {
    const result = importOpenAPISpec(minimalSpec());
    expect(result.name).toBe('Test API');
  });

  it('assigns a unique id to the collection', () => {
    const result = importOpenAPISpec(minimalSpec());
    expect(result.id).toBeTruthy();
  });

  it('parses a GET operation into a request', () => {
    const result = importOpenAPISpec(minimalSpec());
    expect(result.requests.length + result.folders.flatMap(f => f.requests).length).toBeGreaterThanOrEqual(1);
  });

  it('sets the request method to GET', () => {
    const result = importOpenAPISpec(minimalSpec());
    const req = result.requests[0] ?? result.folders[0].requests[0];
    expect(req.method).toBe('GET');
  });

  it('sets the request URL including path', () => {
    const result = importOpenAPISpec(minimalSpec());
    const req = result.requests[0] ?? result.folders[0].requests[0];
    expect(req.url).toContain('/users');
  });
});

// ─── YAML parsing ─────────────────────────────────────────────────────────────

describe('importOpenAPISpec – YAML', () => {
  it('parses a YAML spec successfully', () => {
    const yaml = `
openapi: "3.0.0"
info:
  title: YAML API
  version: "1.0.0"
paths:
  /items:
    get:
      summary: List items
      responses:
        "200":
          description: OK
`;
    const result = importOpenAPISpec(yaml);
    expect(result.name).toBe('YAML API');
  });
});

// ─── Base URL ─────────────────────────────────────────────────────────────────

describe('importOpenAPISpec – servers', () => {
  it('prepends the first server URL to request URLs', () => {
    const spec = minimalSpec({ servers: [{ url: 'https://api.example.com/v1' }] });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    expect(req.url).toContain('https://api.example.com/v1');
  });

  it('works without a servers field (empty base URL)', () => {
    const result = importOpenAPISpec(minimalSpec());
    expect(result).toBeTruthy();
  });
});

// ─── Path parameters ─────────────────────────────────────────────────────────

describe('importOpenAPISpec – path parameters', () => {
  it('converts {param} to <<param>> in the request URL', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Params API', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            summary: 'Get user',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    expect(req.url).toContain('<<id>>');
    expect(req.url).not.toContain('{id}');
  });
});

// ─── Parameters (header / query) ─────────────────────────────────────────────

describe('importOpenAPISpec – operation parameters', () => {
  it('maps query parameters to request.params', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Params', version: '1' },
      paths: {
        '/search': {
          get: {
            summary: 'Search',
            parameters: [
              { name: 'q', in: 'query', required: true },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    const qParam = req.params.find(p => p.key === 'q');
    expect(qParam).toBeTruthy();
    expect(qParam!.enabled).toBe(true); // required
  });

  it('maps header parameters to request.headers', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Headers', version: '1' },
      paths: {
        '/data': {
          get: {
            summary: 'Get data',
            parameters: [
              { name: 'X-Custom-Header', in: 'header', required: false },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    const header = req.headers.find(h => h.key === 'X-Custom-Header');
    expect(header).toBeTruthy();
  });
});

// ─── Request body ─────────────────────────────────────────────────────────────

describe('importOpenAPISpec – request body', () => {
  it('sets body type to json for application/json content', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Body API', version: '1' },
      paths: {
        '/data': {
          post: {
            summary: 'Create data',
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    expect(req.body.type).toBe('json');
  });

  it('adds Content-Type header for json body', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'CT API', version: '1' },
      paths: {
        '/items': {
          post: {
            summary: 'Create',
            requestBody: {
              content: { 'application/json': {} },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const req = result.requests[0] ?? result.folders[0].requests[0];
    const ct = req.headers.find(h => h.key === 'Content-Type');
    expect(ct).toBeTruthy();
    expect(ct!.value).toBe('application/json');
  });
});

// ─── Tags / folder grouping ───────────────────────────────────────────────────

describe('importOpenAPISpec – tag grouping', () => {
  it('groups operations with tags into folders', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Tagged API', version: '1' },
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            tags: ['Users'],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/products': {
          get: {
            summary: 'List products',
            tags: ['Products'],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    const folderNames = result.folders.map(f => f.name);
    expect(folderNames).toContain('Users');
    expect(folderNames).toContain('Products');
  });

  it('places untagged operations in top-level requests', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Mixed API', version: '1' },
      paths: {
        '/ping': {
          get: {
            summary: 'Ping',
            responses: { '200': { description: 'OK' } },
            // no tags
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    expect(result.requests.length).toBeGreaterThan(0);
  });

  it('uses the first tag when multiple tags are present', () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Multi-tag API', version: '1' },
      paths: {
        '/things': {
          get: {
            summary: 'Things',
            tags: ['Primary', 'Secondary'],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    const result = importOpenAPISpec(spec);
    expect(result.folders.some(f => f.name === 'Primary')).toBe(true);
  });
});
