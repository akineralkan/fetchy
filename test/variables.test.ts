/**
 * Tests for src/utils/variables.ts — Variable replacement engine.
 *
 * Tests the core variable substitution system that powers environment
 * and collection variable resolution in request URLs, headers, body, and auth.
 */
import { describe, it, expect } from 'vitest';
import { replaceVariables, resolveRequestVariables } from '../src/utils/variables';
import type { ApiRequest, KeyValue } from '../src/types';

// ─── Helper factories ────────────────────────────────────────────────────────

function makeVar(key: string, value: string, opts?: Partial<KeyValue>): KeyValue {
  return { id: key, key, value, enabled: true, ...opts };
}

function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
  return {
    id: 'req-1',
    name: 'Test Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
    ...overrides,
  };
}

// ─── replaceVariables ────────────────────────────────────────────────────────

describe('replaceVariables', () => {
  it('replaces a single <<variable>> placeholder', () => {
    const vars = [makeVar('host', 'example.com')];
    expect(replaceVariables('https://<<host>>/api', vars, [])).toBe('https://example.com/api');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const vars = [makeVar('token', 'abc123')];
    expect(replaceVariables('<<token>>-<<token>>', vars, [])).toBe('abc123-abc123');
  });

  it('replaces multiple different variables', () => {
    const vars = [makeVar('host', 'api.dev'), makeVar('port', '8080')];
    expect(replaceVariables('http://<<host>>:<<port>>', vars, [])).toBe('http://api.dev:8080');
  });

  it('leaves unmatched placeholders unchanged', () => {
    expect(replaceVariables('<<unknown>>', [], [])).toBe('<<unknown>>');
  });

  it('ignores disabled variables', () => {
    const vars = [makeVar('host', 'example.com', { enabled: false })];
    expect(replaceVariables('<<host>>', vars, [])).toBe('<<host>>');
  });

  it('returns original text when there are no variables', () => {
    expect(replaceVariables('plain text', [], [])).toBe('plain text');
  });

  it('handles empty string input', () => {
    expect(replaceVariables('', [makeVar('x', 'y')], [])).toBe('');
  });

  // Priority tests
  it('collection variables override environment variables with the same key', () => {
    const collVars = [makeVar('host', 'prod.api.com')];
    const envVars = [makeVar('host', 'dev.api.com')];
    expect(replaceVariables('<<host>>', collVars, envVars)).toBe('prod.api.com');
  });

  it('empty collection variable does not shadow a non-empty environment variable', () => {
    const collVars = [makeVar('tenant_id', '')];
    const envVars = [makeVar('tenant_id', 'my-tenant')];
    expect(replaceVariables('<<tenant_id>>.example.com', collVars, envVars)).toBe('my-tenant.example.com');
  });

  it('empty collection variable does not shadow env var set via currentValue', () => {
    const collVars = [makeVar('region', '', { initialValue: '', currentValue: '' })];
    const envVars = [makeVar('region', 'eu1', { currentValue: 'eu1' })];
    expect(replaceVariables('https://host.<<region>>.sws.siemens.com', collVars, envVars)).toBe('https://host.eu1.sws.siemens.com');
  });

  it('non-empty collection variable still overrides env variable', () => {
    const collVars = [makeVar('host', 'coll.api.com')];
    const envVars = [makeVar('host', 'env.api.com')];
    expect(replaceVariables('<<host>>', collVars, envVars)).toBe('coll.api.com');
  });

  // currentValue / value / initialValue priority
  it('prefers currentValue over value', () => {
    const vars = [makeVar('key', 'base', { currentValue: 'current' })];
    expect(replaceVariables('<<key>>', vars, [])).toBe('current');
  });

  it('prefers value when currentValue is empty', () => {
    const vars = [makeVar('key', 'base', { currentValue: '' })];
    expect(replaceVariables('<<key>>', vars, [])).toBe('base');
  });

  it('falls back to initialValue when value is empty', () => {
    const vars = [makeVar('key', '', { initialValue: 'initial' })];
    expect(replaceVariables('<<key>>', vars, [])).toBe('initial');
  });

  it('falls back to an empty string when no variable value is available', () => {
    const vars = [makeVar('key', '', { currentValue: undefined, initialValue: undefined })];
    expect(replaceVariables('before-<<key>>-after', vars, [])).toBe('before--after');
  });

  // Environment variables
  it('substitutes environment variables', () => {
    const envVars = [makeVar('env_url', 'https://staging.api')];
    expect(replaceVariables('<<env_url>>/users', [], envVars)).toBe('https://staging.api/users');
  });

  it('ignores disabled environment variables', () => {
    const envVars = [makeVar('env_url', 'value', { enabled: false })];
    expect(replaceVariables('<<env_url>>', [], envVars)).toBe('<<env_url>>');
  });
});

