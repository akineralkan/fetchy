import { describe, expect, it } from 'vitest';

import {
  convertBrunoScript,
  convertHoppscotchScript,
  convertPostmanScript,
} from '../src/utils/scriptConverter';

describe('convertPostmanScript', () => {
  it('returns an empty string for an empty script', () => {
    expect(convertPostmanScript('')).toBe('');
  });

  it('converts Postman variable and response helpers to Fetchy helpers', () => {
    const result = convertPostmanScript([
      'pm.environment.get("token");',
      'pm.environment.set("token", "next");',
      'pm.variables.get("mode");',
      'pm.variables.set("mode", "debug");',
      'pm.globals.get("global");',
      'pm.globals.set("global", "value");',
      'pm.collectionVariables.get("host");',
      'pm.collectionVariables.set("host", "api.fetchy.dev");',
      'pm.response.json();',
      'pm.response.code;',
      'pm.response.status;',
      'pm.response.headers;',
      'pm.response.text();',
    ].join('\n'));

    expect(result).toContain('fetchy.environment.get("token")');
    expect(result).toContain('fetchy.environment.set("token", "next")');
    expect(result).toContain('fetchy.environment.get("mode")');
    expect(result).toContain('fetchy.environment.set("mode", "debug")');
    expect(result).toContain('fetchy.environment.get("global")');
    expect(result).toContain('fetchy.environment.set("global", "value")');
    expect(result).toContain('fetchy.environment.get("host")');
    expect(result).toContain('fetchy.environment.set("host", "api.fetchy.dev")');
    expect(result).toContain('fetchy.response.data');
    expect(result).toContain('fetchy.response.status');
    expect(result).toContain('fetchy.response.statusText');
    expect(result).toContain('fetchy.response.headers');
    expect(result).toContain('JSON.stringify(fetchy.response.data)');
  });

  it('rewrites Postman tests into comments and IIFEs', () => {
    const result = convertPostmanScript(
      'pm.test("stores token", function() {\n  pm.expect(pm.response.code).to.eql(200);\n})'
    );

    expect(result).toContain('// Postman test: "stores token"');
    expect(result).toContain('(function() {');
    expect(result).toContain('// pm.expect (not supported in Fetchy)');
    expect(result.trim().endsWith('})();')).toBe(true);
  });
});

describe('convertHoppscotchScript', () => {
  it('returns an empty string for an empty script', () => {
    expect(convertHoppscotchScript('')).toBe('');
  });

  it('converts Hoppscotch environment, response, and test helpers', () => {
    const result = convertHoppscotchScript(
      [
        'pw.test("status check", function() {',
        '  pw.env.get("token");',
        '  pw.env.set("next", "1");',
        '  pw.expect(pw.response.status).to.equal(200);',
        '  return [pw.response.body, pw.response.headers];',
        '})',
      ].join('\n')
    );

    expect(result).toContain('// Hoppscotch test: "status check"');
    expect(result).toContain('(function() {');
    expect(result).toContain('fetchy.environment.get("token")');
    expect(result).toContain('fetchy.environment.set("next", "1")');
    expect(result).toContain('// pw.expect (not supported in Fetchy)');
    expect(result).toContain('fetchy.response.status');
    expect(result).toContain('fetchy.response.data');
    expect(result).toContain('fetchy.response.headers');
  });
});

describe('convertBrunoScript', () => {
  it('returns an empty string for an empty script', () => {
    expect(convertBrunoScript('')).toBe('');
  });

  it('converts Bruno environment, response, and unsupported request helpers', () => {
    const result = convertBrunoScript([
      'bru.getEnvVar("token");',
      'bru.setEnvVar("token", "next");',
      'bru.getVar("mode");',
      'bru.setVar("mode", "debug");',
      'bru.getProcessEnv("PATH");',
      'bru.setGlobalEnvVar("global", "1");',
      'bru.getGlobalEnvVar("global");',
      'res.getBody();',
      'res.getStatus();',
      'res.getHeaders();',
      'res.getHeader("content-type");',
      'res.body;',
      'res.status;',
      'res.headers;',
      'res.statusText;',
      'req.getUrl();',
      'req.getMethod();',
      'req.getHeader("Authorization");',
    ].join('\n'));

    expect(result).toContain('fetchy.environment.get("token")');
    expect(result).toContain('fetchy.environment.set("token", "next")');
    expect(result).toContain('fetchy.environment.get("mode")');
    expect(result).toContain('fetchy.environment.set("mode", "debug")');
    expect(result).toContain('fetchy.environment.set("global", "1")');
    expect(result).toContain('fetchy.environment.get("global")');
    expect(result).toContain('bru.getProcessEnv not supported in Fetchy');
    expect(result).toContain('fetchy.response.data');
    expect(result).toContain('fetchy.response.status');
    expect(result).toContain('fetchy.response.headers');
    expect(result).toContain('fetchy.response.headers["content-type"]');
    expect(result).toContain('fetchy.response.statusText');
    expect(result).toContain('/* req.getUrl()');
    expect(result).toContain('/* req.getMethod()');
    expect(result).toContain('/* req.getHeader()');
  });
});