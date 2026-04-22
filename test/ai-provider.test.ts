/**
 * Tests for src/utils/aiProvider.ts
 *
 * Covers:
 *  - defaultAISettings shape and values
 *  - PROVIDER_META entries for all providers
 *  - buildGenerateRequestPrompt
 *  - buildGenerateScriptPrompt (pre-request and test)
 *  - buildExplainResponsePrompt
 *  - buildGenerateDocsPrompt
 *  - buildSuggestNamePrompt
 *  - buildGenerateBugReportPrompt
 */

import { describe, expect, it } from 'vitest';
import {
  defaultAISettings,
  PROVIDER_META,
  buildGenerateRequestPrompt,
  buildGenerateScriptPrompt,
  buildExplainResponsePrompt,
  buildGenerateDocsPrompt,
  buildSuggestNamePrompt,
  buildGenerateBugReportPrompt,
} from '../src/utils/aiProvider';
import type { ApiRequest, ApiResponse } from '../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(overrides?: Partial<ApiRequest>): ApiRequest {
  return {
    id: 'req-1',
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/data',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    preScript: '',
    script: '',
    ...overrides,
  };
}

function makeResponse(overrides?: Partial<ApiResponse>): ApiResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"result":"ok"}',
    time: 120,
    size: 256,
    ...overrides,
  };
}

// ─── defaultAISettings ────────────────────────────────────────────────────────

describe('defaultAISettings', () => {
  it('has ollama as default provider', () => {
    expect(defaultAISettings.provider).toBe('ollama');
  });

  it('has llama3.1 as default model', () => {
    expect(defaultAISettings.model).toBe('llama3.1');
  });

  it('has local base URL for ollama', () => {
    expect(defaultAISettings.baseUrl).toBe('http://localhost:11434');
  });

  it('has enabled set to true', () => {
    expect(defaultAISettings.enabled).toBe(true);
  });

  it('has persistToFile set to false', () => {
    expect(defaultAISettings.persistToFile).toBe(false);
  });
});

// ─── PROVIDER_META ────────────────────────────────────────────────────────────

describe('PROVIDER_META', () => {
  it('has entries for gemini, ollama, and siemens', () => {
    expect(PROVIDER_META).toHaveProperty('gemini');
    expect(PROVIDER_META).toHaveProperty('ollama');
    expect(PROVIDER_META).toHaveProperty('siemens');
  });

  it('gemini requires an API key', () => {
    expect(PROVIDER_META.gemini.requiresApiKey).toBe(true);
  });

  it('ollama does not require an API key', () => {
    expect(PROVIDER_META.ollama.requiresApiKey).toBe(false);
  });

  it('ollama requires a base URL', () => {
    expect(PROVIDER_META.ollama.requiresBaseUrl).toBe(true);
  });

  it('gemini does not require a base URL', () => {
    expect(PROVIDER_META.gemini.requiresBaseUrl).toBe(false);
  });

  it('siemens has multiple models', () => {
    expect(PROVIDER_META.siemens.models.length).toBeGreaterThan(1);
  });

  it('each provider has a label and description', () => {
    for (const meta of Object.values(PROVIDER_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
  });

  it('each provider has a defaultModel', () => {
    for (const meta of Object.values(PROVIDER_META)) {
      expect(meta.defaultModel).toBeTruthy();
      expect(meta.models).toContain(meta.defaultModel);
    }
  });
});

// ─── buildGenerateRequestPrompt ───────────────────────────────────────────────

describe('buildGenerateRequestPrompt', () => {
  it('returns an array with 2 messages', () => {
    const msgs = buildGenerateRequestPrompt('get all users');
    expect(msgs).toHaveLength(2);
  });

  it('first message has role system', () => {
    const msgs = buildGenerateRequestPrompt('anything');
    expect(msgs[0].role).toBe('system');
  });

  it('second message has role user', () => {
    const msgs = buildGenerateRequestPrompt('describe something');
    expect(msgs[1].role).toBe('user');
  });

  it('user message contains the description', () => {
    const desc = 'get user by ID 42';
    const msgs = buildGenerateRequestPrompt(desc);
    expect(msgs[1].content).toContain(desc);
  });

  it('system message instructs to return only JSON', () => {
    const msgs = buildGenerateRequestPrompt('test');
    expect(msgs[0].content).toContain('JSON');
  });
});

// ─── buildGenerateScriptPrompt ────────────────────────────────────────────────

describe('buildGenerateScriptPrompt', () => {
  it('returns 2 messages for pre-request script', () => {
    const msgs = buildGenerateScriptPrompt(makeRequest(), undefined, 'pre-request');
    expect(msgs).toHaveLength(2);
  });

  it('returns 2 messages for test script', () => {
    const msgs = buildGenerateScriptPrompt(makeRequest(), makeResponse(), 'test');
    expect(msgs).toHaveLength(2);
  });

  it('system message references pre-request API when type is pre-request', () => {
    const msgs = buildGenerateScriptPrompt(makeRequest(), undefined, 'pre-request');
    expect(msgs[0].content).toContain('pre-request');
  });

  it('system message references post-request API when type is test', () => {
    const msgs = buildGenerateScriptPrompt(makeRequest(), makeResponse(), 'test');
    expect(msgs[0].content).toContain('fetchy.response');
  });

  it('user message includes request method and URL', () => {
    const req = makeRequest({ method: 'POST', url: 'https://api.test.com/data' });
    const msgs = buildGenerateScriptPrompt(req, undefined, 'pre-request');
    expect(msgs[1].content).toContain('POST');
    expect(msgs[1].content).toContain('https://api.test.com/data');
  });

  it('user message includes response info when response is provided', () => {
    const msgs = buildGenerateScriptPrompt(makeRequest(), makeResponse(), 'test');
    expect(msgs[1].content).toContain('200');
  });
});

// ─── buildExplainResponsePrompt ───────────────────────────────────────────────

describe('buildExplainResponsePrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildExplainResponsePrompt(makeRequest(), makeResponse());
    expect(msgs).toHaveLength(2);
  });

  it('user message contains status code', () => {
    const msgs = buildExplainResponsePrompt(makeRequest(), makeResponse({ status: 404, statusText: 'Not Found' }));
    expect(msgs[1].content).toContain('404');
  });

  it('user message contains request method', () => {
    const msgs = buildExplainResponsePrompt(makeRequest({ method: 'DELETE' }), makeResponse());
    expect(msgs[1].content).toContain('DELETE');
  });

  it('system message asks for explanation in markdown', () => {
    const msgs = buildExplainResponsePrompt(makeRequest(), makeResponse());
    expect(msgs[0].content).toContain('markdown');
  });
});

