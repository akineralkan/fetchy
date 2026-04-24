/**
 * Tests for src/utils/codeGenerator.ts
 *
 * Covers all code generation functions:
 *  - generateCurl
 *  - generateJavaScript
 *  - generatePython
 *  - generateJava
 *  - generateDotNet
 *  - generateGo
 *  - generateRust
 */

import { describe, expect, it } from 'vitest';
import {
  generateCurl,
  generateJavaScript,
  generatePython,
  generateJava,
  generateDotNet,
  generateGo,
  generateRust,
  generateCpp,
} from '../src/utils/codeGenerator';
import type { ApiRequest, KeyValue } from '../src/types';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
  return {
    id: 'test-id',
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
    ...overrides,
  };
}

function makeVar(key: string, value: string): KeyValue {
  return { id: key, key, value, enabled: true };
}

// ─── generateCurl ─────────────────────────────────────────────────────────────

describe('generateCurl', () => {
  it('generates a basic GET request', () => {
    const code = generateCurl(makeRequest());
    expect(code).toContain('curl -X GET');
    expect(code).toContain('https://api.example.com/users');
  });

  it('includes POST method', () => {
    const code = generateCurl(makeRequest({ method: 'POST' }));
    expect(code).toContain('curl -X POST');
  });

  it('includes enabled headers', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }],
    });
    const code = generateCurl(req);
    expect(code).toContain("-H 'Accept: application/json'");
  });

  it('omits disabled headers', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'X-Skip', value: 'yes', enabled: false }],
    });
    const code = generateCurl(req);
    expect(code).not.toContain('X-Skip');
  });

  it('appends query params from request.params', () => {
    const req = makeRequest({
      params: [{ id: '1', key: 'page', value: '1', enabled: true }],
    });
    const code = generateCurl(req);
    expect(code).toContain('page=1');
  });

  it('adds bearer auth header', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'my-token' } },
    });
    const code = generateCurl(req);
    expect(code).toContain("Authorization: Bearer my-token");
  });

  it('adds basic auth header', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'user', password: 'pass' } },
    });
    const code = generateCurl(req);
    expect(code).toContain('Authorization: Basic');
  });

  it('adds api-key auth to header', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'secret', addTo: 'header' } },
    });
    const code = generateCurl(req);
    expect(code).toContain('X-API-Key: secret');
  });

  it('includes JSON body with -d flag', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"name":"Alice"}' },
    });
    const code = generateCurl(req);
    expect(code).toContain('-d');
    expect(code).toContain('name');
  });

  it('includes urlencoded body', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'username', value: 'alice', enabled: true }],
      },
    });
    const code = generateCurl(req);
    expect(code).toContain('username=alice');
  });

  it('substitutes variables in the URL', () => {
    const req = makeRequest({ url: 'https://<<host>>/api' });
    const vars = [makeVar('host', 'example.com')];
    const code = generateCurl(req, vars);
    expect(code).toContain('https://example.com/api');
  });

  it('strips existing query string from URL and re-appends from params', () => {
    const req = makeRequest({
      url: 'https://api.example.com/users?old=1',
      params: [{ id: '1', key: 'new', value: '2', enabled: true }],
    });
    const code = generateCurl(req);
    expect(code).not.toContain('old=1');
    expect(code).toContain('new=2');
  });
});

// ─── generateJavaScript ───────────────────────────────────────────────────────

describe('generateJavaScript', () => {
  it('generates a fetch call with the URL', () => {
    const code = generateJavaScript(makeRequest());
    expect(code).toContain("fetch('https://api.example.com/users'");
  });

  it('includes the HTTP method', () => {
    const code = generateJavaScript(makeRequest({ method: 'DELETE' }));
    expect(code).toContain("method: 'DELETE'");
  });

  it('includes enabled headers in the headers object', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
    });
    const code = generateJavaScript(req);
    expect(code).toContain('Content-Type');
    expect(code).toContain('application/json');
  });

  it('adds bearer token to headers', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'abc' } },
    });
    const code = generateJavaScript(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('Bearer abc');
  });

  it('adds JSON body', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"key":"val"}' },
    });
    const code = generateJavaScript(req);
    expect(code).toContain('body:');
  });

  it('returns a string ending with catch block', () => {
    const code = generateJavaScript(makeRequest());
    expect(code).toContain('.catch(');
  });
});

// ─── generatePython ───────────────────────────────────────────────────────────

