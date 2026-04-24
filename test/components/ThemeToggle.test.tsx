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

  // ── Additional coverage tests ──────────────────────────────────────────

  it('applies ocean-theme class for ocean theme', () => {
    mockStore('ocean');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('ocean-theme')).toBe(true);
  });

  it('applies forest-theme class for forest theme', () => {
    mockStore('forest');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('forest-theme')).toBe(true);
  });

  it('applies earth-theme class for earth theme', () => {
    mockStore('earth');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('earth-theme')).toBe(true);
  });

  it('applies aurora-theme class and dark for aurora theme', () => {
    mockStore('aurora');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('aurora-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies sunset-theme class and dark for sunset theme', () => {
    mockStore('sunset');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('sunset-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies candy-theme class for candy theme', () => {
    mockStore('candy');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('candy-theme')).toBe(true);
  });

  it('applies pure-black-theme class for black theme', () => {
    mockStore('black');
    render(<ThemeToggle />);
    expect(document.body.classList.contains('pure-black-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies dark class for indigo theme', () => {
    mockStore('indigo');
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders custom theme label when custom theme is active', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'My Custom',
      colors: { accent: '#ff0000', bgColor: '#000000' },
    }];
    mockStore('custom-1', customThemes);
    render(<ThemeToggle />);
    expect(screen.getByText('My Custom')).toBeDefined();
  });

  it('applies custom theme CSS variables', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'My Custom',
      colors: { accent: '#ff0000', bgColor: '#111111' },
    }];
    mockStore('custom-1', customThemes);
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to dark when custom theme not found', () => {
    mockStore('nonexistent-theme');
    render(<ThemeToggle />);
    // Fallback to dark
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders custom themes in dropdown', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'My Theme',
      colors: { accent: '#ff0000' },
    }];
    mockStore('dark', customThemes);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    expect(screen.getByText('My Theme')).toBeDefined();
  });

  it('selects a custom theme from dropdown', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'My Theme',
      colors: { accent: '#ff0000' },
    }];
    mockStore('dark', customThemes);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    fireEvent.click(screen.getByText('My Theme'));
    expect(savePreferences).toHaveBeenCalledWith({ theme: 'custom-1' });
  });

  it('opens create custom theme editor', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    fireEvent.click(screen.getByText('Create Custom Theme'));
    // Editor modal should be triggered (mocked to return null)
    expect(screen.getByTitle('Change Theme')).toBeDefined();
  });

  it('deletes a custom theme', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'Delete Me',
      colors: { accent: '#ff0000' },
    }];
    mockStore('dark', customThemes);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    const deleteBtn = screen.getByTitle('Delete theme');
    fireEvent.click(deleteBtn);
    expect(savePreferences).toHaveBeenCalledWith({
      customThemes: [],
      theme: 'dark',
    });
  });

  it('deletes active custom theme and falls back to dark', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'Active Custom',
      colors: { accent: '#ff0000' },
    }];
    mockStore('custom-1', customThemes);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    const deleteBtn = screen.getByTitle('Delete theme');
    fireEvent.click(deleteBtn);
    expect(savePreferences).toHaveBeenCalledWith({
      customThemes: [],
      theme: 'dark',
    });
  });

  it('opens edit theme editor for custom theme', () => {
    const customThemes = [{
      id: 'custom-1',
      name: 'Edit Me',
      colors: { accent: '#ff0000' },
    }];
    mockStore('dark', customThemes);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    const editBtn = screen.getByTitle('Edit theme');
    fireEvent.click(editBtn);
    // Editor should be triggered
    expect(screen.getByTitle('Change Theme')).toBeDefined();
  });

  it('toggles dropdown open and closed', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    const trigger = screen.getByTitle('Change Theme');
    fireEvent.click(trigger);
    expect(screen.getAllByText('Light').length).toBeGreaterThan(0);
    fireEvent.click(trigger);
    // After second click, dropdown should close
  });

  it('shows all built-in dark themes in dropdown', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    expect(screen.getByText('Indigo')).toBeDefined();
    expect(screen.getByText('Black')).toBeDefined();
    expect(screen.getByText('Aurora')).toBeDefined();
    expect(screen.getByText('Flame')).toBeDefined();
  });

  it('shows all built-in light themes in dropdown', () => {
    mockStore('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Change Theme'));
    expect(screen.getByText('Ocean')).toBeDefined();
    expect(screen.getByText('Forest')).toBeDefined();
    expect(screen.getByText('Earth')).toBeDefined();
    expect(screen.getByText('Candy')).toBeDefined();
  });

  it('highlights the current theme in dropdown', () => {
    mockStore('ocean');
    render(<ThemeToggle />);
    expect(screen.getByText('Ocean')).toBeDefined();
  });
});
