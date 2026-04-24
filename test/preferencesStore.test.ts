/**
 * Tests for preferencesStore.ts
 *
 * Covers (browser / non-Electron mode):
 *  - Initial state shape and defaults
 *  - loadPreferences: reads from localStorage in browser mode
 *  - loadPreferences: sets isLoading=false when nothing stored
 *  - loadPreferences: merges partial stored prefs with defaults
 *  - loadPreferences: migrates legacy aiSettings from prefs
 *  - savePreferences: updates preferences and persists to localStorage
 *  - loadAISecrets: reads from localStorage in browser mode
 *  - updateAISettings: updates in-memory aiSettings
 *  - updateAISettings: persists to localStorage when persistToFile=true
 *  - isElectron: false in Node test env
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferencesStore } from '../src/store/preferencesStore';

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageStore: Record<string, string> = {};

beforeEach(() => {
  // Clear localStorage between tests
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { localStorageStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
    clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  });

  // Reset store to defaults
  usePreferencesStore.setState({
    preferences: {
      homeDirectory: null,
      theme: 'dark',
      autoSave: true,
      maxHistoryItems: 100,
      customThemes: [],
      proxy: { mode: 'system', url: '' },
    } as any,
    aiSettings: { provider: 'openai', apiKey: '', model: '' } as any,
    jiraSettings: {
      enabled: false,
      baseUrl: '',
      projectKey: '',
      issueType: 'Bug',
      fieldMappings: [],
    },
    jiraPat: '',
    isLoading: true,
    isElectron: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('preferencesStore – initial state', () => {
  it('has dark theme as default', () => {
    const { preferences } = usePreferencesStore.getState();
    expect(preferences.theme).toBe('dark');
  });

  it('isLoading starts as true', () => {
    expect(usePreferencesStore.getState().isLoading).toBe(true);
  });

  it('isElectron is false in test environment', () => {
    expect(usePreferencesStore.getState().isElectron).toBe(false);
  });
});

describe('preferencesStore – loadPreferences (browser mode)', () => {
  it('sets isLoading=false when nothing is stored', async () => {
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().isLoading).toBe(false);
  });

  it('loads stored preferences from localStorage', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({ theme: 'light', autoSave: false });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().preferences.theme).toBe('light');
    expect(usePreferencesStore.getState().preferences.autoSave).toBe(false);
  });

  it('merges stored prefs with defaults', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({ theme: 'light' });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    // maxHistoryItems should still be the default
    expect(usePreferencesStore.getState().preferences.maxHistoryItems).toBe(100);
  });

  it('migrates legacy aiSettings.apiKey from preferences to aiSettings', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({
      theme: 'dark',
      aiSettings: { apiKey: 'legacy-key', provider: 'openai' },
    });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().aiSettings.apiKey).toBe('legacy-key');
  });

  it('handles malformed JSON in localStorage gracefully', async () => {
    localStorageStore['fetchy-preferences'] = 'NOT_JSON{{{';
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().isLoading).toBe(false);
  });
});

describe('preferencesStore – savePreferences (browser mode)', () => {
  it('updates the preferences state', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    await savePreferences({ theme: 'light' });
    expect(usePreferencesStore.getState().preferences.theme).toBe('light');
  });

  it('persists updated preferences to localStorage', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    await savePreferences({ maxHistoryItems: 50 });
    const stored = JSON.parse(localStorageStore['fetchy-preferences'] ?? '{}');
    expect(stored.maxHistoryItems).toBe(50);
  });

  it('does not persist aiSettings in preferences.json', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    await savePreferences({ theme: 'dark' } as any);
    const stored = JSON.parse(localStorageStore['fetchy-preferences'] ?? '{}');
    // If aiSettings is present, it should have no real apiKey
    expect(stored.aiSettings?.apiKey ?? '').toBeFalsy();
  });
});

describe('preferencesStore – loadAISecrets (browser mode)', () => {
  it('reads aiSettings from localStorage ai-secrets key', async () => {
    localStorageStore['fetchy-ai-secrets'] = JSON.stringify({
      version: '1.0',
      aiSettings: { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', persistToFile: true },
    });
    const { loadAISecrets } = usePreferencesStore.getState();
    await loadAISecrets();
    expect(usePreferencesStore.getState().aiSettings.apiKey).toBe('sk-test');
  });

  it('does not crash when ai-secrets is missing', async () => {
    const { loadAISecrets } = usePreferencesStore.getState();
    await expect(loadAISecrets()).resolves.not.toThrow();
  });
});

describe('preferencesStore – updateAISettings', () => {
  it('updates aiSettings in memory', async () => {
    const { updateAISettings } = usePreferencesStore.getState();
    await updateAISettings({ apiKey: 'new-key' });
    expect(usePreferencesStore.getState().aiSettings.apiKey).toBe('new-key');
  });

  it('persists to localStorage when persistToFile=true', async () => {
    const { updateAISettings } = usePreferencesStore.getState();
    await updateAISettings({ apiKey: 'save-me', persistToFile: true });
    expect(localStorageStore['fetchy-ai-secrets']).toBeTruthy();
    const stored = JSON.parse(localStorageStore['fetchy-ai-secrets']);
    expect(stored.aiSettings.apiKey).toBe('save-me');
  });

  it('removes ai-secrets from localStorage when persistToFile toggled off', async () => {
    localStorageStore['fetchy-ai-secrets'] = JSON.stringify({ version: '1.0', aiSettings: { apiKey: 'old' } });
    // Simulate store already had persistToFile=true
    usePreferencesStore.setState({ aiSettings: { apiKey: 'old', persistToFile: true } as any });
    const { updateAISettings } = usePreferencesStore.getState();
    await updateAISettings({ persistToFile: false });
    expect(localStorageStore['fetchy-ai-secrets']).toBeUndefined();
  });
});

describe('preferencesStore – loadJiraSecrets (browser mode)', () => {
  it('reads jiraPat from localStorage jira-secrets key', async () => {
    localStorageStore['fetchy-jira-secrets'] = JSON.stringify({ version: '1.0', pat: 'jira-token-123' });
    const { loadJiraSecrets } = usePreferencesStore.getState();
    await loadJiraSecrets();
    expect(usePreferencesStore.getState().jiraPat).toBe('jira-token-123');
  });

  it('does not crash when jira-secrets is missing', async () => {
    const { loadJiraSecrets } = usePreferencesStore.getState();
    await expect(loadJiraSecrets()).resolves.not.toThrow();
    expect(usePreferencesStore.getState().jiraPat).toBe('');
  });

  it('does not update jiraPat when stored secrets have no pat', async () => {
    localStorageStore['fetchy-jira-secrets'] = JSON.stringify({ version: '1.0' });
    const { loadJiraSecrets } = usePreferencesStore.getState();
    await loadJiraSecrets();
    expect(usePreferencesStore.getState().jiraPat).toBe('');
  });

  it('handles malformed JSON in jira-secrets gracefully', async () => {
    localStorageStore['fetchy-jira-secrets'] = 'INVALID{{{';
    const { loadJiraSecrets } = usePreferencesStore.getState();
    await expect(loadJiraSecrets()).resolves.not.toThrow();
  });
});

describe('preferencesStore – updateJiraSettings', () => {
  it('updates jiraSettings in memory', async () => {
    const { loadPreferences, updateJiraSettings } = usePreferencesStore.getState();
    await loadPreferences();
    await updateJiraSettings({ enabled: true, baseUrl: 'https://jira.example.com' });
    expect(usePreferencesStore.getState().jiraSettings.enabled).toBe(true);
    expect(usePreferencesStore.getState().jiraSettings.baseUrl).toBe('https://jira.example.com');
  });

  it('persists jiraSettings to localStorage via savePreferences', async () => {
    const { loadPreferences, updateJiraSettings } = usePreferencesStore.getState();
    await loadPreferences();
    await updateJiraSettings({ projectKey: 'PROJ', issueType: 'Task' });
    const stored = JSON.parse(localStorageStore['fetchy-preferences'] ?? '{}');
    expect(stored.jiraSettings?.projectKey).toBe('PROJ');
    expect(stored.jiraSettings?.issueType).toBe('Task');
  });
});

describe('preferencesStore – updateJiraPat', () => {
  it('sets jiraPat in memory', async () => {
    const { updateJiraPat } = usePreferencesStore.getState();
    await updateJiraPat('my-jira-pat');
    expect(usePreferencesStore.getState().jiraPat).toBe('my-jira-pat');
  });

  it('persists PAT to localStorage when PAT is non-empty', async () => {
    const { updateJiraPat } = usePreferencesStore.getState();
    await updateJiraPat('store-this-pat');
    const stored = JSON.parse(localStorageStore['fetchy-jira-secrets'] ?? '{}');
    expect(stored.pat).toBe('store-this-pat');
  });

  it('removes jira-secrets from localStorage when PAT is cleared', async () => {
    localStorageStore['fetchy-jira-secrets'] = JSON.stringify({ version: '1.0', pat: 'old-pat' });
    const { updateJiraPat } = usePreferencesStore.getState();
    await updateJiraPat('');
    expect(localStorageStore['fetchy-jira-secrets']).toBeUndefined();
  });
});

describe('preferencesStore – selectHomeDirectory (browser mode)', () => {
  it('returns null in browser (non-Electron) mode', async () => {
    const { selectHomeDirectory } = usePreferencesStore.getState();
    const result = await selectHomeDirectory();
    expect(result).toBeNull();
  });
});

describe('preferencesStore – setHomeDirectory (browser mode)', () => {
  it('saves homeDirectory to preferences', async () => {
    const { loadPreferences, setHomeDirectory } = usePreferencesStore.getState();
    await loadPreferences();
    const result = await setHomeDirectory('/new/home/dir');
    expect(result).toBe(true);
    expect(usePreferencesStore.getState().preferences.homeDirectory).toBe('/new/home/dir');
  });

  it('persists homeDirectory to localStorage', async () => {
    const { loadPreferences, setHomeDirectory } = usePreferencesStore.getState();
    await loadPreferences();
    await setHomeDirectory('/persisted/home');
    const stored = JSON.parse(localStorageStore['fetchy-preferences'] ?? '{}');
    expect(stored.homeDirectory).toBe('/persisted/home');
  });
});

describe('preferencesStore – getHomeDirectory (browser mode)', () => {
  it('returns the stored homeDirectory', async () => {
    const { loadPreferences, savePreferences, getHomeDirectory } = usePreferencesStore.getState();
    await loadPreferences();
    await savePreferences({ homeDirectory: '/test/home' } as any);
    const dir = await getHomeDirectory();
    expect(dir).toBe('/test/home');
  });

  it('returns empty string when no homeDirectory is set', async () => {
    const { getHomeDirectory } = usePreferencesStore.getState();
    const dir = await getHomeDirectory();
    expect(dir).toBe('');
  });
});

// ─── Additional coverage tests ────────────────────────────────────────────────

describe('preferencesStore – savePreferences strips aiSettings', () => {
  it('always resets aiSettings to defaults when saving', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    // Even if we try to save aiSettings with a key, it should be stripped
    await savePreferences({ theme: 'light' } as any);
    const stored = JSON.parse(localStorageStore['fetchy-preferences'] ?? '{}');
    // aiSettings should have no real apiKey
    expect(stored.aiSettings?.apiKey || '').toBeFalsy();
  });

  it('returns true on successful save in browser mode', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    const result = await savePreferences({ theme: 'dark' });
    expect(result).toBe(true);
  });

  it('returns false if localStorage throws on save', async () => {
    const { loadPreferences, savePreferences } = usePreferencesStore.getState();
    await loadPreferences();
    // Make setItem throw
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('quota exceeded'); });
    const result = await savePreferences({ theme: 'light' });
    expect(result).toBe(false);
  });
});

describe('preferencesStore – loadPreferences with proxy settings', () => {
  it('loads proxy settings from localStorage', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({
      theme: 'dark',
      proxy: { mode: 'manual', url: 'http://proxy.local:8080' },
    });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().preferences.proxy?.mode).toBe('manual');
    expect(usePreferencesStore.getState().preferences.proxy?.url).toBe('http://proxy.local:8080');
  });

  it('defaults proxy to system mode when not stored', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({ theme: 'dark' });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().preferences.proxy?.mode).toBe('system');
  });
});

describe('preferencesStore – loadPreferences with customThemes', () => {
  it('loads custom themes from localStorage', async () => {
    const customTheme = { id: 'mytheme', name: 'My Theme', colors: {} };
    localStorageStore['fetchy-preferences'] = JSON.stringify({
      theme: 'dark',
      customThemes: [customTheme],
    });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().preferences.customThemes).toHaveLength(1);
  });

  it('defaults customThemes to empty array', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({ theme: 'dark' });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    expect(usePreferencesStore.getState().preferences.customThemes).toEqual([]);
  });
});

describe('preferencesStore – updateAISettings edge cases', () => {
  it('does not persist when persistToFile is false and was also false', async () => {
    usePreferencesStore.setState({ aiSettings: { apiKey: '', persistToFile: false } as any });
    const { updateAISettings } = usePreferencesStore.getState();
    await updateAISettings({ apiKey: 'temp-key' });
    expect(localStorageStore['fetchy-ai-secrets']).toBeUndefined();
    expect(usePreferencesStore.getState().aiSettings.apiKey).toBe('temp-key');
  });

  it('persists model name when persistToFile is true', async () => {
    const { updateAISettings } = usePreferencesStore.getState();
    await updateAISettings({ model: 'gpt-4o', persistToFile: true });
    const stored = JSON.parse(localStorageStore['fetchy-ai-secrets'] ?? '{}');
    expect(stored.aiSettings.model).toBe('gpt-4o');
  });
});

describe('preferencesStore – loadAISecrets edge cases', () => {
  it('handles malformed JSON in ai-secrets gracefully', async () => {
    localStorageStore['fetchy-ai-secrets'] = 'NOT_JSON{{{';
    const { loadAISecrets } = usePreferencesStore.getState();
    await expect(loadAISecrets()).resolves.not.toThrow();
  });

  it('does not update when ai-secrets has no aiSettings', async () => {
    localStorageStore['fetchy-ai-secrets'] = JSON.stringify({ version: '1.0' });
    const { loadAISecrets } = usePreferencesStore.getState();
    await loadAISecrets();
    // Should keep the default/current state
    expect(usePreferencesStore.getState().aiSettings).toBeTruthy();
  });
});

describe('preferencesStore – loadPreferences does not migrate when no apiKey', () => {
  it('does not set migrated AI settings when apiKey is empty', async () => {
    localStorageStore['fetchy-preferences'] = JSON.stringify({
      theme: 'dark',
      aiSettings: { provider: 'openai', apiKey: '' },
    });
    usePreferencesStore.setState({ aiSettings: { provider: 'default', apiKey: '' } as any });
    const { loadPreferences } = usePreferencesStore.getState();
    await loadPreferences();
    // Should not have overridden to 'openai' because apiKey is empty
    expect(usePreferencesStore.getState().aiSettings.apiKey).toBe('');
  });
});

describe('preferencesStore – setHomeDirectory with migration', () => {
  it('calls savePreferences for browser mode without migration', async () => {
    const { loadPreferences, setHomeDirectory } = usePreferencesStore.getState();
    await loadPreferences();
    const result = await setHomeDirectory('/new/path', true);
    // In browser mode, migrateData is a no-op, just saves preference
    expect(result).toBe(true);
    expect(usePreferencesStore.getState().preferences.homeDirectory).toBe('/new/path');
  });
});
