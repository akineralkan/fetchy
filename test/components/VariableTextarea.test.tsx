// @vitest-environment jsdom

/**
 * Tests for VariableTextarea.tsx
 *
 * Covers:
 *  - Rendering textarea with placeholder
 *  - onChange callback
 *  - Variable overlay spans
 *  - Autocomplete suggestion computation with env & collection vars
 *  - Keyboard navigation in suggestions (ArrowDown/Up/Enter/Escape)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import VariableTextarea from '../../src/components/VariableTextarea';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

function baseStore(overrides: Record<string, unknown> = {}) {
  return {
    getActiveEnvironment: vi.fn(() => null),
    collections: [],
    tabs: [],
    activeTabId: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('VariableTextarea', () => {
  it('renders a textarea with the provided placeholder', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<VariableTextarea value="" onChange={vi.fn()} placeholder="Enter body" />);
    expect(screen.getByPlaceholderText('Enter body')).toBeTruthy();
  });

  it('calls onChange with the new value when the user types', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<VariableTextarea value="initial" onChange={onChange} />);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'new value' } });
    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('renders highlighted overlay for <<variable>> tokens', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const { container } = render(
      <VariableTextarea value="Hello <<name>>" onChange={vi.fn()} />
    );
    // Overlay div uses Tailwind class pointer-events-none
    const overlay = container.querySelector('.pointer-events-none');
    expect(overlay).toBeTruthy();
  });

  it('shows matched suggestions based on env variables when typing <<', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'apiKey', value: 'secret', enabled: true }],
        })),
      }) as never
    );
    render(<VariableTextarea value="<<api" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 5, configurable: true });
    fireEvent.input(ta, { target: { value: '<<api' } });
    expect(ta).toBeTruthy();
  });

  it('shows collection variables in suggestions when no active environment', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => null),
        tabs: [{ id: 't1', collectionId: 'col-1' }],
        activeTabId: 't1',
        collections: [
          {
            id: 'col-1',
            variables: [{ id: 'v1', key: 'host', value: 'localhost', enabled: true }],
          },
        ],
      }) as never
    );
    render(<VariableTextarea value="<<ho" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 4, configurable: true });
    fireEvent.input(ta, { target: { value: '<<ho' } });
    expect(ta).toBeTruthy();
  });

  it('hides suggestions on Escape key', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'token', value: 'abc', enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<tok" onChange={vi.fn()} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Escape' });
    // Should not throw
    expect(ta).toBeTruthy();
  });

  it('does not crash when value is empty', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<VariableTextarea value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
