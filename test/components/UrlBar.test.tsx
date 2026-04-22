// @vitest-environment jsdom

/**
 * Tests for UrlBar.tsx
 *
 * Covers:
 *  - Renders HTTP method selector with all methods
 *  - Renders URL input with placeholder
 *  - Changing method calls onChange with new method
 *  - Typing a URL calls onChange with new url
 *  - URL with query string parses and syncs params
 *  - Send button is disabled when URL is empty
 *  - Send button enabled when URL is provided
 *  - Clicking Send calls onSend
 *  - isLoading shows Cancel button instead of Send
 *  - Clicking Cancel calls onCancel
 *  - Code dropdown opens/closes
 *  - Selecting a language calls onShowCode
 *  - cURL import flash indicator shown when curlImportFlash=true
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import UrlBar from '../../src/components/request/UrlBar';
import { useAppStore } from '../../src/store/appStore';
import type { HttpMethod, KeyValue } from '../../src/types';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: ({ value, onChange, placeholder, onPaste }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  }) => (
    <input
      data-testid="url-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onPaste={onPaste}
    />
  ),
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'uuid-param') }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function baseStore() {
  return {
    getActiveEnvironment: vi.fn(() => null),
    collections: [],
    tabs: [],
    activeTabId: null,
  };
}

const defaultProps = {
  method: 'GET' as HttpMethod,
  url: 'https://api.example.com/users',
  params: [] as KeyValue[],
  isLoading: false,
  curlImportFlash: false,
  onChange: vi.fn(),
  onPaste: vi.fn(),
  onSend: vi.fn(),
  onCancel: vi.fn(),
  onShowCode: vi.fn(),
};

describe('UrlBar', () => {
  it('renders the HTTP method select with all methods', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('GET');
    expect(options).toContain('POST');
    expect(options).toContain('PUT');
    expect(options).toContain('DELETE');
    expect(options).toContain('PATCH');
    expect(options).toContain('HEAD');
    expect(options).toContain('OPTIONS');
  });

  it('calls onChange with new method when method select changes', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'POST' } });
    expect(onChange).toHaveBeenCalledWith({ method: 'POST' });
  });

  it('renders URL input with the provided URL', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} />);
    const input = screen.getByTestId('url-input') as HTMLInputElement;
    expect(input.value).toBe('https://api.example.com/users');
  });

  it('calls onChange with new URL when the URL input changes (no query string)', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('url-input'), { target: { value: 'https://new.example.com' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://new.example.com' }));
  });

  it('parses query params from URL and includes them in onChange', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('url-input'), {
      target: { value: 'https://api.example.com?foo=bar&baz=qux' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          expect.objectContaining({ key: 'foo', value: 'bar' }),
          expect.objectContaining({ key: 'baz', value: 'qux' }),
        ]),
      })
    );
  });

  it('Send button is enabled when URL is provided', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('Send button is disabled when URL is empty', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} url="" />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSend when Send button is clicked', () => {
    const onSend = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalled();
  });

  it('shows Cancel button when isLoading=true', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} isLoading />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} isLoading onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows Code dropdown when Code button is clicked', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /code/i }));
    expect(screen.getByText('cURL')).toBeTruthy();
    expect(screen.getByText('JavaScript')).toBeTruthy();
    expect(screen.getByText('Python')).toBeTruthy();
  });

  it('calls onShowCode with language id when a language is selected', () => {
    const onShowCode = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} onShowCode={onShowCode} />);
    fireEvent.click(screen.getByRole('button', { name: /code/i }));
    fireEvent.click(screen.getByText('Python'));
    expect(onShowCode).toHaveBeenCalledWith('python');
  });

  it('shows cURL import flash indicator when curlImportFlash=true', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<UrlBar {...defaultProps} curlImportFlash />);
    expect(screen.getByText(/curl imported successfully/i)).toBeTruthy();
  });
});
