/**
 * Tests for Hoppscotch collection and environment import parsers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importHoppscotchCollection, importHoppscotchEnvironment } from '../src/utils/hoppscotch';

const fixturesDir = join(__dirname, 'data');

// --------------------------------------------------------------------------
// Hoppscotch Collection Import
// --------------------------------------------------------------------------

describe('importHoppscotchCollection', () => {
  it('should import a valid Hoppscotch collection array from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const collections = importHoppscotchCollection(content);

    expect(collections.length).toBe(1);
    expect(collections[0].name).toBe('Test API Collection');
    expect(collections[0].description).toBe('A test Hoppscotch collection');
  });

  it('should parse top-level requests', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const collections = importHoppscotchCollection(content);
    const coll = collections[0];

    expect(coll.requests.length).toBe(2);

    const healthCheck = coll.requests.find(r => r.name === 'Health Check');
    expect(healthCheck).toBeDefined();
    expect(healthCheck!.method).toBe('GET');
    expect(healthCheck!.url).toBe('https://api.example.com/health');

    const createUser = coll.requests.find(r => r.name === 'Create User');
    expect(createUser).toBeDefined();
    expect(createUser!.method).toBe('POST');
    expect(createUser!.url).toBe('https://api.example.com/users');
  });

  it('should parse folders and nested requests', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    expect(coll.folders.length).toBe(1);
    expect(coll.folders[0].name).toBe('Users');
    expect(coll.folders[0].requests.length).toBe(1);
    expect(coll.folders[0].requests[0].name).toBe('List Users');
  });

  it('should convert Hoppscotch params (active → enabled)', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const listUsers = coll.folders[0].requests[0];
    expect(listUsers.params.length).toBe(2);

    const page = listUsers.params.find(p => p.key === 'page');
    expect(page!.enabled).toBe(true);
    expect(page!.value).toBe('1');

    const limit = listUsers.params.find(p => p.key === 'limit');
    expect(limit!.enabled).toBe(false);
  });

  it('should convert Hoppscotch headers', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const listUsers = coll.folders[0].requests[0];
    expect(listUsers.headers.length).toBe(1);
    expect(listUsers.headers[0].key).toBe('Accept');
    expect(listUsers.headers[0].value).toBe('application/json');
    expect(listUsers.headers[0].enabled).toBe(true);
  });

  it('should convert bearer auth', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const listUsers = coll.folders[0].requests[0];
    expect(listUsers.auth.type).toBe('bearer');
    if (listUsers.auth.type === 'bearer') {
      expect(listUsers.auth.bearer?.token).toBe('my-token');
    }
  });

  it('should convert basic auth', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const createUser = coll.requests.find(r => r.name === 'Create User')!;
    expect(createUser.auth.type).toBe('basic');
    if (createUser.auth.type === 'basic') {
      expect(createUser.auth.basic?.username).toBe('admin');
      expect(createUser.auth.basic?.password).toBe('pass123');
    }
  });

  it('should convert JSON body', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const createUser = coll.requests.find(r => r.name === 'Create User')!;
    expect(createUser.body.type).toBe('json');
    if (createUser.body.type === 'json') {
      expect(createUser.body.raw).toContain('John');
    }
  });

  it('should convert no-body request correctly', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const healthCheck = coll.requests.find(r => r.name === 'Health Check')!;
    expect(healthCheck.body.type).toBe('none');
  });

  it('should preserve pre-request and test scripts', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    const listUsers = coll.folders[0].requests[0];
    expect(listUsers.preScript).toBe("console.log('pre');");
    expect(listUsers.script).toBe("console.log('test');");
  });

  it('should parse collection variables', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const coll = importHoppscotchCollection(content)[0];

    expect(coll.variables).toBeDefined();
    expect(coll.variables!.length).toBe(1);
    expect(coll.variables![0].key).toBe('baseUrl');
  });

  it('should handle a single collection object (not array)', () => {
    const single = {
      v: 2,
      name: 'Single Collection',
      folders: [],
      requests: [{ v: '1', name: 'Req', method: 'GET', endpoint: 'https://example.com' }],
    };
    const result = importHoppscotchCollection(JSON.stringify(single));
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Single Collection');
    expect(result[0].requests.length).toBe(1);
  });

  it('should handle empty content', () => {
    expect(() => importHoppscotchCollection('')).toThrow('Empty content');
  });

  it('should handle invalid JSON', () => {
    expect(() => importHoppscotchCollection('not json')).toThrow('Invalid JSON');
  });

  it('should handle empty array', () => {
    expect(() => importHoppscotchCollection('[]')).toThrow('No collections found');
  });

  it('should handle unsupported auth types gracefully', () => {
    const coll = {
      name: 'Test',
      requests: [{
        name: 'Req',
        method: 'GET',
        endpoint: 'https://example.com',
        auth: { authType: 'oauth2', authActive: true },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].auth.type).toBe('none');
  });

  it('should convert inherit auth type', () => {
    const coll = {
      name: 'Test',
      requests: [{
        name: 'Req',
        method: 'GET',
        endpoint: 'https://example.com',
        auth: { authType: 'inherit' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].auth.type).toBe('inherit');
  });

  it('should generate unique IDs for all items', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-collection.json'), 'utf-8');
    const collections = importHoppscotchCollection(content);

    const ids = new Set<string>();
    const collectIds = (coll: typeof collections[0]) => {
      ids.add(coll.id);
      for (const req of coll.requests) ids.add(req.id);
      for (const folder of coll.folders) {
        ids.add(folder.id);
        for (const req of folder.requests) ids.add(req.id);
      }
    };
    collections.forEach(collectIds);

    // Total: 1 coll + 2 top-requests + 1 folder + 1 nested request = 5
    expect(ids.size).toBe(5);
  });
});

// --------------------------------------------------------------------------
// Hoppscotch Environment Import
// --------------------------------------------------------------------------

describe('importHoppscotchEnvironment', () => {
  it('should import multiple environments from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-environment.json'), 'utf-8');
    const envs = importHoppscotchEnvironment(content);

    expect(envs.length).toBe(2);
    expect(envs[0].name).toBe('Development');
    expect(envs[1].name).toBe('Production');
  });

  it('should parse variables correctly', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-environment.json'), 'utf-8');
    const devEnv = importHoppscotchEnvironment(content)[0];

    expect(devEnv.variables.length).toBe(3);

    const baseUrl = devEnv.variables.find(v => v.key === 'baseUrl');
    expect(baseUrl).toBeDefined();
    expect(baseUrl!.value).toBe('http://localhost:3000');
  });

  it('should mark secret variables', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-environment.json'), 'utf-8');
    const devEnv = importHoppscotchEnvironment(content)[0];

    const apiKey = devEnv.variables.find(v => v.key === 'apiKey');
    expect(apiKey).toBeDefined();
    expect(apiKey!.isSecret).toBe(true);
  });

  it('should map initialValue and currentValue', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-environment.json'), 'utf-8');
    const devEnv = importHoppscotchEnvironment(content)[0];

    const apiKey = devEnv.variables.find(v => v.key === 'apiKey');
    expect(apiKey!.initialValue).toBe('');
    expect(apiKey!.currentValue).toBe('dev-key-123');
  });

  it('should handle a single environment object', () => {
    const single = {
      v: 2,
      id: 'test',
      name: 'Single Env',
      variables: [{ key: 'host', initialValue: 'localhost', currentValue: 'localhost', secret: false }],
    };
    const result = importHoppscotchEnvironment(JSON.stringify(single));
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Single Env');
    expect(result[0].variables.length).toBe(1);
  });

  it('should handle empty content', () => {
    expect(() => importHoppscotchEnvironment('')).toThrow('Empty content');
  });

  it('should handle invalid JSON', () => {
    expect(() => importHoppscotchEnvironment('not json')).toThrow('Invalid JSON');
  });

  it('should handle empty array', () => {
    expect(() => importHoppscotchEnvironment('[]')).toThrow('No environments found');
  });

  it('should generate unique IDs', () => {
    const content = readFileSync(join(fixturesDir, 'hoppscotch-environment.json'), 'utf-8');
    const envs = importHoppscotchEnvironment(content);

    const ids = new Set<string>();
    for (const env of envs) {
      ids.add(env.id);
      for (const v of env.variables) ids.add(v.id);
    }
    // 2 envs + 3 vars (dev) + 2 vars (prod) = 7
    expect(ids.size).toBe(7);
  });
});

// --------------------------------------------------------------------------
// Additional coverage — uncovered branches
// --------------------------------------------------------------------------

describe('importHoppscotchCollection — additional branch coverage', () => {
  it('should convert api-key auth type', () => {
    const coll = {
      name: 'API Key Test',
      requests: [{
        name: 'Req',
        method: 'GET',
        endpoint: 'https://example.com',
        auth: { authType: 'api-key', key: 'X-Key', value: 'secret', addTo: 'query' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].auth.type).toBe('api-key');
    expect(result[0].requests[0].auth.apiKey?.key).toBe('X-Key');
    expect(result[0].requests[0].auth.apiKey?.value).toBe('secret');
    expect(result[0].requests[0].auth.apiKey?.addTo).toBe('query');
  });

  it('should convert api-key auth with addTo=header (default)', () => {
    const coll = {
      name: 'API Key Test',
      requests: [{
        name: 'Req',
        method: 'GET',
        endpoint: 'https://example.com',
        auth: { authType: 'api-key', key: 'X-Key', value: 'v', addTo: 'header' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].auth.apiKey?.addTo).toBe('header');
  });

  it('should handle multipart/form-data body', () => {
    const coll = {
      name: 'Form Test',
      requests: [{
        name: 'Upload',
        method: 'POST',
        endpoint: 'https://example.com/upload',
        body: {
          contentType: 'multipart/form-data',
          body: JSON.stringify([{ key: 'file', value: 'data', active: true }]),
        },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('form-data');
    expect(result[0].requests[0].body.formData?.length).toBe(1);
  });

  it('should handle text/plain body type', () => {
    const coll = {
      name: 'Text Test',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: { contentType: 'text/plain', body: 'Hello world' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('raw');
    expect(result[0].requests[0].body.raw).toBe('Hello world');
  });

  it('should handle text/xml body type', () => {
    const coll = {
      name: 'XML Test',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: { contentType: 'application/xml', body: '<root/>' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('raw');
    expect(result[0].requests[0].body.raw).toBe('<root/>');
  });

  it('should handle text/html body type', () => {
    const coll = {
      name: 'HTML Test',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: { contentType: 'text/html', body: '<h1>Hi</h1>' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('raw');
  });

  it('should handle form-urlencoded body as URL-encoded string (not JSON array)', () => {
    const coll = {
      name: 'Urlencoded String Test',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: {
          contentType: 'application/x-www-form-urlencoded',
          body: 'key=value&foo=bar',
        },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('x-www-form-urlencoded');
    expect(result[0].requests[0].body.urlencoded!.length).toBe(2);
    expect(result[0].requests[0].body.urlencoded![0].key).toBe('key');
    expect(result[0].requests[0].body.urlencoded![0].value).toBe('value');
  });

  it('should handle unknown body contentType as raw', () => {
    const coll = {
      name: 'Unknown body',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: { contentType: 'application/octet-stream', body: 'binary data' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('raw');
  });

  it('should handle invalid collection item (not an object)', () => {
    expect(() => importHoppscotchCollection(JSON.stringify([42]))).toThrow('not an object');
  });

  it('should handle collection item missing name/requests/folders', () => {
    expect(() => importHoppscotchCollection(JSON.stringify([{ v: 1 }]))).toThrow('expected');
  });

  it('should default method to GET for invalid method', () => {
    const coll = {
      name: 'Bad Method',
      requests: [{
        name: 'Req',
        method: 'INVALID',
        endpoint: 'https://example.com',
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].method).toBe('GET');
  });

  it('should handle request with null/empty auth', () => {
    const coll = {
      name: 'Test',
      requests: [{
        name: 'Req',
        method: 'GET',
        endpoint: 'https://example.com',
        auth: { authType: '' },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].auth.type).toBe('none');
  });

  it('should handle folder with auth and description', () => {
    const coll = {
      name: 'Test',
      folders: [{
        name: 'Authed Folder',
        description: 'A folder with auth',
        auth: { authType: 'bearer', token: 'folder-token' },
        requests: [{
          name: 'Req',
          method: 'GET',
          endpoint: 'https://example.com',
        }],
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].folders[0].auth?.type).toBe('bearer');
    expect(result[0].folders[0].description).toBe('A folder with auth');
  });

  it('should handle multipart/form-data with unparseable body', () => {
    const coll = {
      name: 'Test',
      requests: [{
        name: 'Req',
        method: 'POST',
        endpoint: 'https://example.com',
        body: {
          contentType: 'multipart/form-data',
          body: 'not json',
        },
      }],
    };
    const result = importHoppscotchCollection(JSON.stringify(coll));
    expect(result[0].requests[0].body.type).toBe('form-data');
    expect(result[0].requests[0].body.formData).toEqual([]);
  });
});

describe('importHoppscotchEnvironment — additional branch coverage', () => {
  it('should handle invalid environment item (not an object)', () => {
    expect(() => importHoppscotchEnvironment(JSON.stringify([42]))).toThrow('not an object');
  });

  it('should handle environment item missing name and variables', () => {
    expect(() => importHoppscotchEnvironment(JSON.stringify([{ v: 1 }]))).toThrow('expected');
  });

  it('should handle environment with name but no variables', () => {
    const result = importHoppscotchEnvironment(JSON.stringify({ name: 'Empty Env' }));
    expect(result[0].name).toBe('Empty Env');
    expect(result[0].variables).toEqual([]);
  });

  it('should use fallback name when name is missing', () => {
    const result = importHoppscotchEnvironment(JSON.stringify({ variables: [{ key: 'x', initialValue: 'y' }] }));
    expect(result[0].name).toBe('Imported Environment');
  });

  it('should fallback to value when initialValue is missing', () => {
    const result = importHoppscotchEnvironment(JSON.stringify({
      name: 'Test',
      variables: [{ key: 'x', value: 'fromValue' }],
    }));
    expect(result[0].variables[0].value).toBe('fromValue');
    expect(result[0].variables[0].initialValue).toBe('fromValue');
  });
});
