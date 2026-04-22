// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  AIGenerateRequestModal,
  AIScriptAssistButton,
  AIResponseToolbar,
} from '../../src/components/AIAssistant';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import {
  buildConvertToFetchySyntaxPrompt,
  buildCustomChatPrompt,
  buildExplainResponsePrompt,
  buildGenerateBugReportPrompt,
  buildGenerateDocsPrompt,
  buildGenerateRequestPrompt,
  buildScriptChatPrompt,
  sendAIRequest,
} from '../../src/utils/aiProvider';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/utils/aiProvider', () => ({
  sendAIRequest: vi.fn(),
  buildGenerateRequestPrompt: vi.fn((prompt: string) => [{ role: 'user', content: `generate:${prompt}` }]),
  buildExplainResponsePrompt: vi.fn((request: unknown, response: unknown) => [{ role: 'user', content: JSON.stringify({ request, response }) }]),
  buildCustomChatPrompt: vi.fn((request: unknown, response: unknown, message: string) => [{ role: 'user', content: JSON.stringify({ request, response, message }) }]),
  buildConvertToFetchySyntaxPrompt: vi.fn((script: string, scriptType: string) => [{ role: 'user', content: `convert:${scriptType}:${script}` }]),
  buildScriptChatPrompt: vi.fn((script: string, scriptType: string, message: string) => [{ role: 'user', content: `chat:${scriptType}:${message}:${script}` }]),
  buildGenerateDocsPrompt: vi.fn((request: unknown, response: unknown) => [{ role: 'user', content: JSON.stringify({ request, response, mode: 'docs' }) }]),
  buildGenerateBugReportPrompt: vi.fn((request: unknown, response: unknown, note: string) => [{ role: 'user', content: JSON.stringify({ request, response, note }) }]),
  PROVIDER_META: {
    gemini: { label: 'Gemini' },
    ollama: { label: 'Ollama' },
    siemens: { label: 'Siemens' },
  },
}));

vi.mock('../../src/components/CodeEditor', () => ({
  default: ({ value, onChange, language = 'text', readOnly = false }: { value: string; onChange: (value: string) => void; language?: string; readOnly?: boolean }) => (
    <textarea
      data-testid={`ai-code-editor-${language}`}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const request = {
  id: 'req-1',
  name: 'Get Users',
  method: 'GET',
  url: 'https://api.example.com/users',
  headers: [],
  params: [],
  body: { type: 'none' },
  auth: { type: 'none' },
} as const;

const response = {
  status: 500,
  statusText: 'Server Error',
  headers: { 'content-type': 'application/json' },
  body: '{"error":"boom"}',
  time: 42,
  size: 128,
} as const;

const onSettingsOpen = vi.fn();

function mockPreferences(options?: {
  ai?: Partial<{ enabled: boolean; apiKey: string; baseUrl: string; provider: string }>;
  jira?: Partial<{
    enabled: boolean;
    baseUrl: string;
    projectKey: string;
    issueType: string;
    fieldMappings: Array<{
      id: string;
      fieldName: string;
      customFieldId: string;
      fieldType: 'text' | 'option' | 'array' | 'insight' | 'raw';
      defaultValue: string;
    }>;
  }>;
  jiraPat?: string;
}) {
  vi.mocked(usePreferencesStore).mockReturnValue({
    aiSettings: {
      enabled: true,
      apiKey: 'test-api-key',
      baseUrl: '',
      provider: 'gemini',
      ...options?.ai,
    },
    jiraSettings: {
      enabled: false,
      baseUrl: '',
      projectKey: '',
      issueType: 'Bug',
      fieldMappings: [],
      ...options?.jira,
    },
    jiraPat: options?.jiraPat ?? '',
  } as never);
}

beforeEach(() => {
  mockPreferences();
  vi.mocked(sendAIRequest).mockReset();
  vi.mocked(buildGenerateRequestPrompt).mockClear();
  vi.mocked(buildConvertToFetchySyntaxPrompt).mockClear();
  vi.mocked(buildScriptChatPrompt).mockClear();
  vi.mocked(buildExplainResponsePrompt).mockClear();
  vi.mocked(buildGenerateDocsPrompt).mockClear();
  vi.mocked(buildCustomChatPrompt).mockClear();
  vi.mocked(buildGenerateBugReportPrompt).mockClear();

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });

  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    const element = originalCreateElement(tagName);
    if (tagName === 'a') {
      element.click = vi.fn();
    }
    return element;
  }) as typeof document.createElement);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:ai-output'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });

  (window as typeof window & {
    electronAPI?: {
      jiraCreateIssue: ReturnType<typeof vi.fn>;
      openExternalUrl: ReturnType<typeof vi.fn>;
    };
  }).electronAPI = {
    jiraCreateIssue: vi.fn(),
    openExternalUrl: vi.fn(),
  };

  window.addEventListener('open-ai-settings', onSettingsOpen as EventListener);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
  window.removeEventListener('open-ai-settings', onSettingsOpen as EventListener);
  onSettingsOpen.mockReset();
});

