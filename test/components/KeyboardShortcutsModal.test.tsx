// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import KeyboardShortcutsModal from '../../src/components/KeyboardShortcutsModal';

vi.mock('../../src/hooks/useKeyboardShortcuts', () => ({
  keyboardShortcuts: [
    { description: 'Send request', keys: 'Ctrl+Enter' },
    { description: 'Close tab', keys: 'Ctrl+W' },
    { description: 'New tab', keys: 'Ctrl+T' },
  ],
}));

afterEach(cleanup);

describe('KeyboardShortcutsModal', () => {
  it('renders the modal title', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('renders all shortcuts from keyboardShortcuts', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    expect(screen.getByText('Send request')).toBeDefined();
    expect(screen.getByText('Ctrl+Enter')).toBeDefined();
    expect(screen.getByText('Close tab')).toBeDefined();
    expect(screen.getByText('Ctrl+W')).toBeDefined();
    expect(screen.getByText('New tab')).toBeDefined();
    expect(screen.getByText('Ctrl+T')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button');
    // First button is the X icon, last is "Got it"
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Got it" button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