describe('generatePython', () => {
  it('starts with import requests', () => {
    const code = generatePython(makeRequest());
    expect(code).toContain('import requests');
  });

  it('includes the URL', () => {
    const code = generatePython(makeRequest());
    expect(code).toContain("url = 'https://api.example.com/users'");
  });

  it('uses the correct HTTP method', () => {
    const code = generatePython(makeRequest({ method: 'POST' }));
    expect(code).toContain('requests.post(');
  });

  it('includes headers dict when headers are provided', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'Accept', value: '*/*', enabled: true }],
    });
    const code = generatePython(req);
    expect(code).toContain('headers =');
    expect(code).toContain("'Accept': '*/*'");
  });

  it('omits headers dict when no headers', () => {
    const code = generatePython(makeRequest());
    expect(code).not.toContain('headers = {');
  });

  it('adds bearer auth', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'tok' } },
    });
    const code = generatePython(req);
    expect(code).toContain("'Authorization': 'Bearer tok'");
  });

  it('adds JSON body as json= parameter', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"a":1}' },
    });
    const code = generatePython(req);
    expect(code).toContain(', json=');
  });

  it('prints response with print(response.json())', () => {
    const code = generatePython(makeRequest());
    expect(code).toContain('print(response.json())');
  });
});

// ─── generateJava ─────────────────────────────────────────────────────────────

describe('generateJava', () => {
  it('imports Java HttpClient', () => {
    const code = generateJava(makeRequest());
    expect(code).toContain('import java.net.http.HttpClient');
  });

  it('contains the URL', () => {
    const code = generateJava(makeRequest());
    expect(code).toContain('https://api.example.com/users');
  });

  it('uses the correct method', () => {
    const code = generateJava(makeRequest({ method: 'PUT' }));
    expect(code).toContain('"PUT"');
  });

  it('adds bearer header', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'mytoken' } },
    });
    const code = generateJava(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('Bearer mytoken');
  });

  it('uses noBody() publisher when body type is none', () => {
    const code = generateJava(makeRequest());
    expect(code).toContain('noBody()');
  });

  it('uses ofString publisher when body provided', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{}' },
    });
    const code = generateJava(req);
    expect(code).toContain('ofString(');
  });
});

// ─── generateDotNet ───────────────────────────────────────────────────────────

describe('generateDotNet', () => {
  it('imports System.Net.Http', () => {
    const code = generateDotNet(makeRequest());
    expect(code).toContain('using System.Net.Http');
  });

  it('creates an HttpClient instance', () => {
    const code = generateDotNet(makeRequest());
    expect(code).toContain('new HttpClient()');
  });

  it('includes the URL', () => {
    const code = generateDotNet(makeRequest());
    expect(code).toContain('https://api.example.com/users');
  });

  it('adds bearer authorization', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'xyz' } },
    });
    const code = generateDotNet(req);
    expect(code).toContain('Bearer');
    expect(code).toContain('xyz');
  });

  it('adds StringContent for JSON body', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"x":1}' },
    });
    const code = generateDotNet(req);
    expect(code).toContain('StringContent');
  });

  it('handles GET without body', () => {
    const code = generateDotNet(makeRequest({ method: 'GET' }));
    expect(code).toContain('GetAsync');
  });
});

// ─── generateGo ──────────────────────────────────────────────────────────────

describe('generateGo', () => {
  it('starts with package main', () => {
    const code = generateGo(makeRequest());
    expect(code).toContain('package main');
  });

  it('imports net/http', () => {
    const code = generateGo(makeRequest());
    expect(code).toContain('"net/http"');
  });

  it('creates a NewRequest with the method', () => {
    const code = generateGo(makeRequest({ method: 'PATCH' }));
    expect(code).toContain('"PATCH"');
  });

  it('adds bearer header', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'gotoken' } },
    });
    const code = generateGo(req);
    expect(code).toContain('Bearer gotoken');
  });

  it('uses SetBasicAuth for basic auth', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'u', password: 'p' } },
    });
    const code = generateGo(req);
    expect(code).toContain('SetBasicAuth');
  });

  it('ends with fmt.Println', () => {
    const code = generateGo(makeRequest());
    expect(code).toContain('fmt.Println');
  });
});

// ─── generateRust ─────────────────────────────────────────────────────────────

