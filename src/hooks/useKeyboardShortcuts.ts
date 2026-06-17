import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { ShortcutActionId, ShortcutBinding, KeyboardShortcutsConfig } from '../types';

export interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: Record<ShortcutActionId, ShortcutBinding> = {
  'close-tab': { ctrl: true, key: 'w' },
  'next-tab': { ctrl: true, key: 'Tab' },
  'prev-tab': { ctrl: true, shift: true, key: 'Tab' },
  'new-request': { ctrl: true, key: 'n' },
  'import': { ctrl: true, key: 'i' },
  'open-environments': { ctrl: true, key: 'e' },
  'show-shortcuts': { ctrl: true, key: '/' },
  'save-request': { ctrl: true, key: 's' },
  'send-request': { ctrl: true, key: 'Enter' },
};

export const SHORTCUT_ACTIONS: Array<{ id: ShortcutActionId; label: string; group: string }> = [
  { id: 'new-request', label: 'New Request', group: 'General' },
  { id: 'import', label: 'Import Collection', group: 'General' },
  { id: 'open-environments', label: 'Open Environments', group: 'General' },
  { id: 'show-shortcuts', label: 'Show Keyboard Shortcuts', group: 'General' },
  { id: 'save-request', label: 'Save Request', group: 'Request' },
  { id: 'send-request', label: 'Send Request', group: 'Request' },
  { id: 'close-tab', label: 'Close Tab', group: 'Tabs' },
  { id: 'next-tab', label: 'Next Tab', group: 'Tabs' },
  { id: 'prev-tab', label: 'Previous Tab', group: 'Tabs' },
];

export function getEffectiveBinding(
  actionId: ShortcutActionId,
  config?: KeyboardShortcutsConfig
): ShortcutBinding | null {
  if (config && actionId in config) {
    return config[actionId] ?? null;
  }
  return DEFAULT_KEYBOARD_SHORTCUTS[actionId];
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'Enter': 'Enter',
    'Escape': 'Esc',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
  };
  return keyMap[key] ?? key.toUpperCase();
}

export function formatShortcutBinding(binding: ShortcutBinding | null): string {
  if (!binding) return 'Disabled';
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  parts.push(formatKey(binding.key));
  return parts.join('+');
}

export function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding | null): boolean {
  if (!binding) return false;
  return (
    e.key.toLowerCase() === binding.key.toLowerCase() &&
    !!e.ctrlKey === !!binding.ctrl &&
    !!e.shiftKey === !!binding.shift &&
    !!e.altKey === !!binding.alt
  );
}

export function useKeyboardShortcuts(additionalShortcuts?: ShortcutHandler[]) {
  const { tabs, activeTabId, closeTab, setActiveTab } = useAppStore();
  const { preferences } = usePreferencesStore();
  const customBindings = preferences.keyboardShortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for additional shortcuts first (highest priority)
      if (additionalShortcuts) {
        for (const shortcut of additionalShortcuts) {
          if (
            e.key.toLowerCase() === shortcut.key.toLowerCase() &&
            !!e.ctrlKey === !!shortcut.ctrl &&
            !!e.shiftKey === !!shortcut.shift &&
            !!e.altKey === !!shortcut.alt
          ) {
            e.preventDefault();
            shortcut.handler();
            return;
          }
        }
      }

      // Close current tab
      const closeTabBinding = getEffectiveBinding('close-tab', customBindings);
      if (matchesBinding(e, closeTabBinding)) {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }

      // Next tab
      const nextTabBinding = getEffectiveBinding('next-tab', customBindings);
      if (matchesBinding(e, nextTabBinding)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex === -1 || tabs.length <= 1) return;
        const newIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        setActiveTab(tabs[newIndex].id);
        return;
      }

      // Previous tab
      const prevTabBinding = getEffectiveBinding('prev-tab', customBindings);
      if (matchesBinding(e, prevTabBinding)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex === -1 || tabs.length <= 1) return;
        const newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTab(tabs[newIndex].id);
        return;
      }

      // Switch to specific tab with Ctrl+1-9 (pattern-based, not individually configurable)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, closeTab, setActiveTab, additionalShortcuts, customBindings]);
}