// ─── resolveRequestVariables ─────────────────────────────────────────────────

describe('resolveRequestVariables', () => {
  it('resolves variables in the URL', () => {
    const req = makeRequest({ url: 'https://<<host>>/api' });
    const vars = [makeVar('host', 'example.com')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.url).toBe('https://example.com/api');
  });

  it('resolves variables in headers', () => {
    const req = makeRequest({
      headers: [makeVar('Authorization', 'Bearer <<token>>')],
    });
    const vars = [makeVar('token', 'abc123')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.headers[0].value).toBe('Bearer abc123');
  });

  it('resolves variables in query params', () => {
    const req = makeRequest({
      params: [makeVar('page', '<<pageNum>>')],
    });
    const vars = [makeVar('pageNum', '5')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.params[0].value).toBe('5');
  });

  it('resolves variables in JSON body', () => {
    const req = makeRequest({
      body: { type: 'json', raw: '{"token": "<<token>>"}' },
    });
    const vars = [makeVar('token', 'secret')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.body.raw).toBe('{"token": "secret"}');
  });

  it('resolves variables in form-data body', () => {
    const req = makeRequest({
      body: {
        type: 'form-data',
        formData: [makeVar('field', '<<val>>')],
      },
    });
    const vars = [makeVar('val', 'resolved')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.body.formData![0].value).toBe('resolved');
  });

  it('resolves variables in urlencoded body', () => {
    const req = makeRequest({
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [makeVar('grant_type', '<<grant>>')],
      },
    });
    const vars = [makeVar('grant', 'client_credentials')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.body.urlencoded![0].value).toBe('client_credentials');
  });

  it('resolves variables in bearer auth', () => {
    const req = makeRequest({
      auth: { type: 'bearer', bearer: { token: '<<token>>' } },
    });
    const vars = [makeVar('token', 'my-bearer-token')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.auth.bearer!.token).toBe('my-bearer-token');
  });

  it('resolves variables in basic auth', () => {
    const req = makeRequest({
      auth: {
        type: 'basic',
        basic: { username: '<<user>>', password: '<<pass>>' },
      },
    });
    const vars = [makeVar('user', 'admin'), makeVar('pass', 'secret')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.auth.basic!.username).toBe('admin');
    expect(resolved.auth.basic!.password).toBe('secret');
  });

  it('resolves variables in API key auth', () => {
    const req = makeRequest({
      auth: {
        type: 'api-key',
        apiKey: { key: '<<keyName>>', value: '<<keyVal>>', addTo: 'header' },
      },
    });
    const vars = [makeVar('keyName', 'X-API-Key'), makeVar('keyVal', 'abc')];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.auth.apiKey!.key).toBe('X-API-Key');
    expect(resolved.auth.apiKey!.value).toBe('abc');
  });

  // Secret variable protection
  it('does NOT resolve secret variables (keeps placeholders)', () => {
    const req = makeRequest({ url: 'https://<<host>>/<<secret_key>>' });
    const vars = [
      makeVar('host', 'example.com'),
      makeVar('secret_key', 'supersecret', { isSecret: true }),
    ];
    const resolved = resolveRequestVariables(req, vars, []);
    expect(resolved.url).toBe('https://example.com/<<secret_key>>');
  });

  it('does not mutate the original request', () => {
    const req = makeRequest({ url: '<<host>>' });
    const vars = [makeVar('host', 'example.com')];
    resolveRequestVariables(req, vars, []);
    expect(req.url).toBe('<<host>>');
  });
});
