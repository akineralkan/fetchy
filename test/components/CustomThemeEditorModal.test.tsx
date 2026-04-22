// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import CustomThemeEditorModal from '../../src/components/CustomThemeEditorModal';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CustomThemeEditorModal', () => {
  it('stays hidden when the modal is closed', () => {
    const { container } = render(
      <CustomThemeEditorModal
        isOpen={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('validates the name, applies presets, and saves a new custom theme', () => {
    const onSave = vi.fn();
    const { container } = render(
      <CustomThemeEditorModal
        isOpen
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /create theme/i }));
    expect(screen.getByText('Theme name is required')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('My Custom Theme'), {
      target: { value: 'Sunny Day' },
    });
    fireEvent.click(screen.getByRole('button', { name: /light/i }));

    expect(screen.getAllByDisplayValue('#e6e6e9').length).toBeGreaterThan(0);

    const textInputs = Array.from(container.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
    const bgHexInput = textInputs.find((input) => input.value === '#e6e6e9') as HTMLInputElement;

    fireEvent.change(bgHexInput, { target: { value: '#123456' } });
    expect(screen.getAllByDisplayValue('#123456').length).toBeGreaterThan(0);

    fireEvent.change(bgHexInput, { target: { value: '#12345G' } });
    expect(screen.queryByDisplayValue('#12345G')).toBeNull();
    expect(screen.getAllByDisplayValue('#123456').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /create theme/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^custom-/),
        name: 'Sunny Day',
        colors: expect.objectContaining({
          bgColor: '#123456',
        }),
      }),
    );
  });

  it('loads an existing theme, backfills missing AI colors, and preserves the id on save', () => {
    const onSave = vi.fn();
    const editingTheme = {
      id: 'custom-existing',
      name: 'Legacy Theme',
      colors: {
        bgColor: '#101010',
        sidebarColor: '#111111',
        cardColor: '#121212',
        textColor: '#f0f0f0',
        textMuted: '#909090',
        borderColor: '#232323',
        hoverBg: '#2a2a2a',
        inputBg: '#1a1a1a',
        accent: '#333333',
        accentHover: '#444444',
        tabBarBg: '#151515',
        tabActiveBg: '#181818',
        dropdownBg: '#202020',
        modalBg: '#191919',
        tooltipBg: '#212121',
        separatorColor: '#313131',
        successColor: '#22aa22',
        warningColor: '#cc8800',
        errorColor: '#bb3333',
      },
    } as any;

    render(
      <CustomThemeEditorModal
        isOpen
        editingTheme={editingTheme}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Legacy Theme')).toBeTruthy();
    expect(screen.getAllByDisplayValue('#9070b0').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('#c49030').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByDisplayValue('Legacy Theme'), {
      target: { value: 'Legacy Theme Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'custom-existing',
        name: 'Legacy Theme Updated',
        colors: expect.objectContaining({
          aiColor: '#9070b0',
          highlightColor: '#c49030',
        }),
      }),
    );
  });

  it('cancels the editor from both dismiss actions', () => {
    const onCancel = vi.fn();

    const { rerender } = render(
      <CustomThemeEditorModal
        isOpen
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <CustomThemeEditorModal
        isOpen
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});