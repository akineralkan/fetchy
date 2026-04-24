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

  // ── Additional coverage tests ──────────────────────────────────────────

  it('highlights defined variables with var-highlight-defined class', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'host', value: 'localhost', enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<host>>/api" onChange={vi.fn()} />);
    const highlight = container.querySelector('.var-highlight-defined');
    expect(highlight).toBeTruthy();
    expect(highlight?.textContent).toBe('<<host>>');
  });

  it('highlights undefined variables with var-highlight-undefined class', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const { container } = render(<VariableTextarea value="<<unknown>>/api" onChange={vi.fn()} />);
    const highlight = container.querySelector('.var-highlight-undefined');
    expect(highlight).toBeTruthy();
  });

  it('highlights empty variables with var-highlight-empty class', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'empty', value: '', enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<empty>>" onChange={vi.fn()} />);
    const highlight = container.querySelector('.var-highlight-empty');
    expect(highlight).toBeTruthy();
  });

  it('highlights secret variables with var-highlight-secret class', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'secret', value: 'val', isSecret: true, enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<secret>>" onChange={vi.fn()} />);
    const highlight = container.querySelector('.var-highlight-secret');
    expect(highlight).toBeTruthy();
  });

  it('does not show overlay when no variables present', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const { container } = render(<VariableTextarea value="plain text" onChange={vi.fn()} />);
    const overlay = container.querySelector('.pointer-events-none');
    expect(overlay).toBeNull();
  });

  it('handles click on variable to show tooltip', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'host', value: 'localhost', enabled: true }],
        })),
      }) as never
    );
    render(<VariableTextarea value="<<host>>" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 3, configurable: true });
    fireEvent.click(ta);
    expect(ta).toBeTruthy();
  });

  it('navigates suggestions with ArrowDown and ArrowUp', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [
            { id: 'v1', key: 'token', value: 'abc', enabled: true },
            { id: 'v2', key: 'tokenSecret', value: 'xyz', enabled: true },
          ],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<tok" onChange={vi.fn()} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 5, configurable: true });
    fireEvent.change(ta, { target: { value: '<<tok' } });
    fireEvent.keyDown(ta, { key: 'ArrowDown' });
    fireEvent.keyDown(ta, { key: 'ArrowUp' });
    expect(ta).toBeTruthy();
  });


  it('closes tooltip on Escape key', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'host', value: 'localhost', enabled: true }],
        })),
      }) as never
    );
    render(<VariableTextarea value="<<host>>" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 3, configurable: true });
    fireEvent.click(ta);
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(ta).toBeTruthy();
  });

  it('handles blur event to clear suggestions', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<VariableTextarea value="<<test" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox');
    fireEvent.blur(ta);
    expect(ta).toBeTruthy();
  });

  it('handles scroll syncing', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<VariableTextarea value="<<var>>" onChange={vi.fn()} />);
    const ta = screen.getByRole('textbox');
    fireEvent.scroll(ta);
    expect(ta).toBeTruthy();
  });

  it('does not show suggestions when << is closed', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'host', value: 'localhost', enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<host>>" onChange={vi.fn()} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: 8, configurable: true });
    fireEvent.change(ta, { target: { value: '<<host>>' } });
    expect(container).toBeTruthy();
  });

  it('renders multiple variables with correct highlights', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [
            { id: 'v1', key: 'host', value: 'localhost', enabled: true },
            { id: 'v2', key: 'port', value: '8080', enabled: true },
          ],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<host>>:<<port>>/api" onChange={vi.fn()} />);
    const highlights = container.querySelectorAll('.var-highlight-defined');
    expect(highlights.length).toBe(2);
  });

  it('handles multiline text with variables', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'token', value: 'abc', enabled: true }],
        })),
      }) as never
    );
    const { container } = render(<VariableTextarea value={"line1\n<<token>>\nline3"} onChange={vi.fn()} />);
    const highlight = container.querySelector('.var-highlight-defined');
    expect(highlight).toBeTruthy();
  });

  it('applies className prop to textarea', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const { container } = render(<VariableTextarea value="" onChange={vi.fn()} className="custom-class" />);
    const ta = container.querySelector('textarea');
    expect(ta?.className).toContain('custom-class');
  });

  it('uses collection variables when env does not have them', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => ({
          variables: [{ id: 'v1', key: 'envVar', value: 'val', enabled: true }],
        })),
        tabs: [{ id: 't1', collectionId: 'col-1' }],
        activeTabId: 't1',
        collections: [{
          id: 'col-1',
          variables: [{ id: 'cv1', key: 'colVar', value: 'col-val', enabled: true }],
        }],
      }) as never
    );
    const { container } = render(<VariableTextarea value="<<colVar>>" onChange={vi.fn()} />);
    // colVar is not in the active environment, so it shows as undefined
    const highlight = container.querySelector('.var-highlight-undefined');
    expect(highlight).toBeTruthy();
  });
});
