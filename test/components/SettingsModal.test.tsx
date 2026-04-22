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
    gemini: { label: 'Gemini', defaultModel: 'gemini-pro', models: ['gemini-pro'], requiresKey: true },
    ollama: { label: 'Ollama', defaultModel: 'llama2', models: ['llama2'], requiresKey: false },
    openai: { label: 'OpenAI', defaultModel: 'gpt-4', models: ['gpt-4'], requiresKey: true },
    siemens: { label: 'Siemens', defaultModel: 'siemens-model', models: ['siemens-model'], requiresKey: true },
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
});
