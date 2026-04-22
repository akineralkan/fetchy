// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '../../src/components/ThemeToggle';
import { usePreferencesStore } from '../../src/store/preferencesStore';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/components/CustomThemeEditorModal', () => ({
  default: () => null,
}));

const savePreferences = vi.fn();

function mockStore(theme = 'dark', customThemes: unknown[] = []) {
  vi.mocked(usePreferencesStore).mockReturnValue({
    preferences: { theme, customThemes },
    savePreferences,
  } as ReturnType<typeof usePreferencesStore>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ThemeToggle', () => {
  it('renders the current theme label', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    expect(screen.getByText('Dark')).toBeDefined();
  });

  it('renders the current theme label for light', () => {
    mockStore('light');
    render(<ThemeToggle />);
    expect(screen.getByText('Light')).toBeDefined();
  });

  it('opens dropdown when button clicked', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    // Should show theme groups
    const allLight = screen.getAllByText('Light');
    expect(allLight.length).toBeGreaterThan(0);
  });

  it('closes dropdown when clicking outside', () => {
    mockStore('dark');
    render(
      <div>
        <ThemeToggle />
        <span data-testid="outside">outside</span>
      </div>
    );
    fireEvent.click(screen.getByTitle('Change Theme'));
    // dropdown open - 'Light' should appear as an option
    expect(screen.getAllByText('Light').length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByTestId('outside'));
    // After clicking outside the dropdown closes
    // The only 'Light' left should be nothing (the theme label in the toggle button)
    expect(screen.queryByText('Light Themes')).toBeNull();
  });

  it('calls savePreferences when a theme is selected', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    const allButtons = screen.getAllByRole('button');
    // Find the Light theme button in the dropdown (not the trigger button)
    const lightBtn = allButtons.find(
      b => b !== screen.getByTitle('Change Theme') && b.textContent?.trim().startsWith('Light')
    );
    fireEvent.click(lightBtn!);
    expect(savePreferences).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('applies theme class to document body on mount', () => {
    mockStore('light');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  it('applies dark class to html element for dark theme', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
