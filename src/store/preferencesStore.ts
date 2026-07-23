import { create } from 'zustand';
import { AppPreferences, AISettings, AISecretsStorage, JiraSettings, JiraSecretsStorage, KeyboardShortcutsConfig } from '../types';
import { defaultAISettings } from '../utils/aiProvider';

// ElectronAPI type is declared in ../types/index.ts

interface PreferencesStore {
  preferences: AppPreferences;
  aiSettings: AISettings; // In-memory AI settings (NOT persisted in preferences.json)
  jiraSettings: JiraSettings; // In-memory Jira settings (PAT stored separately)
  jiraPat: string; // In-memory PAT (never persisted in preferences.json)
  jiraEmail: string; // In-memory Atlassian account email (never persisted in preferences.json)
  isLoading: boolean;
  isElectron: boolean;

  // Actions
  loadPreferences: () => Promise<void>;
  savePreferences: (updates: Partial<AppPreferences>) => Promise<boolean>;
  loadAISecrets: () => Promise<void>;
  updateAISettings: (updates: Partial<AISettings>) => Promise<void>;
  loadJiraSecrets: () => Promise<void>;
  updateJiraSettings: (updates: Partial<JiraSettings>) => Promise<void>;
  updateJiraPat: (pat: string) => Promise<void>;
  updateJiraEmail: (email: string) => Promise<void>;
  updateKeyboardShortcuts: (config: KeyboardShortcutsConfig) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  selectHomeDirectory: () => Promise<string | null>;
  setHomeDirectory: (directory: string, migrateData?: boolean) => Promise<boolean>;
  getHomeDirectory: () => Promise<string>;
}

const defaultPreferences: AppPreferences = {
  homeDirectory: null,
  theme: 'dark',
  autoSave: true,
  maxHistoryItems: 100,
  customThemes: [],
  aiSettings: defaultAISettings, // Kept for backward-compat shape; stripped before saving
  proxy: { mode: 'system', url: '' },
  onboardingCompleted: false,
};

export const defaultJiraSettings: JiraSettings = {
  enabled: false,
  baseUrl: '',
  projectKey: '',
  issueType: 'Bug',
  fieldMappings: [],
};

/**
 * Strip aiSettings from preferences before persisting so API keys / AI
 * configuration are never written to preferences.json.
 */
function stripAISettings(prefs: AppPreferences): AppPreferences {
  const { aiSettings: _ignored, ...rest } = prefs;
  return { ...rest, aiSettings: defaultAISettings };
}