describe('generateRust', () => {
  it('uses reqwest crate', () => {
    const code = generateRust(makeRequest());
    expect(code).toContain('reqwest');
  });

  it('uses tokio main', () => {
    const code = generateRust(makeRequest());
    expect(code).toContain('#[tokio::main]');
  });

  it('includes the URL', () => {
    const code = generateRust(makeRequest());
    expect(code).toContain('https://api.example.com/users');
  });

  it('uses the correct method function', () => {
    const code = generateRust(makeRequest({ method: 'POST' }));
    expect(code).toContain('.post(');
  });

  it('adds bearer auth to headers', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'rtoken' } },
    });
    const code = generateRust(req);
    expect(code).toContain('Bearer rtoken');
  });

  it('adds basic auth credentials to headers', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'alice', password: 'pw' } },
    });
    const code = generateRust(req);
    expect(code).toContain('Basic ');
  });

  it('adds api-key auth to headers', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-Key', value: 'rust-secret', addTo: 'header' } },
    });
    const code = generateRust(req);
    expect(code).toContain('X-Key');
    expect(code).toContain('rust-secret');
  });

  it('adds JSON body with .body()', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"x":1}' },
    });
    const code = generateRust(req);
    expect(code).toContain('.body(');
  });

  it('adds raw body with .body()', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'raw', raw: 'plain text body' },
    });
    const code = generateRust(req);
    expect(code).toContain('.body(');
    expect(code).toContain('plain text body');
  });

  it('includes custom headers in HeaderMap', () => {
    const req = makeRequest({
      auth: { type: 'none' },
      headers: [{ id: '1', key: 'X-Custom', value: 'value1', enabled: true }],
    });
    const code = generateRust(req);
    expect(code).toContain('X-Custom');
    expect(code).toContain('value1');
  });
});

// ─── generateJavaScript – additional auth/body coverage ───────────────────

describe('generateJavaScript – additional auth and body', () => {
  it('adds basic auth credentials to headers', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'bob', password: 'secret' } },
    });
    const code = generateJavaScript(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('Basic ');
  });

  it('adds api-key auth to headers', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'js-secret', addTo: 'header' } },
    });
    const code = generateJavaScript(req);
    expect(code).toContain('X-API-Key');
    expect(code).toContain('js-secret');
  });

  it('adds x-www-form-urlencoded body', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [
          { id: '1', key: 'field1', value: 'val1', enabled: true },
          { id: '2', key: 'field2', value: 'val2', enabled: true },
        ],
      },
    });
    const code = generateJavaScript(req);
    expect(code).toContain('body:');
    expect(code).toContain('field1');
    expect(code).toContain('field2');
  });
});

// ─── generatePython – additional auth/body coverage ───────────────────────

describe('generatePython – additional auth and body', () => {
  it('adds basic auth credentials to headers', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'bob', password: 'secret' } },
    });
    const code = generatePython(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('Basic ');
  });

  it('adds api-key auth to headers', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'py-secret', addTo: 'header' } },
    });
    const code = generatePython(req);
    expect(code).toContain('X-API-Key');
    expect(code).toContain('py-secret');
  });

  it('adds raw body as data= parameter', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'raw', raw: 'raw content' },
    });
    const code = generatePython(req);
    expect(code).toContain(', data=');
    expect(code).toContain('raw content');
  });

  it('adds x-www-form-urlencoded body as data dict', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'username', value: 'alice', enabled: true }],
      },
    });
    const code = generatePython(req);
    expect(code).toContain('data =');
    expect(code).toContain('username');
  });
});

// ─── generateJava – additional auth/body/header coverage ─────────────────

describe('generateJava – additional auth, body, and headers', () => {
  it('adds basic auth header', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'javauser', password: 'javapass' } },
    });
    const code = generateJava(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('Basic ');
  });

  it('adds api-key auth header', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'java-secret', addTo: 'header' } },
    });
    const code = generateJava(req);
    expect(code).toContain('X-API-Key');
    expect(code).toContain('java-secret');
  });

  it('adds x-www-form-urlencoded body using ofString', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'k', value: 'v', enabled: true }],
      },
    });
    const code = generateJava(req);
    expect(code).toContain('ofString(');
    expect(code).toContain('k=v');
  });

  it('uses noBody() when json body has no raw content', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '' },
    });
    const code = generateJava(req);
    expect(code).toContain('noBody()');
  });

  it('includes enabled custom headers', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'X-Trace', value: 'trace123', enabled: true }],
    });
    const code = generateJava(req);
    expect(code).toContain('X-Trace');
    expect(code).toContain('trace123');
  });
});

// ─── generateDotNet – additional auth/body/header coverage ───────────────

