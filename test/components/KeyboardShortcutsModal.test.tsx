// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import KeyboardShortcutsModal from '../../src/components/KeyboardShortcutsModal';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(() => ({
    preferences: { keyboardShortcuts: undefined },
    updateKeyboardShortcuts: vi.fn().mockResolvedValue(undefined),
  })),
}));

afterEach(cleanup);

describe('KeyboardShortcutsModal', () => {
  it('renders the modal title', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('renders all shortcuts from SHORTCUT_ACTIONS', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    // Verify action labels are displayed
    expect(screen.getByText('New Request')).toBeDefined();
    expect(screen.getByText('Save Request')).toBeDefined();
    expect(screen.getByText('Close Tab')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button');
    // First button is the X icon
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Done" button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
