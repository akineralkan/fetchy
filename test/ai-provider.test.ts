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

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAISettings,
  PROVIDER_META,
  buildGenerateRequestPrompt,
  buildGenerateScriptPrompt,
  buildExplainResponsePrompt,
  buildGenerateDocsPrompt,
  buildSuggestNamePrompt,
  buildGenerateBugReportPrompt,
  buildCustomChatPrompt,
  buildConvertToFetchySyntaxPrompt,
  buildScriptChatPrompt,
  sendAIRequest,
} from '../src/utils/aiProvider';
import type { AISettings, ApiRequest, ApiResponse } from '../src/types';

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

  it('includes form-data body when present', () => {
    const req = makeRequest({
      body: {
        type: 'form-data',
        formData: [
          { id: '1', key: 'file', value: 'test.txt', enabled: true },
          { id: '2', key: 'disabled', value: 'skip', enabled: false },
        ],
      },
    });
    const msgs = buildGenerateBugReportPrompt(req, makeResponse(), 'note');
    expect(msgs[1].content).toContain('form-data');
    expect(msgs[1].content).toContain('file');
  });

  it('includes urlencoded body when present', () => {
    const req = makeRequest({
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [
          { id: '1', key: 'username', value: 'john', enabled: true },
          { id: '2', key: 'pass', value: 'secret', enabled: true },
        ],
      },
    });
    const msgs = buildGenerateBugReportPrompt(req, makeResponse(), 'note');
    expect(msgs[1].content).toContain('x-www-form-urlencoded');
    expect(msgs[1].content).toContain('username');
  });

  it('includes enabled headers and params', () => {
    const req = makeRequest({
      headers: [
        { id: '1', key: 'Authorization', value: 'Bearer token', enabled: true },
        { id: '2', key: 'X-Skip', value: 'skip', enabled: false },
      ],
      params: [
        { id: '1', key: 'page', value: '1', enabled: true },
      ],
    });
    const msgs = buildGenerateBugReportPrompt(req, makeResponse(), 'note');
    expect(msgs[1].content).toContain('Authorization');
    expect(msgs[1].content).toContain('page=1');
  });
});

// ─── buildCustomChatPrompt ────────────────────────────────────────────────────

describe('buildCustomChatPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildCustomChatPrompt(makeRequest(), makeResponse(), 'What does this do?');
    expect(msgs).toHaveLength(2);
  });

  it('first message is system role', () => {
    const msgs = buildCustomChatPrompt(makeRequest(), makeResponse(), 'question');
    expect(msgs[0].role).toBe('system');
  });

  it('second message is user role with the custom message', () => {
    const msgs = buildCustomChatPrompt(makeRequest(), makeResponse(), 'Explain the error');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('Explain the error');
  });

  it('system message includes request and response details', () => {
    const req = makeRequest({ method: 'POST', url: 'https://api.test.com/items' });
    const res = makeResponse({ status: 201, statusText: 'Created' });
    const msgs = buildCustomChatPrompt(req, res, 'explain');
    expect(msgs[0].content).toContain('POST');
    expect(msgs[0].content).toContain('https://api.test.com/items');
    expect(msgs[0].content).toContain('201');
  });

  it('includes enabled headers and params in context', () => {
    const req = makeRequest({
      headers: [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }],
      params: [{ id: '1', key: 'limit', value: '10', enabled: true }],
    });
    const msgs = buildCustomChatPrompt(req, makeResponse(), 'help');
    expect(msgs[0].content).toContain('Accept');
    expect(msgs[0].content).toContain('limit=10');
  });

  it('includes form-data body in context', () => {
    const req = makeRequest({
      body: {
        type: 'form-data',
        formData: [{ id: '1', key: 'field', value: 'val', enabled: true }],
      },
    });
    const msgs = buildCustomChatPrompt(req, makeResponse(), 'q');
    expect(msgs[0].content).toContain('form-data');
    expect(msgs[0].content).toContain('field');
  });

  it('includes urlencoded body in context', () => {
    const req = makeRequest({
      body: {
        type: 'x-www-form-urlencoded',
        urlencoded: [{ id: '1', key: 'a', value: 'b', enabled: true }],
      },
    });
    const msgs = buildCustomChatPrompt(req, makeResponse(), 'q');
    expect(msgs[0].content).toContain('x-www-form-urlencoded');
  });

  it('truncates very long response body in context', () => {
    const res = makeResponse({ body: 'x'.repeat(10000) });
    const msgs = buildCustomChatPrompt(makeRequest(), res, 'q');
    expect(msgs[0].content).toContain('truncated');
  });

  it('shows raw body when present', () => {
    const req = makeRequest({ body: { type: 'json', raw: '{"key":"value"}' } });
    const msgs = buildCustomChatPrompt(req, makeResponse(), 'q');
    expect(msgs[0].content).toContain('{"key":"value"}');
  });
});

