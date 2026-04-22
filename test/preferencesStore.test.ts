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
