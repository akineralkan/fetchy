/**
 * Tests for Bruno collection and environment import parsers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importBrunoCollection, importBrunoEnvironment } from '../src/utils/bruno';

const fixturesDir = join(__dirname, 'data');

// --------------------------------------------------------------------------
// Bruno Collection Import — JSON format
// --------------------------------------------------------------------------

describe('importBrunoCollection — JSON format', () => {
  it('should import a valid Bruno JSON collection from fixture file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    expect(collection.name).toBe('Bruno Test Collection');
    expect(collection.description).toBe('Imported from Bruno collection');
  });

  it('should parse top-level requests', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    expect(collection.requests.length).toBe(1);
    expect(collection.requests[0].name).toBe('Get Users');
    expect(collection.requests[0].method).toBe('GET');
    expect(collection.requests[0].url).toBe('https://api.example.com/users');
  });

  it('should parse folders and nested requests', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    expect(collection.folders.length).toBe(1);
    expect(collection.folders[0].name).toBe('Auth');
    expect(collection.folders[0].requests.length).toBe(2);
  });

  it('should parse headers from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const getUsers = collection.requests[0];
    expect(getUsers.headers.length).toBe(1);
    expect(getUsers.headers[0].key).toBe('Accept');
    expect(getUsers.headers[0].value).toBe('application/json');
  });

  it('should parse query params from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const getUsers = collection.requests[0];
    expect(getUsers.params.length).toBe(2);

    const page = getUsers.params.find(p => p.key === 'page');
    expect(page!.value).toBe('1');
    expect(page!.enabled).toBe(true);

    const limit = getUsers.params.find(p => p.key === 'limit');
    expect(limit!.enabled).toBe(false);
  });

  it('should parse bearer auth from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const getUsers = collection.requests[0];
    expect(getUsers.auth.type).toBe('bearer');
    if (getUsers.auth.type === 'bearer') {
      expect(getUsers.auth.bearer?.token).toBe('my-bearer-token');
    }
  });

  it('should parse basic auth from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const login = collection.folders[0].requests.find(r => r.name === 'Login')!;
    expect(login.auth.type).toBe('basic');
    if (login.auth.type === 'basic') {
      expect(login.auth.basic?.username).toBe('admin');
      expect(login.auth.basic?.password).toBe('secret');
    }
  });

  it('should parse API key auth from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const checkApiKey = collection.folders[0].requests.find(r => r.name === 'Check API Key')!;
    expect(checkApiKey.auth.type).toBe('api-key');
    if (checkApiKey.auth.type === 'api-key') {
      expect(checkApiKey.auth.apiKey?.key).toBe('X-API-Key');
      expect(checkApiKey.auth.apiKey?.value).toBe('test-key');
      expect(checkApiKey.auth.apiKey?.addTo).toBe('header');
    }
  });

  it('should parse JSON body from JSON format', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-collection.json'), 'utf-8');
    const collection = importBrunoCollection(content);

    const login = collection.folders[0].requests.find(r => r.name === 'Login')!;
    expect(login.body.type).toBe('json');
  });

  it('should handle empty content', () => {
    expect(() => importBrunoCollection('')).toThrow('Empty content');
  });

  it('should handle invalid JSON that is not .bru', () => {
    expect(() => importBrunoCollection('{invalid')).toThrow();
  });
});

// --------------------------------------------------------------------------
// Bruno Collection Import — .bru file format
// --------------------------------------------------------------------------

describe('importBrunoCollection — .bru format', () => {
  it('should import a .bru GET request file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);

    expect(collection.name).toContain('Get Users');
    expect(collection.requests.length).toBe(1);
  });

  it('should parse method and URL from .bru file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.example.com/users');
  });

  it('should parse headers from .bru file with disabled entries', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.headers.length).toBe(3);

    const accept = req.headers.find(h => h.key === 'Accept');
    expect(accept!.enabled).toBe(true);
    expect(accept!.value).toBe('application/json');

    const debug = req.headers.find(h => h.key === 'X-Debug');
    expect(debug!.enabled).toBe(false);
  });

  it('should parse query params from .bru file with disabled entries', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.params.length).toBeGreaterThanOrEqual(3);

    const page = req.params.find(p => p.key === 'page');
    expect(page!.enabled).toBe(true);
    expect(page!.value).toBe('1');

    const verbose = req.params.find(p => p.key === 'verbose');
    expect(verbose!.enabled).toBe(false);
  });

  it('should parse bearer auth from .bru file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.auth.type).toBe('bearer');
    if (req.auth.type === 'bearer') {
      expect(req.auth.bearer?.token).toBe('my-bearer-token');
    }
  });

  it('should parse pre-request and post-response scripts', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.preScript).toContain('token');
    expect(req.script).toContain('userId');
  });

  it('should import a .bru POST request with body', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request-post.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.example.com/users');
    expect(req.body.type).toBe('json');
    if (req.body.type === 'json') {
      expect(req.body.raw).toContain('John Doe');
    }
  });

  it('should parse basic auth from .bru file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request-post.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.auth.type).toBe('basic');
    if (req.auth.type === 'basic') {
      expect(req.auth.basic?.username).toBe('admin');
      expect(req.auth.basic?.password).toBe('secret123');
    }
  });

  it('should set request name from meta block', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-request.bru'), 'utf-8');
    const collection = importBrunoCollection(content);
    const req = collection.requests[0];

    expect(req.name).toBe('Get Users');
  });
});

// --------------------------------------------------------------------------
// Bruno Environment Import — .bru format
// --------------------------------------------------------------------------

describe('importBrunoEnvironment — .bru format', () => {
  it('should import a .bru environment file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const envs = importBrunoEnvironment(content);

    expect(envs.length).toBe(1);
    expect(envs[0].name).toBe('Bruno Environment');
  });

  it('should parse regular vars', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const apiUrl = env.variables.find(v => v.key === 'API_URL');
    expect(apiUrl).toBeDefined();
    expect(apiUrl!.value).toBe('https://api.example.com');
    expect(apiUrl!.enabled).toBe(true);
    expect(apiUrl!.isSecret).toBe(false);
  });

  it('should parse disabled vars (~ prefix)', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const debugMode = env.variables.find(v => v.key === 'DEBUG_MODE');
    expect(debugMode).toBeDefined();
    expect(debugMode!.enabled).toBe(false);
    expect(debugMode!.value).toBe('true');
  });

  it('should parse secret vars', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const apiKey = env.variables.find(v => v.key === 'API_KEY');
    expect(apiKey).toBeDefined();
    expect(apiKey!.isSecret).toBe(true);
    expect(apiKey!.enabled).toBe(true);
    expect(apiKey!.value).toBe('');
  });

  it('should parse disabled secret vars', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const deprecated = env.variables.find(v => v.key === 'DEPRECATED_TOKEN');
    expect(deprecated).toBeDefined();
    expect(deprecated!.isSecret).toBe(true);
    expect(deprecated!.enabled).toBe(false);
  });

  it('should have correct total number of variables', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.bru'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    // 4 regular vars + 3 secret vars = 7
    expect(env.variables.length).toBe(7);
  });

  it('should handle empty content', () => {
    expect(() => importBrunoEnvironment('')).toThrow('Empty content');
  });
});

// --------------------------------------------------------------------------
// Bruno Environment Import — JSON format
// --------------------------------------------------------------------------

describe('importBrunoEnvironment — JSON format', () => {
  it('should import a JSON environment file', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.json'), 'utf-8');
    const envs = importBrunoEnvironment(content);

    expect(envs.length).toBe(1);
    expect(envs[0].name).toBe('Bruno Test Environment');
  });

  it('should parse all variables from JSON', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.json'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    expect(env.variables.length).toBe(4);
  });

  it('should map variable keys and values from JSON', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.json'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const baseUrl = env.variables.find(v => v.key === 'baseUrl');
    expect(baseUrl).toBeDefined();
    expect(baseUrl!.value).toBe('https://api.example.com');
    expect(baseUrl!.enabled).toBe(true);
  });

  it('should respect secret flag in JSON', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.json'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const apiKey = env.variables.find(v => v.key === 'apiKey');
    expect(apiKey!.isSecret).toBe(true);
  });

  it('should respect disabled flag in JSON', () => {
    const content = readFileSync(join(fixturesDir, 'bruno-environment.json'), 'utf-8');
    const env = importBrunoEnvironment(content)[0];

    const debugMode = env.variables.find(v => v.key === 'debugMode');
    expect(debugMode!.enabled).toBe(false);
  });

  it('should handle array of environments', () => {
    const envs = [
      { name: 'Env1', variables: [{ name: 'a', value: '1', enabled: true }] },
      { name: 'Env2', variables: [{ name: 'b', value: '2', enabled: true }] },
    ];
    const result = importBrunoEnvironment(JSON.stringify(envs));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Env1');
    expect(result[1].name).toBe('Env2');
  });

  it('should handle invalid JSON that is not .bru environment', () => {
    expect(() => importBrunoEnvironment('{invalid')).toThrow();
  });
});

// --------------------------------------------------------------------------
// Edge cases
// --------------------------------------------------------------------------

describe('importBrunoCollection — edge cases', () => {
  it('should handle minimal .bru file', () => {
    const bru = `meta {
  name: Minimal
  type: http
}

get {
  url: https://example.com
}
`;
    const collection = importBrunoCollection(bru);
    expect(collection.requests.length).toBe(1);
    expect(collection.requests[0].method).toBe('GET');
    expect(collection.requests[0].url).toBe('https://example.com');
    expect(collection.requests[0].name).toBe('Minimal');
  });

  it('should handle .bru file with form-urlencoded body', () => {
    const bru = `meta {
  name: Form Post
  type: http
}

post {
  url: https://example.com/form
}

body:form-urlencoded {
  username: admin
  password: secret
  ~remember: true
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.body.type).toBe('x-www-form-urlencoded');
    if (req.body.type === 'x-www-form-urlencoded') {
      expect(req.body.urlencoded!.length).toBe(3);
      const remember = req.body.urlencoded!.find(p => p.key === 'remember');
      expect(remember!.enabled).toBe(false);
    }
  });

  it('should handle .bru file with apikey auth', () => {
    const bru = `meta {
  name: API Key Auth
  type: http
}

get {
  url: https://example.com/protected
}

auth:apikey {
  key: X-API-Key
  value: my-secret-key
  placement: header
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.auth.type).toBe('api-key');
    if (req.auth.type === 'api-key') {
      expect(req.auth.apiKey?.key).toBe('X-API-Key');
      expect(req.auth.apiKey?.value).toBe('my-secret-key');
      expect(req.auth.apiKey?.addTo).toBe('header');
    }
  });

  it('should handle Bruno JSON with nested folders', () => {
    const json = {
      name: 'Deep Collection',
      items: [
        {
          type: 'folder',
          name: 'Level 1',
          items: [
            {
              type: 'folder',
              name: 'Level 2',
              items: [
                {
                  type: 'http-request',
                  name: 'Deep Request',
                  request: { method: 'GET', url: 'https://example.com/deep' },
                },
              ],
            },
          ],
        },
      ],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.folders.length).toBe(1);
    expect(collection.folders[0].name).toBe('Level 1');
    expect(collection.folders[0].folders!.length).toBe(1);
    expect(collection.folders[0].folders![0].name).toBe('Level 2');
    expect(collection.folders[0].folders![0].requests.length).toBe(1);
    expect(collection.folders[0].folders![0].requests[0].name).toBe('Deep Request');
  });

  it('should handle Bruno JSON with headers as Record<string, string>', () => {
    const json = {
      name: 'Record Headers',
      items: [
        {
          type: 'http-request',
          name: 'Record Test',
          request: {
            method: 'GET',
            url: 'https://example.com',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/html' },
          },
        },
      ],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    const req = collection.requests[0];
    expect(req.headers.length).toBe(2);
    expect(req.headers.find(h => h.key === 'Content-Type')!.value).toBe('application/json');
  });
});

describe('importBrunoEnvironment — edge cases', () => {
  it('should handle .bru env with only regular vars', () => {
    const bru = `vars {
  HOST: localhost
  PORT: 3000
}
`;
    const envs = importBrunoEnvironment(bru);
    expect(envs.length).toBe(1);
    expect(envs[0].variables.length).toBe(2);
    expect(envs[0].variables.every(v => !v.isSecret)).toBe(true);
  });

  it('should handle .bru env with only secret vars', () => {
    const bru = `vars:secret [
  API_KEY,
  DB_PASSWORD
]
`;
    const envs = importBrunoEnvironment(bru);
    expect(envs.length).toBe(1);
    expect(envs[0].variables.length).toBe(2);
    expect(envs[0].variables.every(v => v.isSecret)).toBe(true);
  });

  it('should handle JSON env with name field on variables', () => {
    const json = {
      name: 'Named',
      variables: [{ name: 'key1', value: 'val1' }],
    };
    const envs = importBrunoEnvironment(JSON.stringify(json));
    expect(envs[0].variables[0].key).toBe('key1');
  });

  it('should handle JSON env with key field on variables', () => {
    const json = {
      name: 'Keyed',
      variables: [{ key: 'key2', value: 'val2' }],
    };
    const envs = importBrunoEnvironment(JSON.stringify(json));
    expect(envs[0].variables[0].key).toBe('key2');
  });
});

// --------------------------------------------------------------------------
// Additional coverage — uncovered branches
// --------------------------------------------------------------------------

describe('importBrunoCollection — additional body/auth coverage', () => {
  it('should handle .bru file with body:text', () => {
    const bru = `meta {
  name: Text Body
  type: http
}

post {
  url: https://example.com/text
}

body:text {
  Hello this is plain text content
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.body.type).toBe('raw');
    expect(req.body.raw).toContain('Hello this is plain text content');
  });

  it('should handle .bru file with body:xml', () => {
    const bru = `meta {
  name: XML Body
  type: http
}

post {
  url: https://example.com/xml
}

body:xml {
  <root><item>value</item></root>
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.body.type).toBe('raw');
    expect(req.body.raw).toContain('<root>');
  });

  it('should handle .bru file with body:multipart-form', () => {
    const bru = `meta {
  name: Multipart
  type: http
}

post {
  url: https://example.com/upload
}

body:multipart-form {
  name: John
  ~age: 30
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.body.type).toBe('form-data');
    expect(req.body.formData!.length).toBe(2);
    expect(req.body.formData!.find(f => f.key === 'age')!.enabled).toBe(false);
  });

  it('should handle .bru file with http block and explicit method', () => {
    const bru = `meta {
  name: HTTP Block
  type: http
}

http {
  url: https://example.com/resource
  method: PATCH
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.method).toBe('PATCH');
    expect(req.url).toBe('https://example.com/resource');
  });

  it('should handle .bru file with apikey placement queryparams', () => {
    const bru = `meta {
  name: API Key Query
  type: http
}

get {
  url: https://example.com
}

auth:apikey {
  key: api_key
  value: test-value
  placement: queryparams
}
`;
    const collection = importBrunoCollection(bru);
    const req = collection.requests[0];
    expect(req.auth.type).toBe('api-key');
    expect(req.auth.apiKey?.addTo).toBe('query');
  });
});

describe('importBrunoCollection — JSON body modes', () => {
  it('should handle JSON body with text mode', () => {
    const json = {
      name: 'Text Mode',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: { mode: 'text', text: 'plain text content' },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('raw');
    expect(collection.requests[0].body.raw).toBe('plain text content');
  });

  it('should handle JSON body with xml mode', () => {
    const json = {
      name: 'XML Mode',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: { mode: 'xml', xml: '<root/>' },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('raw');
    expect(collection.requests[0].body.raw).toBe('<root/>');
  });

  it('should handle JSON body with formUrlEncoded mode', () => {
    const json = {
      name: 'Form',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: {
            mode: 'formUrlEncoded',
            formUrlEncoded: [{ name: 'key', value: 'val', enabled: true }],
          },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('x-www-form-urlencoded');
    expect(collection.requests[0].body.urlencoded!.length).toBe(1);
  });

  it('should handle JSON body with multipartForm mode (filters file entries)', () => {
    const json = {
      name: 'Multipart',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: {
            mode: 'multipartForm',
            multipartForm: [
              { name: 'field', value: 'text', enabled: true, type: 'text' },
              { name: 'file', value: '/path', enabled: true, type: 'file' },
            ],
          },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('form-data');
    // File entries should be filtered out
    expect(collection.requests[0].body.formData!.length).toBe(1);
    expect(collection.requests[0].body.formData![0].key).toBe('field');
  });

  it('should handle JSON body with no mode but direct json content', () => {
    const json = {
      name: 'Direct JSON',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: { json: '{"key":"value"}' },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('json');
    expect(collection.requests[0].body.raw).toBe('{"key":"value"}');
  });

  it('should handle JSON body with no mode and text content', () => {
    const json = {
      name: 'Direct Text',
      items: [{
        type: 'http-request',
        name: 'Req',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: { text: 'plain' },
        },
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    expect(collection.requests[0].body.type).toBe('raw');
  });

  it('should handle JSON item with no request and no raw content', () => {
    const json = {
      name: 'No Request',
      items: [{
        type: 'http-request',
        name: 'Empty Item',
      }],
    };
    const collection = importBrunoCollection(JSON.stringify(json));
    // Item without request or raw returns null, so no requests
    expect(collection.requests.length).toBe(0);
  });
});

describe('importBrunoEnvironment — additional edge cases', () => {
  it('should throw for empty JSON environments array', () => {
    expect(() => importBrunoEnvironment('[]')).toThrow('No environments found');
  });

  it('should throw for invalid environment item (not an object)', () => {
    expect(() => importBrunoEnvironment(JSON.stringify([42]))).toThrow('not an object');
  });

  it('should throw for environment item missing both name and variables', () => {
    expect(() => importBrunoEnvironment(JSON.stringify([{ v: 1 }]))).toThrow('expected');
  });

  it('should use fallback name for environment without name', () => {
    const json = { variables: [{ name: 'x', value: 'y' }] };
    const envs = importBrunoEnvironment(JSON.stringify(json));
    expect(envs[0].name).toBe('Bruno Environment');
  });
});