describe('AIAssistant', () => {
  it('shows AI setup guidance in the generate modal when AI is disabled', () => {
    const onClose = vi.fn();
    mockPreferences({ ai: { enabled: false, apiKey: '', baseUrl: '' } });

    render(
      <AIGenerateRequestModal
        isOpen
        onClose={onClose}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText(/AI is not configured/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /open ai settings/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('generates a request, strips markdown fences, and applies the parsed payload', async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    vi.mocked(sendAIRequest).mockResolvedValueOnce({
      success: true,
      content: '```json\n{"method":"POST","url":"https://api.example.com/users","headers":[{"key":"X-Test","value":"1"}],"params":[{"key":"draft","value":"true","enabled":false}],"body":{"type":"raw","raw":"{}"},"name":"Create User"}\n```',
    } as never);

    render(
      <AIGenerateRequestModal
        isOpen
        onClose={onClose}
        onApply={onApply}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/GET request to fetch all users/i), {
      target: { value: 'Create a user' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate request/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply to request/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /apply to request/i }));

    expect(buildGenerateRequestPrompt).toHaveBeenCalledWith('Create a user');
    expect(sendAIRequest).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'draft', value: 'true', enabled: false }],
      body: { type: 'raw', raw: '{}' },
      name: 'Create User',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows provider failures and invalid JSON parse failures in the generate modal', async () => {
    vi.mocked(sendAIRequest)
      .mockResolvedValueOnce({ success: false, error: 'Provider unavailable' } as never)
      .mockResolvedValueOnce({ success: true, content: 'not valid json' } as never);

    const { rerender } = render(
      <AIGenerateRequestModal
        isOpen
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/GET request to fetch all users/i), {
      target: { value: 'Broken request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate request/i }));

    expect(await screen.findByText('Provider unavailable')).toBeTruthy();

    rerender(
      <AIGenerateRequestModal
        isOpen
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/GET request to fetch all users/i), {
      target: { value: 'Still broken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate request/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply to request/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /apply to request/i }));

    expect(await screen.findByText('Failed to parse AI response. Try regenerating.')).toBeTruthy();
  });

  it('opens AI settings from script assist when credentials are missing', () => {
    mockPreferences({ ai: { enabled: true, apiKey: '', baseUrl: '' } });

    render(
      <AIScriptAssistButton
        scriptType='pre'
        scriptValue='console.log("hello")'
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));

    expect(onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('converts scripts to Fetchy syntax and applies the cleaned result', async () => {
    const onApply = vi.fn();

    vi.mocked(sendAIRequest).mockResolvedValueOnce({
      success: true,
      content: '```javascript\nfetchy.environment.set("token", "123");\n```',
    } as never);

    render(
      <AIScriptAssistButton
        scriptType='pre'
        scriptValue='pm.environment.set("token", response.token);'
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Convert to Fetchy Syntax'));
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply to script/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /apply to script/i }));

    expect(buildConvertToFetchySyntaxPrompt).toHaveBeenCalledWith(
      'pm.environment.set("token", response.token);',
      'pre',
    );
    expect(onApply).toHaveBeenCalledWith('fetchy.environment.set("token", "123");');
  });

  it('supports markdown chat results with preview, source, copy, and download actions', async () => {
    vi.mocked(sendAIRequest).mockResolvedValueOnce({
      success: true,
      content: '# Heading\n\n*Use the response*',
    } as never);

    render(
      <AIScriptAssistButton
        scriptType='post'
        scriptValue='pm.test("ok")'
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Custom Chat'));
    fireEvent.change(screen.getByPlaceholderText(/How do I extract the token/i), {
      target: { value: 'How do I improve this?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(screen.getByText('Heading')).toBeTruthy();
    });

    expect(buildScriptChatPrompt).toHaveBeenCalledWith(
      'pm.test("ok")',
      'post',
      'How do I improve this?',
    );

    fireEvent.click(screen.getByRole('button', { name: /source/i }));
    expect(screen.getByTestId('ai-code-editor-text')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Heading\n\n*Use the response*');

    fireEvent.click(screen.getByRole('button', { name: /download \.md/i }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('runs explain, docs, and custom-chat response actions through the toolbar', async () => {
    vi.mocked(sendAIRequest)
      .mockResolvedValueOnce({ success: true, content: 'The response means the request succeeded.' } as never)
      .mockResolvedValueOnce({ success: true, content: '# API Docs\n\n- GET /users' } as never)
      .mockResolvedValueOnce({ success: true, content: 'The response is failing because the backend returned 500.' } as never);

    render(<AIResponseToolbar request={request as never} response={response as never} />);

    expect(screen.getByText(/via Gemini/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Explain Response'));
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(await screen.findByText('The response means the request succeeded.')).toBeTruthy();
    expect(buildExplainResponsePrompt).toHaveBeenCalledWith(request, response);
    cleanup();

    mockPreferences();
    render(<AIResponseToolbar request={request as never} response={response as never} />);
    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Generate Docs'));
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(await screen.findByText('API Docs')).toBeTruthy();
    expect(buildGenerateDocsPrompt).toHaveBeenCalledWith(request, response);
    cleanup();

    mockPreferences();
    render(<AIResponseToolbar request={request as never} response={response as never} />);
    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Custom Chat'));
    const customChatInput = screen.getByRole('textbox');
    fireEvent.change(customChatInput, {
      target: { value: 'Why is this failing?' },
    });
    expect((customChatInput as HTMLTextAreaElement).value).toBe('Why is this failing?');
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(await screen.findByText('The response is failing because the backend returned 500.')).toBeTruthy();
    expect(buildCustomChatPrompt).toHaveBeenCalledWith(request, response, 'Why is this failing?');
  });

  it('generates a bug report and creates a Jira issue with mapped custom fields', async () => {
    mockPreferences({
      jiraPat: 'jira-secret',
      jira: {
        enabled: true,
        baseUrl: 'https://jira.example.com',
        projectKey: 'BUG',
        issueType: 'Bug',
        fieldMappings: [
          {
            id: 'map-1',
            fieldName: 'Team',
            customFieldId: 'customfield_10001',
            fieldType: 'option',
            defaultValue: 'Platform',
          },
          {
            id: 'map-2',
            fieldName: 'Labels',
            customFieldId: 'customfield_10002',
            fieldType: 'array',
            defaultValue: 'backend,api',
          },
          {
            id: 'map-3',
            fieldName: 'Insight',
            customFieldId: 'customfield_10003',
            fieldType: 'insight',
            defaultValue: 'INS-1,INS-2',
          },
          {
            id: 'map-4',
            fieldName: 'Payload',
            customFieldId: 'customfield_10004',
            fieldType: 'raw',
            defaultValue: '{"flag":true}',
          },
          {
            id: 'map-5',
            fieldName: 'Notes',
            customFieldId: 'customfield_10005',
            fieldType: 'text',
            defaultValue: 'autogenerated',
          },
        ],
      },
    });

    vi.mocked(sendAIRequest).mockResolvedValueOnce({
      success: true,
      content: '# Bug Report\n\n## Title\n\nLogin fails on 500\n\n1.   1. Reproduce the failure\n\n---\nThe server responds with a 500 error.',
    } as never);

    (window as typeof window & {
      electronAPI: {
        jiraCreateIssue: ReturnType<typeof vi.fn>;
        openExternalUrl: ReturnType<typeof vi.fn>;
      };
    }).electronAPI.jiraCreateIssue.mockResolvedValueOnce({
      success: true,
      issueKey: 'BUG-123',
      issueUrl: 'https://jira.example.com/browse/BUG-123',
    });

    render(<AIResponseToolbar request={request as never} response={response as never} />);

    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    fireEvent.click(screen.getByText('Bug Report'));
    fireEvent.change(screen.getByPlaceholderText(/Expected status 200/i), {
      target: { value: 'Expected a successful response.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create jira bug/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /create jira bug/i }));

    await waitFor(() => {
      expect(window.electronAPI?.jiraCreateIssue).toHaveBeenCalledTimes(1);
    });

    expect(buildGenerateBugReportPrompt).toHaveBeenCalledWith(
      request,
      response,
      'Expected a successful response.',
    );

    expect(window.electronAPI?.jiraCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://jira.example.com',
        summary: 'Login fails on 500',
        projectKey: 'BUG',
        issueType: 'Bug',
        customFields: {
          customfield_10001: { value: 'Platform' },
          customfield_10002: [
            { name: 'backend', value: 'backend', key: 'backend' },
            { name: 'api', value: 'api', key: 'api' },
          ],
          customfield_10003: [{ key: 'INS-1' }, { key: 'INS-2' }],
          customfield_10004: { flag: true },
          customfield_10005: 'autogenerated',
        },
      }),
    );

    const jiraArgs = window.electronAPI?.jiraCreateIssue.mock.calls[0][0];
    expect(jiraArgs.description).toContain('1. Reproduce the failure');
    expect(jiraArgs.description).toContain('The server responds with a 500 error.');
    expect(jiraArgs.description).not.toContain('## Title');
    expect(jiraArgs.description).not.toContain('1.   1.');

    expect(await screen.findByText('BUG-123')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'BUG-123' }));
    expect(window.electronAPI?.openExternalUrl).toHaveBeenCalledWith(
      'https://jira.example.com/browse/BUG-123',
    );
  });
});