describe('generateDotNet – additional auth, body, and headers', () => {
  it('adds basic auth header', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'dotuser', password: 'dotpass' } },
    });
    const code = generateDotNet(req);
    expect(code).toContain('Authorization');
    expect(code).toContain('"Basic"');
  });

  it('adds api-key auth header', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'dot-secret', addTo: 'header' } },
    });
    const code = generateDotNet(req);
    expect(code).toContain('X-API-Key');
    expect(code).toContain('dot-secret');
  });

  it('adds x-www-form-urlencoded body with FormUrlEncodedContent', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'field', value: 'val', enabled: true }],
      },
    });
    const code = generateDotNet(req);
    expect(code).toContain('FormUrlEncodedContent');
    expect(code).toContain('field');
  });

  it('uses simple async call when json body has no raw content', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '' },
    });
    const code = generateDotNet(req);
    // When no raw body, should just call PostAsync without StringContent
    expect(code).not.toContain('StringContent');
  });

  it('includes enabled custom headers via DefaultRequestHeaders', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'X-Req-Id', value: 'abc', enabled: true }],
    });
    const code = generateDotNet(req);
    expect(code).toContain('X-Req-Id');
    expect(code).toContain('abc');
  });
});

// ─── generateGo – additional body/header coverage ────────────────────────

describe('generateGo – additional body and headers', () => {
  it('adds json body with bytes.NewBuffer', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"go":true}' },
    });
    const code = generateGo(req);
    expect(code).toContain('bytes.NewBuffer');
    expect(code).toContain('jsonData');
  });

  it('adds raw body with bytes.NewBuffer', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'raw', raw: 'raw-data' },
    });
    const code = generateGo(req);
    expect(code).toContain('bytes.NewBuffer');
  });

  it('adds x-www-form-urlencoded body as data string', () => {
    const req = makeRequest({
      method: 'POST',
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'k', value: 'v', enabled: true }],
      },
    });
    const code = generateGo(req);
    expect(code).toContain('bytes.NewBuffer');
    expect(code).toContain('k=v');
  });

  it('includes enabled custom headers via req.Header.Set', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'X-Go-Header', value: 'go-value', enabled: true }],
    });
    const code = generateGo(req);
    expect(code).toContain('X-Go-Header');
    expect(code).toContain('go-value');
  });

  it('adds api-key auth header', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'go-secret', addTo: 'header' } },
    });
    const code = generateGo(req);
    expect(code).toContain('X-API-Key');
    expect(code).toContain('go-secret');
  });
});

// ─── generateCpp ─────────────────────────────────────────────────────────────

describe('generateCpp', () => {
  it('includes curl/curl.h header', () => {
    const code = generateCpp(makeRequest());
    expect(code).toContain('#include <curl/curl.h>');
  });

  it('includes the URL in curl_easy_setopt', () => {
    const code = generateCpp(makeRequest());
    expect(code).toContain('https://api.example.com/users');
  });

  it('sets the HTTP method via CURLOPT_CUSTOMREQUEST', () => {
    const code = generateCpp(makeRequest({ method: 'DELETE' }));
    expect(code).toContain('CURLOPT_CUSTOMREQUEST');
    expect(code).toContain('"DELETE"');
  });

  it('adds bearer auth via curl_slist_append', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: 'cpp-token' } },
    });
    const code = generateCpp(req);
    expect(code).toContain('Authorization: Bearer cpp-token');
  });

  it('adds basic auth via curl_slist_append', () => {
    const req = makeRequest({
      auth: { type: 'basic', basic: { username: 'cppuser', password: 'cpppass' } },
    });
    const code = generateCpp(req);
    expect(code).toContain('Authorization: Basic ');
  });

  it('adds api-key auth via curl_slist_append', () => {
    const req = makeRequest({
      auth: { type: 'api-key', apiKey: { key: 'X-Key', value: 'cpp-secret', addTo: 'header' } },
    });
    const code = generateCpp(req);
    expect(code).toContain('X-Key: cpp-secret');
  });

  it('adds custom headers via curl_slist_append', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }],
    });
    const code = generateCpp(req);
    expect(code).toContain('Accept: application/json');
  });

  it('sets JSON body via CURLOPT_POSTFIELDS', () => {
    const req = makeRequest({
      method: 'POST',
      body: { type: 'json', raw: '{"cpp":true}' },
    });
    const code = generateCpp(req);
    expect(code).toContain('CURLOPT_POSTFIELDS');
  });

  it('ends with curl_easy_cleanup', () => {
    const code = generateCpp(makeRequest());
    expect(code).toContain('curl_easy_cleanup');
  });

  it('includes WriteCallback for response reading', () => {
    const code = generateCpp(makeRequest());
    expect(code).toContain('WriteCallback');
  });
});
