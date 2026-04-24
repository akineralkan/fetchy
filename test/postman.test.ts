/**
 * Tests for Postman collection and environment import parsers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importPostmanCollection, importPostmanEnvironment, exportToPostman } from '../src/utils/postman';

const fixturesDir = join(__dirname, 'data');

// --------------------------------------------------------------------------
// Postman Collection Import
// --------------------------------------------------------------------------

describe('importPostmanCollection', () => {
  it('should import a valid Postman collection from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content);

    expect(collection).not.toBeNull();
    expect(collection!.name).toBe('Test Postman Collection');
    expect(collection!.description).toBe('A test collection exported from Postman');
  });

  it('should parse top-level requests', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    // Top-level has "Get Users" request
    expect(collection.requests.length).toBe(1);
    expect(collection.requests[0].name).toBe('Get Users');
    expect(collection.requests[0].method).toBe('GET');
    expect(collection.requests[0].url).toBe('https://api.example.com/users?page=1');
  });

  it('should parse folders and nested requests', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    expect(collection.folders.length).toBe(1);
    expect(collection.folders[0].name).toBe('Auth Folder');
    expect(collection.folders[0].requests.length).toBe(1);
    expect(collection.folders[0].requests[0].name).toBe('Login');
    expect(collection.folders[0].requests[0].method).toBe('POST');
  });

  it('should parse request headers', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const getUsers = collection.requests[0];
    expect(getUsers.headers.length).toBe(1);
    expect(getUsers.headers[0].key).toBe('Accept');
    expect(getUsers.headers[0].value).toBe('application/json');
  });

  it('should parse query parameters', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const getUsers = collection.requests[0];
    expect(getUsers.params.length).toBe(1);
    expect(getUsers.params[0].key).toBe('page');
    expect(getUsers.params[0].value).toBe('1');
  });

  it('should parse basic auth', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const login = collection.folders[0].requests[0];
    expect(login.auth.type).toBe('basic');
    if (login.auth.type === 'basic') {
      expect(login.auth.basic?.username).toBe('admin');
      expect(login.auth.basic?.password).toBe('secret');
    }
  });

  it('should parse request body', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const login = collection.folders[0].requests[0];
    // Postman fixture uses mode: "raw" so it maps to body type 'json' via raw content detection
    expect(['json', 'raw']).toContain(login.body.type);
  });

  it('should parse collection variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    expect(collection.variables).toBeDefined();
    expect(collection.variables!.length).toBe(2);
    expect(collection.variables![0].key).toBe('baseUrl');
    expect(collection.variables![0].value).toBe('https://api.example.com');
  });

  it('should handle empty content', () => {
    expect(() => importPostmanCollection('')).toThrow();
  });

  it('should handle invalid JSON', () => {
    expect(() => importPostmanCollection('not json')).toThrow();
  });

  it('should handle JSON with missing info field', () => {
    const content = JSON.stringify({ item: [] });
    // Postman importer requires the "info" field; it throws without it
    expect(() => importPostmanCollection(content)).toThrow();
  });

  it('should generate unique IDs for all items', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;

    const ids = new Set<string>();
    ids.add(collection.id);
    for (const req of collection.requests) ids.add(req.id);
    for (const folder of collection.folders) {
      ids.add(folder.id);
      for (const req of folder.requests) ids.add(req.id);
    }

    // All IDs should be unique
    const totalItems = 1 + collection.requests.length +
      collection.folders.length +
      collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
    expect(ids.size).toBe(totalItems);
  });
});

// --------------------------------------------------------------------------
// Postman Environment Import
// --------------------------------------------------------------------------

describe('importPostmanEnvironment', () => {
  it('should import a valid Postman environment from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const envs = importPostmanEnvironment(content);

    expect(envs.length).toBe(1);
    expect(envs[0].name).toBe('Test Postman Environment');
  });

  it('should parse all variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    expect(env.variables.length).toBe(4);
  });

  it('should map variable keys and values', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const baseUrl = env.variables.find(v => v.key === 'baseUrl');
    expect(baseUrl).toBeDefined();
    expect(baseUrl!.value).toBe('https://api.example.com');
    expect(baseUrl!.enabled).toBe(true);
  });

  it('should mark secret variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const apiKey = env.variables.find(v => v.key === 'apiKey');
    expect(apiKey).toBeDefined();
    expect(apiKey!.isSecret).toBe(true);
  });

  it('should respect disabled state', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const env = importPostmanEnvironment(content)[0];

    const debugMode = env.variables.find(v => v.key === 'debugMode');
    expect(debugMode).toBeDefined();
    expect(debugMode!.enabled).toBe(false);
  });

  it('should handle array of environments', () => {
    const envs = [
      { name: 'Env1', values: [{ key: 'a', value: '1', enabled: true }] },
      { name: 'Env2', values: [{ key: 'b', value: '2', enabled: true }] },
    ];
    const result = importPostmanEnvironment(JSON.stringify(envs));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Env1');
    expect(result[1].name).toBe('Env2');
  });

  it('should handle empty content', () => {
    expect(() => importPostmanEnvironment('')).toThrow();
  });

  it('should handle invalid JSON', () => {
    expect(() => importPostmanEnvironment('not json')).toThrow();
  });

  it('should handle environment with no values', () => {
    const content = JSON.stringify({ name: 'Empty', values: [] });
    const result = importPostmanEnvironment(content);
    expect(result.length).toBe(1);
    expect(result[0].variables.length).toBe(0);
  });

  it('should generate unique IDs for environment and variables', () => {
    const content = readFileSync(join(fixturesDir, 'postman-environment.json'), 'utf-8');
    const envs = importPostmanEnvironment(content);

    const ids = new Set<string>();
    for (const env of envs) {
      ids.add(env.id);
      for (const v of env.variables) ids.add(v.id);
    }
    // Should have unique IDs for env + 4 variables = 5
    expect(ids.size).toBe(5);
  });
});

// --------------------------------------------------------------------------
// Postman Collection Import – additional auth and body types
// --------------------------------------------------------------------------

describe('importPostmanCollection – bearer and apikey auth', () => {
  it('should parse bearer token auth', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Bearer Test', schema: '' },
        item: [
          {
            name: 'Secured Request',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com/secure', query: [] },
              auth: {
                type: 'bearer',
                bearer: [{ key: 'token', value: 'my-token' }],
              },
            },
          },
        ],
      })
    );
    expect(collection).not.toBeNull();
    const req = collection!.requests[0];
    expect(req.auth.type).toBe('bearer');
    if (req.auth.type === 'bearer') {
      expect(req.auth.bearer?.token).toBe('my-token');
    }
  });

  it('should parse apikey auth', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'ApiKey Test', schema: '' },
        item: [
          {
            name: 'Api Key Request',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com', query: [] },
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'X-API-Key' },
                  { key: 'value', value: 'secret-key' },
                  { key: 'in', value: 'header' },
                ],
              },
            },
          },
        ],
      })
    );
    expect(collection).not.toBeNull();
    const req = collection!.requests[0];
    expect(req.auth.type).toBe('api-key');
    if (req.auth.type === 'api-key') {
      expect(req.auth.apiKey?.key).toBe('X-API-Key');
      expect(req.auth.apiKey?.value).toBe('secret-key');
    }
  });

  it('should set addTo=query for apikey in query', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'ApiKey Query Test', schema: '' },
        item: [
          {
            name: 'Query Key Request',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com', query: [] },
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'api_key' },
                  { key: 'value', value: 'the-value' },
                  { key: 'in', value: 'query' },
                ],
              },
            },
          },
        ],
      })
    );
    const req = collection!.requests[0];
    if (req.auth.type === 'api-key') {
      expect(req.auth.apiKey?.addTo).toBe('query');
    }
  });

  it('should return none auth for unknown auth type', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Unknown Auth', schema: '' },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: { raw: 'https://example.com', query: [] },
              auth: { type: 'oauth2' },
            },
          },
        ],
      })
    );
    expect(collection!.requests[0].auth.type).toBe('none');
  });
});

describe('importPostmanCollection – body types', () => {
  it('should parse urlencoded body', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Urlencoded Test', schema: '' },
        item: [
          {
            name: 'Form Request',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com', query: [] },
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'username', value: 'alice', disabled: false },
                  { key: 'password', value: 'secret', disabled: false },
                ],
              },
            },
          },
        ],
      })
    );
    const req = collection!.requests[0];
    expect(req.body.type).toBe('x-www-form-urlencoded');
    expect(req.body.urlencoded).toHaveLength(2);
    expect(req.body.urlencoded![0].key).toBe('username');
  });

  it('should parse formdata body', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'FormData Test', schema: '' },
        item: [
          {
            name: 'Multipart Request',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com', query: [] },
              body: {
                mode: 'formdata',
                formdata: [{ key: 'file_name', value: 'data.txt', disabled: false }],
              },
            },
          },
        ],
      })
    );
    const req = collection!.requests[0];
    expect(req.body.type).toBe('form-data');
    expect(req.body.formData).toHaveLength(1);
    expect(req.body.formData![0].key).toBe('file_name');
  });

  it('should detect json body from options.raw.language', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'JSON Body Test', schema: '' },
        item: [
          {
            name: 'JSON Request',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com', query: [] },
              body: {
                mode: 'raw',
                raw: '{"key":"value"}',
                options: { raw: { language: 'json' } },
              },
            },
          },
        ],
      })
    );
    const req = collection!.requests[0];
    expect(req.body.type).toBe('json');
  });
});

describe('importPostmanCollection – event scripts', () => {
  it('should parse pre-request script from events', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Script Test', schema: '' },
        item: [
          {
            name: 'Scripted Request',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com', query: [] },
            },
            event: [
              {
                listen: 'prerequest',
                script: { exec: ['pm.variables.set("key", "value");'] },
              },
            ],
          },
        ],
      })
    );
    const req = collection!.requests[0];
    expect(req.preScript).toBeTruthy();
  });

  it('should parse test script from events', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Test Script Test', schema: '' },
        item: [
          {
            name: 'Tested Request',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com', query: [] },
            },
            event: [
              {
                listen: 'test',
                script: { exec: ['pm.test("Status", () => pm.response.to.have.status(200));'] },
              },
            ],
          },
        ],
      })
    );
    const req = collection!.requests[0];
    expect(req.script).toBeTruthy();
  });
});

describe('importPostmanCollection – string URL format', () => {
  it('should handle a plain string URL', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'String URL Test', schema: '' },
        item: [
          {
            name: 'Simple Request',
            request: {
              method: 'GET',
              url: 'https://api.example.com/simple',
            },
          },
        ],
      })
    );
    expect(collection).not.toBeNull();
    expect(collection!.requests[0].url).toBe('https://api.example.com/simple');
    expect(collection!.requests[0].params).toHaveLength(0);
  });
});

describe('importPostmanCollection – error cases', () => {
  it('should throw when item field is missing', () => {
    const content = JSON.stringify({ info: { name: 'No Items' } });
    expect(() => importPostmanCollection(content)).toThrow();
  });

  it('should throw when parsed content is not an object', () => {
    expect(() => importPostmanCollection('"just a string"')).toThrow();
  });

  it('should skip items without a request', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Mixed Items', schema: '' },
        item: [
          { name: 'No Request Item' },
          {
            name: 'Valid Request',
            request: { method: 'GET', url: { raw: 'https://example.com', query: [] } },
          },
        ],
      })
    );
    expect(collection!.requests).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// Postman Environment Import – additional error cases
// --------------------------------------------------------------------------

describe('importPostmanEnvironment – additional error cases', () => {
  it('should throw when given an empty array', () => {
    expect(() => importPostmanEnvironment(JSON.stringify([]))).toThrow('No environments found');
  });

  it('should throw when environment item has neither name nor values', () => {
    expect(() =>
      importPostmanEnvironment(JSON.stringify([{ someOtherField: true }]))
    ).toThrow();
  });
});

// --------------------------------------------------------------------------
// exportToPostman
// --------------------------------------------------------------------------

describe('exportToPostman', () => {
  it('produces valid JSON that can be re-parsed', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Round Trip', schema: '' },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com/users', query: [] },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    expect(() => JSON.parse(exported)).not.toThrow();
  });

  it('preserves collection name in exported JSON', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    expect(parsed.info.name).toBe('Test Postman Collection');
  });

  it('preserves top-level requests in exported JSON', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    // Items includes both folders and requests
    expect(parsed.item).toBeDefined();
    expect(parsed.item.length).toBeGreaterThan(0);
  });

  it('includes collection variables in exported JSON', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    expect(parsed.variable).toBeDefined();
    expect(parsed.variable.length).toBe(2);
    expect(parsed.variable[0].key).toBe('baseUrl');
  });

  it('exports requests with correct method and url', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Method Test', schema: '' },
        item: [
          {
            name: 'Delete Request',
            request: {
              method: 'DELETE',
              url: { raw: 'https://api.example.com/resource/1', query: [] },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    expect(parsed.item[0].request.method).toBe('DELETE');
    expect(parsed.item[0].request.url.raw).toBe('https://api.example.com/resource/1');
  });

  it('exports nested folders correctly', () => {
    const content = readFileSync(join(fixturesDir, 'postman-collection.json'), 'utf-8');
    const collection = importPostmanCollection(content)!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    // The fixture has an "Auth Folder" at top level
    const folder = parsed.item.find((i: { name: string }) => i.name === 'Auth Folder');
    expect(folder).toBeDefined();
    expect(folder.item).toHaveLength(1);
  });

  it('exports JSON body with correct mode and language options', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Body Export Test', schema: '' },
        item: [
          {
            name: 'Create User',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/users', query: [] },
              body: {
                mode: 'raw',
                raw: '{"name":"Alice"}',
                options: { raw: { language: 'json' } },
              },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    const body = parsed.item[0].request.body;
    expect(body.mode).toBe('raw');
    expect(body.raw).toContain('Alice');
    expect(body.options?.raw?.language).toBe('json');
  });

  it('exports urlencoded body correctly', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Urlencoded Export', schema: '' },
        item: [
          {
            name: 'Login',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/login', query: [] },
              body: {
                mode: 'urlencoded',
                urlencoded: [{ key: 'username', value: 'alice', disabled: false }],
              },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    const body = parsed.item[0].request.body;
    expect(body.mode).toBe('urlencoded');
    expect(body.urlencoded[0].key).toBe('username');
  });

  it('exports formdata body correctly', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'FormData Export', schema: '' },
        item: [
          {
            name: 'Upload',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/upload', query: [] },
              body: {
                mode: 'formdata',
                formdata: [{ key: 'file', value: 'content', disabled: false }],
              },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    const body = parsed.item[0].request.body;
    expect(body.mode).toBe('formdata');
    expect(body.formdata[0].key).toBe('file');
  });

  it('exports request query params', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Params Export', schema: '' },
        item: [
          {
            name: 'Search',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/search',
                query: [{ key: 'q', value: 'hello', disabled: false }],
              },
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    const query = parsed.item[0].request.url.query;
    expect(query).toHaveLength(1);
    expect(query[0].key).toBe('q');
  });

  it('exports request headers', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Headers Export', schema: '' },
        item: [
          {
            name: 'With Header',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com', query: [] },
              header: [{ key: 'Accept', value: 'application/json', disabled: false }],
            },
          },
        ],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    const header = parsed.item[0].request.header;
    expect(header).toHaveLength(1);
    expect(header[0].key).toBe('Accept');
  });

  it('includes Postman schema URL in info', () => {
    const collection = importPostmanCollection(
      JSON.stringify({
        info: { name: 'Schema Test', schema: '' },
        item: [],
      })
    )!;
    const exported = exportToPostman(collection);
    const parsed = JSON.parse(exported);
    expect(parsed.info.schema).toContain('schema.getpostman.com');
  });
});
