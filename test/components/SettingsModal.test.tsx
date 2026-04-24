// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsModal from '../../src/components/SettingsModal';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import { useAppStore } from '../../src/store/appStore';
import { useWorkspacesStore } from '../../src/store/workspacesStore';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/store/workspacesStore', () => ({
  useWorkspacesStore: vi.fn(),
}));

vi.mock('../../src/utils/aiProvider', () => ({
  PROVIDER_META: {
    gemini: { label: 'Gemini', defaultModel: 'gemini-pro', models: ['gemini-pro'], requiresApiKey: true, requiresBaseUrl: false, description: 'Google Gemini', baseUrlPlaceholder: '' },
    ollama: { label: 'Ollama', defaultModel: 'llama2', models: ['llama2'], requiresApiKey: false, requiresBaseUrl: true, description: 'Local Ollama', baseUrlPlaceholder: 'http://localhost:11434' },
    openai: { label: 'OpenAI', defaultModel: 'gpt-4', models: ['gpt-4'], requiresApiKey: true, requiresBaseUrl: false, description: 'OpenAI GPT', baseUrlPlaceholder: '' },
    siemens: { label: 'Siemens', defaultModel: 'siemens-model', models: ['siemens-model'], requiresApiKey: true, requiresBaseUrl: true, description: 'Siemens AI', baseUrlPlaceholder: 'https://api.siemens.com' },
  },
  sendAIRequest: vi.fn().mockResolvedValue({ success: true, content: 'Connection successful!' }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const savePreferences = vi.fn();
const updateAISettings = vi.fn();
const updateJiraSettings = vi.fn();
const updateJiraPat = vi.fn();
const setPanelLayout = vi.fn();
const onClose = vi.fn();
const onOpenWorkspaces = vi.fn();

function mockStores() {
  vi.mocked(usePreferencesStore).mockReturnValue({
    preferences: { theme: 'dark', autosaveDelay: 1000, maxHistoryItems: 100, panelLayout: 'horizontal' },
    savePreferences,
    aiSettings: {
      enabled: false,
      provider: 'gemini',
      model: 'gemini-pro',
      apiKey: '',
      baseUrl: '',
      temperature: 0.7,
      maxTokens: 2048,
      persistToFile: false,
    },
    updateAISettings,
    jiraSettings: {
      enabled: false,
      baseUrl: '',
      projectKey: '',
      issueType: 'Bug',
      fieldMappings: [],
    },
    jiraPat: '',
    updateJiraSettings,
    updateJiraPat,
  } as ReturnType<typeof usePreferencesStore>);

  vi.mocked(useAppStore).mockReturnValue({
    panelLayout: 'horizontal',
    setPanelLayout,
  } as ReturnType<typeof useAppStore>);

  vi.mocked(useWorkspacesStore).mockReturnValue({
    workspaces: [{ id: 'ws-1', name: 'My Workspace', path: '/path/to/workspace' }],
    activeWorkspaceId: 'ws-1',
  } as ReturnType<typeof useWorkspacesStore>);
}

describe('SettingsModal', () => {
  it('returns null when isOpen is false', () => {
    mockStores();
    const { container } = render(
      <SettingsModal isOpen={false} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal title when open', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders General, AI Assistant, and Integrations tabs', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    expect(screen.getByRole('button', { name: /General/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /AI Assistant/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Integrations/i })).toBeDefined();
  });

  it('shows active workspace name in General tab', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    expect(screen.getByText('My Workspace')).toBeDefined();
  });

  it('calls onClose when X button is clicked', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const closeBtn = screen.getAllByRole('button').find(b => b.className.includes('p-1'));
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to AI tab when clicked', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Assistant/i }));
    expect(screen.getByText('AI Provider')).toBeDefined();
  });

  it('opens AI tab by default when initialTab is "ai"', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    expect(screen.getByText('AI Provider')).toBeDefined();
  });

  it('switches to Integrations tab when clicked', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const integrationsBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Integrations'));
    expect(integrationsBtn).toBeDefined();
    fireEvent.click(integrationsBtn!);
    expect(screen.getByText('Jira Integration')).toBeDefined();
  });

  it('shows Test Connection button in AI tab', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDefined();
  });

  it('tests AI connection when button is clicked', async () => {
    mockStores();
    vi.mocked(usePreferencesStore).mockReturnValue({
      ...vi.mocked(usePreferencesStore)(),
      aiSettings: { enabled: true, provider: 'gemini' as const, model: 'gemini-pro', apiKey: 'test-key', baseUrl: '', temperature: 0.7, maxTokens: 2048, persistToFile: false },
    } as ReturnType<typeof usePreferencesStore>);
    const { sendAIRequest } = await import('../../src/utils/aiProvider');
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    fireEvent.click(screen.getByRole('button', { name: /Test Connection/i }));
    await waitFor(() => expect(sendAIRequest).toHaveBeenCalled());
  });

  it('calls onOpenWorkspaces when Manage Workspaces button is clicked', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const manageBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('Manage'));
    if (manageBtns.length > 0) {
      fireEvent.click(manageBtns[0]);
      expect(onOpenWorkspaces).toHaveBeenCalled();
    }
  });

  it('changes panel layout to vertical', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const select = screen.getByDisplayValue('Right');
    fireEvent.change(select, { target: { value: 'vertical' } });
    expect(setPanelLayout).toHaveBeenCalledWith('vertical');
  });

  it('changes max history items', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const input = screen.getByDisplayValue('100');
    fireEvent.change(input, { target: { value: '200' } });
    expect(savePreferences).toHaveBeenCalledWith({ maxHistoryItems: 200 });
  });

  it('toggles AI enabled checkbox', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(updateAISettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('switches AI provider to ollama and sets default base URL', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const ollamaBtn = screen.getByText('Ollama').closest('button')!;
    fireEvent.click(ollamaBtn);
    expect(updateAISettings).toHaveBeenCalledWith({
      provider: 'ollama',
      model: 'llama2',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
    });
  });

  it('shows API key input for provider that requires it', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    expect(screen.getByPlaceholderText(/Enter your Gemini API key/i)).toBeDefined();
  });

  it('updates API key value', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const apiKeyInput = screen.getByPlaceholderText(/Enter your Gemini API key/i);
    fireEvent.change(apiKeyInput, { target: { value: 'my-secret-key' } });
    expect(updateAISettings).toHaveBeenCalledWith({ apiKey: 'my-secret-key' });
  });

  it('toggles API key visibility', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const apiKeyInput = screen.getByPlaceholderText(/Enter your Gemini API key/i) as HTMLInputElement;
    expect(apiKeyInput.type).toBe('password');
    const toggleBtn = apiKeyInput.parentElement!.querySelector('button')!;
    fireEvent.click(toggleBtn);
    expect(apiKeyInput.type).toBe('text');
  });

  it('changes AI model via select', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const modelSelect = screen.getByDisplayValue('gemini-pro');
    fireEvent.change(modelSelect, { target: { value: 'gemini-pro' } });
    expect(updateAISettings).toHaveBeenCalledWith({ model: 'gemini-pro' });
  });

  it('changes temperature slider', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.3' } });
    expect(updateAISettings).toHaveBeenCalledWith({ temperature: 0.3 });
  });

  it('changes max tokens input', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const maxTokensInput = screen.getByDisplayValue('2048');
    fireEvent.change(maxTokensInput, { target: { value: '4096' } });
    expect(updateAISettings).toHaveBeenCalledWith({ maxTokens: 4096 });
  });

  it('toggles persist to file checkbox', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(updateAISettings).toHaveBeenCalledWith({ persistToFile: true });
  });

  it('displays AI test connection success message', async () => {
    mockStores();
    vi.mocked(usePreferencesStore).mockReturnValue({
      ...vi.mocked(usePreferencesStore)(),
      aiSettings: { enabled: true, provider: 'gemini' as const, model: 'gemini-pro', apiKey: 'test-key', baseUrl: '', temperature: 0.7, maxTokens: 2048, persistToFile: false },
    } as ReturnType<typeof usePreferencesStore>);
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    fireEvent.click(screen.getByRole('button', { name: /Test Connection/i }));
    await waitFor(() => {
      expect(screen.getByText('Connection successful!')).toBeDefined();
    });
  });

  it('displays AI test connection error message', async () => {
    const { sendAIRequest } = await import('../../src/utils/aiProvider');
    vi.mocked(sendAIRequest).mockResolvedValueOnce({ success: false, content: '', error: 'Invalid API key' } as any);
    mockStores();
    vi.mocked(usePreferencesStore).mockReturnValue({
      ...vi.mocked(usePreferencesStore)(),
      aiSettings: { enabled: true, provider: 'gemini' as const, model: 'gemini-pro', apiKey: 'bad-key', baseUrl: '', temperature: 0.7, maxTokens: 2048, persistToFile: false },
    } as ReturnType<typeof usePreferencesStore>);
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="ai" />);
    fireEvent.click(screen.getByRole('button', { name: /Test Connection/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeDefined();
    });
  });

  it('toggles Jira enabled checkbox', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(updateJiraSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('updates Jira base URL', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const input = screen.getByPlaceholderText('https://your-jira-instance.atlassian.net');
    fireEvent.change(input, { target: { value: 'https://jira.example.com' } });
    expect(updateJiraSettings).toHaveBeenCalledWith({ baseUrl: 'https://jira.example.com' });
  });

  it('updates Jira PAT', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const input = screen.getByPlaceholderText('Enter your Jira PAT');
    fireEvent.change(input, { target: { value: 'my-pat-token' } });
    expect(updateJiraPat).toHaveBeenCalledWith('my-pat-token');
  });

  it('updates Jira project key', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const input = screen.getByPlaceholderText('e.g. SIGDSAWEB');
    fireEvent.change(input, { target: { value: 'MYPROJECT' } });
    expect(updateJiraSettings).toHaveBeenCalledWith({ projectKey: 'MYPROJECT' });
  });

  it('toggles Jira PAT visibility', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const patInput = screen.getByPlaceholderText('Enter your Jira PAT') as HTMLInputElement;
    expect(patInput.type).toBe('password');
    const toggleBtn = patInput.parentElement!.querySelector('button')!;
    fireEvent.click(toggleBtn);
    expect(patInput.type).toBe('text');
  });

  it('adds a Jira field mapping', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    const addFieldBtn = screen.getByRole('button', { name: /Add Field/i });
    fireEvent.click(addFieldBtn);
    expect(updateJiraSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fieldMappings: expect.any(Array) })
    );
  });

  it('shows empty field mappings message', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    expect(screen.getByText(/No custom fields configured/)).toBeDefined();
  });

  it('removes a Jira field mapping when delete button is clicked', () => {
    mockStores();
    vi.mocked(usePreferencesStore).mockReturnValue({
      ...vi.mocked(usePreferencesStore)(),
      jiraSettings: {
        enabled: true,
        baseUrl: 'https://jira.example.com',
        projectKey: 'TEST',
        issueType: 'Bug',
        fieldMappings: [{ id: 'map-1', fieldName: 'Priority', customFieldId: 'customfield_123', fieldType: 'text' as const, defaultValue: '' }],
      },
    } as ReturnType<typeof usePreferencesStore>);
    const { container } = render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} initialTab="integrations" />);
    expect(screen.getByDisplayValue('Priority')).toBeDefined();
    const deleteBtn = container.querySelector('button[class*="hover:text-red"]');
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn!);
    expect(updateJiraSettings).toHaveBeenCalledWith({ fieldMappings: [] });
  });

  it('changes proxy mode to manual', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const proxySelect = screen.getByDisplayValue('System / Environment');
    fireEvent.change(proxySelect, { target: { value: 'manual' } });
    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ proxy: expect.objectContaining({ mode: 'manual' }) })
    );
  });

  it('calls onClose from footer Close button', () => {
    mockStores();
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    const closeButtons = screen.getAllByRole('button').filter(b => b.textContent === 'Close');
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows default workspace text when no active workspace', () => {
    mockStores();
    vi.mocked(useWorkspacesStore).mockReturnValue({
      workspaces: [],
      activeWorkspaceId: null,
    } as unknown as ReturnType<typeof useWorkspacesStore>);
    render(<SettingsModal isOpen={true} onClose={onClose} onOpenWorkspaces={onOpenWorkspaces} />);
    expect(screen.getByText('Default (no workspace)')).toBeDefined();
  });
});