export const usePreferencesStore = create<PreferencesStore>()((set, get) => ({
  preferences: defaultPreferences,
  aiSettings: { ...defaultAISettings },
  jiraSettings: { ...defaultJiraSettings },
  jiraPat: '',
  jiraEmail: '',
  isLoading: true,
  isElectron: typeof window !== 'undefined' && !!window.electronAPI,

  loadPreferences: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        const prefs = await window.electronAPI.getPreferences();
        if (prefs) {
          // Migrate: if preferences.json still has real AI settings, pull them
          // into memory but don't re-save them to preferences.json.
          const migratedAI =
            prefs.aiSettings && prefs.aiSettings.apiKey
              ? { ...defaultAISettings, ...prefs.aiSettings }
              : undefined;

          set((s) => ({
            preferences: { ...defaultPreferences, ...prefs, aiSettings: defaultAISettings },
            aiSettings: migratedAI ?? s.aiSettings,
            jiraSettings: prefs.jiraSettings ? { ...defaultJiraSettings, ...prefs.jiraSettings } : s.jiraSettings,
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        set({ isLoading: false });
      }
    } else {
      // Browser mode - use localStorage
      try {
        const stored = localStorage.getItem('fetchy-preferences');
        if (stored) {
          const prefs = JSON.parse(stored);
          const migratedAI =
            prefs.aiSettings && prefs.aiSettings.apiKey
              ? { ...defaultAISettings, ...prefs.aiSettings }
              : undefined;

          set((s) => ({
            preferences: { ...defaultPreferences, ...prefs, aiSettings: defaultAISettings },
            aiSettings: migratedAI ?? s.aiSettings,
            jiraSettings: prefs.jiraSettings ? { ...defaultJiraSettings, ...prefs.jiraSettings } : s.jiraSettings,
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        console.error('Error loading preferences from localStorage:', error);
        set({ isLoading: false });
      }
    }
  },

  /**
   * Load AI secrets from the separate secrets file (ai-secrets.json).
   * Called once on app startup, after loadPreferences.
   */
  loadAISecrets: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        const raw = await window.electronAPI.readAISecrets();
        if (raw) {
          const stored: AISecretsStorage = JSON.parse(raw);
          if (stored?.aiSettings) {
            set({ aiSettings: { ...defaultAISettings, ...stored.aiSettings, persistToFile: true } });
            return;
          }
        }
      } catch (error) {
        console.error('Error loading AI secrets:', error);
      }
    } else {
      // Browser mode – localStorage
      try {
        const raw = localStorage.getItem('fetchy-ai-secrets');
        if (raw) {
          const stored: AISecretsStorage = JSON.parse(raw);
          if (stored?.aiSettings) {
            set({ aiSettings: { ...defaultAISettings, ...stored.aiSettings, persistToFile: true } });
            return;
          }
        }
      } catch (error) {
        console.error('Error loading AI secrets from localStorage:', error);
      }
    }

    // If secrets file doesn't exist but we have migrated settings from preferences, keep them
    // (they are already in aiSettings from loadPreferences migration)
  },

  /**
   * Update AI settings in memory, and optionally persist to the secrets file.
   */
  updateAISettings: async (updates: Partial<AISettings>) => {
    const { isElectron, aiSettings } = get();
    const newSettings: AISettings = { ...aiSettings, ...updates };
    set({ aiSettings: newSettings });

    // Handle persistence toggle
    const shouldPersist = newSettings.persistToFile;
    const wasPersisted = aiSettings.persistToFile;

    if (shouldPersist) {
      // Write to secrets file
      const { persistToFile: _flag, ...settingsToStore } = newSettings;
      const storage: AISecretsStorage = {
        version: '1.0',
        aiSettings: { ...settingsToStore, persistToFile: true },
      };

      if (isElectron && window.electronAPI) {
        await window.electronAPI.writeAISecrets({ content: JSON.stringify(storage, null, 2) });
      } else {
        localStorage.setItem('fetchy-ai-secrets', JSON.stringify(storage));
      }
    } else if (wasPersisted && !shouldPersist) {
      // User turned off persistence – delete the secrets file
      if (isElectron && window.electronAPI) {
        await window.electronAPI.deleteAISecrets();
      } else {
        localStorage.removeItem('fetchy-ai-secrets');
      }
    }
  },

  /**
   * Load Jira PAT (and account email, for Jira Cloud Basic auth) from the
   * separate secrets file (jira-secrets). Called once on app startup, after
   * loadPreferences.
   */
  loadJiraSecrets: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        const raw = await window.electronAPI.readJiraSecrets();
        if (raw) {
          const stored: JiraSecretsStorage = JSON.parse(raw);
          if (stored?.pat || stored?.email) {
            set({ jiraPat: stored.pat || '', jiraEmail: stored.email || '' });
            return;
          }
        }
      } catch (error) {
        console.error('Error loading Jira secrets:', error);
      }
    } else {
      // Browser mode – localStorage
      try {
        const raw = localStorage.getItem('fetchy-jira-secrets');
        if (raw) {
          const stored: JiraSecretsStorage = JSON.parse(raw);
          if (stored?.pat || stored?.email) {
            set({ jiraPat: stored.pat || '', jiraEmail: stored.email || '' });
            return;
          }
        }
      } catch (error) {
        console.error('Error loading Jira secrets from localStorage:', error);
      }
    }
  },

  /**
   * Update Jira settings (non-secret fields) and persist to preferences.
   */
  updateJiraSettings: async (updates: Partial<JiraSettings>) => {
    const { jiraSettings, savePreferences } = get();
    const newSettings: JiraSettings = { ...jiraSettings, ...updates };
    set({ jiraSettings: newSettings });
    await savePreferences({ jiraSettings: newSettings });
  },

  /**
   * Update Jira PAT and persist to the secrets file (preserving the stored email).
   */
  updateJiraPat: async (pat: string) => {
    const { isElectron, jiraEmail } = get();
    set({ jiraPat: pat });

    if (pat || jiraEmail) {
      const storage: JiraSecretsStorage = { version: '1.0', pat, email: jiraEmail };
      if (isElectron && window.electronAPI) {
        await window.electronAPI.writeJiraSecrets({ content: JSON.stringify(storage, null, 2) });
      } else {
        localStorage.setItem('fetchy-jira-secrets', JSON.stringify(storage));
      }
    } else {
      // PAT cleared and no email set – delete the secrets file
      if (isElectron && window.electronAPI) {
        await window.electronAPI.deleteJiraSecrets();
      } else {
        localStorage.removeItem('fetchy-jira-secrets');
      }
    }
  },

  /**
   * Update the Atlassian account email (used for Jira Cloud Basic auth
   * alongside the API token) and persist to the secrets file.
   */
  updateJiraEmail: async (email: string) => {
    const { isElectron, jiraPat } = get();
    set({ jiraEmail: email });

    if (jiraPat || email) {
      const storage: JiraSecretsStorage = { version: '1.0', pat: jiraPat, email };
      if (isElectron && window.electronAPI) {
        await window.electronAPI.writeJiraSecrets({ content: JSON.stringify(storage, null, 2) });
      } else {
        localStorage.setItem('fetchy-jira-secrets', JSON.stringify(storage));
      }
    } else {
      // Both cleared – delete the secrets file
      if (isElectron && window.electronAPI) {
        await window.electronAPI.deleteJiraSecrets();
      } else {
        localStorage.removeItem('fetchy-jira-secrets');
      }
    }
  },

  savePreferences: async (updates: Partial<AppPreferences>) => {
    const { isElectron, preferences } = get();
    // Always strip aiSettings before persisting
    const newPreferences = stripAISettings({ ...preferences, ...updates });

    if (isElectron && window.electronAPI) {
      try {
        const success = await window.electronAPI.savePreferences(newPreferences);
        if (success) {
          set({ preferences: newPreferences });
        }
        return success;
      } catch (error) {
        console.error('Error saving preferences:', error);
        return false;
      }
    } else {
      // Browser mode - use localStorage
      try {
        localStorage.setItem('fetchy-preferences', JSON.stringify(newPreferences));
        set({ preferences: newPreferences });
        return true;
      } catch (error) {
        console.error('Error saving preferences to localStorage:', error);
        return false;
      }
    }
  },

  updateKeyboardShortcuts: async (config: KeyboardShortcutsConfig) => {
    await get().savePreferences({ keyboardShortcuts: config });
  },

  /**
   * Mark the interactive onboarding tour (#93) as completed so it is not
   * shown again on subsequent launches. Re-launching the tour from the
   * menu/settings does not need a store action — it only toggles local UI
   * state in App.tsx.
   */
  completeOnboarding: async () => {
    await get().savePreferences({ onboardingCompleted: true });
  },

  selectHomeDirectory: async () => {
    const { isElectron } = get();

    if (isElectron && window.electronAPI) {
      try {
        return await window.electronAPI.selectHomeDirectory();
      } catch (error) {
        console.error('Error selecting home directory:', error);
        return null;
      }
    }

    return null;
  },

  setHomeDirectory: async (directory: string, migrateData = false) => {
    const { isElectron, savePreferences } = get();

    if (isElectron && window.electronAPI) {
      try {
        // Get current home directory before changing
        const oldPath = await window.electronAPI.getHomeDirectory();

        // Migrate data if requested
        if (migrateData && oldPath !== directory) {
          const migrated = await window.electronAPI.migrateData({
            oldPath,
            newPath: directory,
          });

          if (!migrated) {
            console.error('Failed to migrate data');
            return false;
          }
        }

        // Save new home directory in preferences
        const success = await savePreferences({ homeDirectory: directory });
        return success;
      } catch (error) {
        console.error('Error setting home directory:', error);
        return false;
      }
    }

    // Browser mode - just save the preference (no actual file storage)
    return savePreferences({ homeDirectory: directory });
  },

  getHomeDirectory: async () => {
    const { isElectron, preferences } = get();

    if (isElectron && window.electronAPI) {
      try {
        return await window.electronAPI.getHomeDirectory();
      } catch (error) {
        console.error('Error getting home directory:', error);
        return preferences.homeDirectory || '';
      }
    }

    return preferences.homeDirectory || '';
  },
}));