// ─── buildConvertToFetchySyntaxPrompt ─────────────────────────────────────────

describe('buildConvertToFetchySyntaxPrompt', () => {
  it('returns 2 messages for pre script', () => {
    const msgs = buildConvertToFetchySyntaxPrompt('console.log("hi")', 'pre');
    expect(msgs).toHaveLength(2);
  });

  it('returns 2 messages for post script', () => {
    const msgs = buildConvertToFetchySyntaxPrompt('console.log("hi")', 'post');
    expect(msgs).toHaveLength(2);
  });

  it('system message contains Fetchy API reference', () => {
    const msgs = buildConvertToFetchySyntaxPrompt('code', 'pre');
    expect(msgs[0].content).toContain('fetchy.environment.set');
    expect(msgs[0].content).toContain('fetchy.environment.get');
  });

  it('system message includes fetchy.response for post scripts', () => {
    const msgs = buildConvertToFetchySyntaxPrompt('code', 'post');
    expect(msgs[0].content).toContain('fetchy.response.status');
    expect(msgs[0].content).toContain('fetchy.response.data');
  });

  it('user message includes the script code', () => {
    const code = 'pm.environment.set("token", pm.response.json().token)';
    const msgs = buildConvertToFetchySyntaxPrompt(code, 'post');
    expect(msgs[1].content).toContain(code);
  });

  it('handles empty script gracefully', () => {
    const msgs = buildConvertToFetchySyntaxPrompt('', 'pre');
    expect(msgs[1].content).toContain('empty script');
  });
});

// ─── buildScriptChatPrompt ────────────────────────────────────────────────────

describe('buildScriptChatPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildScriptChatPrompt('const x = 1;', 'pre', 'How do I set env vars?');
    expect(msgs).toHaveLength(2);
  });

  it('system message identifies the script type for pre', () => {
    const msgs = buildScriptChatPrompt('code', 'pre', 'question');
    expect(msgs[0].content).toContain('pre-request');
  });

  it('system message identifies the script type for post', () => {
    const msgs = buildScriptChatPrompt('code', 'post', 'question');
    expect(msgs[0].content).toContain('post-request');
  });

  it('system message includes the current script code', () => {
    const code = 'fetchy.environment.set("x", "y")';
    const msgs = buildScriptChatPrompt(code, 'pre', 'help');
    expect(msgs[0].content).toContain(code);
  });

  it('system message includes fetchy.response API for post scripts', () => {
    const msgs = buildScriptChatPrompt('code', 'post', 'help');
    expect(msgs[0].content).toContain('fetchy.response.data');
  });

  it('user message is the user question', () => {
    const msgs = buildScriptChatPrompt('code', 'pre', 'How do I log output?');
    expect(msgs[1].content).toBe('How do I log output?');
  });

  it('handles empty script', () => {
    const msgs = buildScriptChatPrompt('', 'pre', 'help');
    expect(msgs[0].content).toContain('empty script');
  });
});

// ─── sendAIRequest ────────────────────────────────────────────────────────────

describe('sendAIRequest', () => {
  afterEach(() => {
    // Clean up any electronAPI mock
    delete (globalThis as any).window;
  });

  const baseSettings: AISettings = {
    ...defaultAISettings,
    enabled: true,
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-2.5-flash',
  };

  const testMessages = [{ role: 'user' as const, content: 'hello' }];

  it('returns error when AI is not enabled', async () => {
    const result = await sendAIRequest({ ...baseSettings, enabled: false }, testMessages);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not enabled');
  });

  it('returns error when API key is missing for provider that requires it', async () => {
    const result = await sendAIRequest({ ...baseSettings, apiKey: '' }, testMessages);
    expect(result.success).toBe(false);
    expect(result.error).toContain('API key is required');
  });

  it('returns error for browser mode (no electronAPI)', async () => {
    const result = await sendAIRequest(baseSettings, testMessages);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Electron desktop app');
  });

  it('calls electronAPI.aiRequest when in Electron', async () => {
    const mockResult = { success: true, content: 'AI response', error: '' };
    (globalThis as any).window = {
      electronAPI: { aiRequest: vi.fn().mockResolvedValue(mockResult) },
    };

    const result = await sendAIRequest(baseSettings, testMessages);
    expect(result).toEqual(mockResult);
    expect((globalThis as any).window.electronAPI.aiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      }),
    );
  });

  it('does not require API key for ollama', async () => {
    const ollamaSettings: AISettings = {
      ...defaultAISettings,
      enabled: true,
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'http://localhost:11434',
    };
    // Ollama doesn't require API key, so it should pass validation and hit the browser fallback
    const result = await sendAIRequest(ollamaSettings, testMessages);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Electron desktop app');
  });
});
