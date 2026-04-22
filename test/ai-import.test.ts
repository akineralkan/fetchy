/**
 * Tests for src/utils/aiImport.ts
 *
 * Covers:
 *  - Prompt builders: buildCollectionConversionPrompt, buildEnvironmentConversionPrompt, buildRequestConversionPrompt
 *  - aiConvertCollection: success, AI failure, invalid JSON
 *  - aiConvertEnvironment: success, AI failure, invalid JSON
 *  - aiConvertRequest: success, AI failure, invalid JSON
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildCollectionConversionPrompt,
  buildEnvironmentConversionPrompt,
  buildRequestConversionPrompt,
  aiConvertCollection,
  aiConvertEnvironment,
  aiConvertRequest,
} from '../src/utils/aiImport';
import type { AISettings } from '../src/types';

// ─── Mock sendAIRequest ───────────────────────────────────────────────────────

vi.mock('../src/utils/aiProvider', () => ({
  sendAIRequest: vi.fn(),
}));

import { sendAIRequest } from '../src/utils/aiProvider';

const mockSend = sendAIRequest as ReturnType<typeof vi.fn>;

const fakeSettings: AISettings = {
  enabled: true,
  provider: 'ollama',
  apiKey: '',
  model: 'llama3.1',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 2048,
  persistToFile: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── buildCollectionConversionPrompt ─────────────────────────────────────────

describe('buildCollectionConversionPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildCollectionConversionPrompt('{"name":"test"}');
    expect(msgs).toHaveLength(2);
  });

  it('first message is system role', () => {
    const msgs = buildCollectionConversionPrompt('data');
    expect(msgs[0].role).toBe('system');
  });

  it('user message contains the input content', () => {
    const input = 'collection content here';
    const msgs = buildCollectionConversionPrompt(input);
    expect(msgs[1].content).toContain(input);
  });

  it('system message describes Collection target schema', () => {
    const msgs = buildCollectionConversionPrompt('data');
    expect(msgs[0].content).toContain('Collection');
  });

  it('system message includes safety rules', () => {
    const msgs = buildCollectionConversionPrompt('data');
    expect(msgs[0].content).toContain('CRITICAL RULES');
  });
});

// ─── buildEnvironmentConversionPrompt ────────────────────────────────────────

describe('buildEnvironmentConversionPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildEnvironmentConversionPrompt('env data');
    expect(msgs).toHaveLength(2);
  });

  it('user message contains the input content', () => {
    const input = 'BASE_URL=https://api.example.com';
    const msgs = buildEnvironmentConversionPrompt(input);
    expect(msgs[1].content).toContain(input);
  });

  it('system message mentions Environment schema', () => {
    const msgs = buildEnvironmentConversionPrompt('data');
    expect(msgs[0].content).toContain('Environment');
  });
});

// ─── buildRequestConversionPrompt ────────────────────────────────────────────

describe('buildRequestConversionPrompt', () => {
  it('returns 2 messages', () => {
    const msgs = buildRequestConversionPrompt("curl -X GET 'https://example.com'");
    expect(msgs).toHaveLength(2);
  });

  it('user message contains the cURL input', () => {
    const curlInput = "curl -X POST 'https://api.test.com/data'";
    const msgs = buildRequestConversionPrompt(curlInput);
    expect(msgs[1].content).toContain(curlInput);
  });

  it('system message mentions Request schema', () => {
    const msgs = buildRequestConversionPrompt('data');
    expect(msgs[0].content).toContain('Request');
  });
});

// ─── aiConvertCollection ──────────────────────────────────────────────────────

describe('aiConvertCollection', () => {
  it('returns a collection on success', async () => {
    const aiJson = JSON.stringify({
      name: 'My Collection',
      folders: [],
      requests: [],
      variables: [],
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertCollection(fakeSettings, 'some content');
    expect(result.error).toBeNull();
    expect(result.collection).not.toBeNull();
    expect(result.collection!.name).toBe('My Collection');
  });

  it('injects UUIDs into the returned collection', async () => {
    const aiJson = JSON.stringify({
      name: 'Test',
      folders: [],
      requests: [{ name: 'Get', method: 'GET', url: 'https://x.com', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } }],
      variables: [],
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertCollection(fakeSettings, 'data');
    expect(result.collection!.id).toBeTruthy();
    expect(result.collection!.requests[0].id).toBeTruthy();
  });

  it('returns error when AI call fails', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'Network error' });

    const result = await aiConvertCollection(fakeSettings, 'data');
    expect(result.collection).toBeNull();
    expect(result.error).toContain('Network error');
  });

  it('returns error when AI returns invalid JSON', async () => {
    mockSend.mockResolvedValueOnce({ success: true, content: 'not json at all' });

    const result = await aiConvertCollection(fakeSettings, 'data');
    expect(result.collection).toBeNull();
    expect(result.error).toContain('invalid JSON');
  });

  it('handles AI response wrapped in markdown fences', async () => {
    const inner = JSON.stringify({ name: 'Fence Collection', folders: [], requests: [], variables: [] });
    mockSend.mockResolvedValueOnce({ success: true, content: '```json\n' + inner + '\n```' });

    const result = await aiConvertCollection(fakeSettings, 'data');
    expect(result.error).toBeNull();
    expect(result.collection!.name).toBe('Fence Collection');
  });
});

// ─── aiConvertEnvironment ─────────────────────────────────────────────────────

describe('aiConvertEnvironment', () => {
  it('returns an environment on success', async () => {
    const aiJson = JSON.stringify({
      name: 'Dev Env',
      variables: [{ key: 'BASE_URL', value: 'https://dev.api.com', enabled: true }],
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertEnvironment(fakeSettings, 'env data');
    expect(result.error).toBeNull();
    expect(result.environment!.name).toBe('Dev Env');
    expect(result.environment!.variables).toHaveLength(1);
    expect(result.environment!.variables[0].key).toBe('BASE_URL');
  });

  it('injects IDs into variables', async () => {
    const aiJson = JSON.stringify({
      name: 'Test Env',
      variables: [{ key: 'X', value: 'y', enabled: true }],
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertEnvironment(fakeSettings, 'data');
    expect(result.environment!.id).toBeTruthy();
    expect(result.environment!.variables[0].id).toBeTruthy();
  });

  it('returns error when AI call fails', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'AI offline' });

    const result = await aiConvertEnvironment(fakeSettings, 'data');
    expect(result.environment).toBeNull();
    expect(result.error).toContain('AI offline');
  });

  it('returns error when AI returns invalid JSON', async () => {
    mockSend.mockResolvedValueOnce({ success: true, content: '<<invalid>>' });

    const result = await aiConvertEnvironment(fakeSettings, 'data');
    expect(result.environment).toBeNull();
    expect(result.error).toContain('invalid JSON');
  });
});

// ─── aiConvertRequest ─────────────────────────────────────────────────────────

describe('aiConvertRequest', () => {
  it('returns a request on success', async () => {
    const aiJson = JSON.stringify({
      name: 'Get Users',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [],
      params: [],
      body: { type: 'none' },
      auth: { type: 'none' },
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertRequest(fakeSettings, 'curl data');
    expect(result.error).toBeNull();
    expect(result.request!.name).toBe('Get Users');
    expect(result.request!.method).toBe('GET');
  });

  it('returns error when AI call fails', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'timeout' });

    const result = await aiConvertRequest(fakeSettings, 'data');
    expect(result.request).toBeNull();
    expect(result.error).toContain('timeout');
  });

  it('returns error when AI returns invalid JSON', async () => {
    mockSend.mockResolvedValueOnce({ success: true, content: 'plain text' });

    const result = await aiConvertRequest(fakeSettings, 'data');
    expect(result.request).toBeNull();
    expect(result.error).toContain('invalid JSON');
  });

  it('injects ID into the returned request', async () => {
    const aiJson = JSON.stringify({
      name: 'Post Data',
      method: 'POST',
      url: 'https://api.example.com/data',
      headers: [],
      params: [],
      body: { type: 'json', raw: '{}' },
      auth: { type: 'none' },
    });
    mockSend.mockResolvedValueOnce({ success: true, content: aiJson });

    const result = await aiConvertRequest(fakeSettings, 'data');
    expect(result.request!.id).toBeTruthy();
  });
});