// ─── buildGenerateDocsPrompt ──────────────────────────────────────────────────

describe('buildGenerateDocsPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildGenerateDocsPrompt(makeRequest());
    expect(msgs).toHaveLength(2);
  });

  it('works without a response', () => {
    expect(() => buildGenerateDocsPrompt(makeRequest())).not.toThrow();
  });

  it('works with a response', () => {
    expect(() => buildGenerateDocsPrompt(makeRequest(), makeResponse())).not.toThrow();
  });

  it('system message mentions documentation', () => {
    const msgs = buildGenerateDocsPrompt(makeRequest());
    expect(msgs[0].content.toLowerCase()).toContain('documentation');
  });

  it('user message contains request URL', () => {
    const msgs = buildGenerateDocsPrompt(makeRequest({ url: 'https://unique.url/path' }));
    expect(msgs[1].content).toContain('https://unique.url/path');
  });
});

// ─── buildSuggestNamePrompt ───────────────────────────────────────────────────

describe('buildSuggestNamePrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildSuggestNamePrompt(makeRequest());
    expect(msgs).toHaveLength(2);
  });

  it('user message includes the method and URL', () => {
    const req = makeRequest({ method: 'GET', url: 'https://api.example.com/products' });
    const msgs = buildSuggestNamePrompt(req);
    expect(msgs[1].content).toContain('GET');
    expect(msgs[1].content).toContain('https://api.example.com/products');
  });

  it('system message instructs to return only the name', () => {
    const msgs = buildSuggestNamePrompt(makeRequest());
    expect(msgs[0].content).toContain('name');
  });

  it('includes body type when body is not none', () => {
    const req = makeRequest({ body: { type: 'json', raw: '{}' } });
    const msgs = buildSuggestNamePrompt(req);
    expect(msgs[1].content).toContain('json');
  });
});

// ─── buildGenerateBugReportPrompt ─────────────────────────────────────────────

describe('buildGenerateBugReportPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildGenerateBugReportPrompt(makeRequest(), makeResponse(), 'It returns 500');
    expect(msgs).toHaveLength(2);
  });

  it('system message contains the bug report template', () => {
    const msgs = buildGenerateBugReportPrompt(makeRequest(), makeResponse(), 'note');
    expect(msgs[0].content).toContain('Bug Report');
  });

  it('user message contains the user note', () => {
    const msgs = buildGenerateBugReportPrompt(makeRequest(), makeResponse(), 'This is broken!');
    expect(msgs[1].content).toContain('This is broken!');
  });

  it('user message includes request method', () => {
    const req = makeRequest({ method: 'DELETE' });
    const msgs = buildGenerateBugReportPrompt(req, makeResponse(), 'bug');
    expect(msgs[1].content).toContain('DELETE');
  });

  it('user message includes response status', () => {
    const msgs = buildGenerateBugReportPrompt(makeRequest(), makeResponse({ status: 500, statusText: 'Server Error' }), 'bug');
    expect(msgs[1].content).toContain('500');
  });

  it('truncates very long response body', () => {
    const longBody = 'x'.repeat(10000);
    const res = makeResponse({ body: longBody });
    // Should not throw and should produce output
    expect(() => buildGenerateBugReportPrompt(makeRequest(), res, 'big response')).not.toThrow();
    const msgs = buildGenerateBugReportPrompt(makeRequest(), res, 'big response');
    // Body should be truncated in the user message
    expect(msgs[1].content).toContain('truncated');
  });
});
