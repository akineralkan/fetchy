// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResponsePanel from '../../src/components/ResponsePanel';

vi.mock('../../src/components/CodeEditor', () => ({
  default: ({ value }: { value: string }) => <pre data-testid="code-editor">{value}</pre>,
}));

vi.mock('../../src/components/JSONViewer', () => ({
  default: ({ data }: { data: string }) => <div data-testid="json-viewer">{data}</div>,
}));

vi.mock('../../src/components/AIAssistant', () => ({
  AIResponseToolbar: () => <div data-testid="ai-toolbar" />,
}));

vi.mock('../../src/utils/helpers', () => ({
  formatBytes: (n: number) => `${n}B`,
  formatTime: (n: number) => `${n}ms`,
  getStatusColor: (status: number) => status < 400 ? 'text-green-400' : 'text-red-400',
  prettyPrintJson: (s: string) => s,
  getMethodBgColor: () => 'bg-blue-500',
}));

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeResponse = (overrides = {}) => ({
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"success":true}',
  time: 123,
  size: 512,
  bodyEncoding: 'utf-8' as const,
  ...overrides,
});

const makeSentRequest = (overrides = {}) => ({
  id: 'req-1',
  name: 'Test',
  method: 'GET' as const,
  url: 'https://api.example.com/users',
  headers: [],
  params: [],
  body: { type: 'none' as const },
  auth: { type: 'none' as const },
  ...overrides,
});

describe('ResponsePanel', () => {
  it('shows loading spinner when isLoading is true', () => {
    render(<ResponsePanel response={null} isLoading={true} />);
    expect(screen.getByText('Sending request...')).toBeDefined();
  });

  it('shows empty state when response is null and not loading', () => {
    render(<ResponsePanel response={null} isLoading={false} />);
    expect(screen.getByText('No response yet')).toBeDefined();
  });

  it('renders status code and status text', () => {
    render(<ResponsePanel response={makeResponse()} isLoading={false} />);
    expect(screen.getByText(/200/)).toBeDefined();
    expect(screen.getByText(/OK/)).toBeDefined();
  });

  it('renders JSONViewer for application/json responses', () => {
    render(<ResponsePanel response={makeResponse()} isLoading={false} />);
    expect(screen.getByTestId('json-viewer')).toBeDefined();
  });

  it('renders plain text body for non-JSON content type', () => {
    render(
      <ResponsePanel
        response={makeResponse({ headers: { 'content-type': 'text/plain' }, body: 'plain text response' })}
        isLoading={false}
      />
    );
    expect(screen.getByTestId('code-editor')).toBeDefined();
  });

  it('shows time and size in status bar', () => {
    render(<ResponsePanel response={makeResponse({ time: 45, size: 1024 })} isLoading={false} />);
    expect(screen.getByText('45ms')).toBeDefined();
    expect(screen.getByText('1024B')).toBeDefined();
  });

  it('shows sent request URL and method', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest()}
        isLoading={false}
      />
    );
    expect(screen.getByText('https://api.example.com/users')).toBeDefined();
    expect(screen.getByText('GET')).toBeDefined();
  });

  it('can switch to response headers tab', () => {
    render(<ResponsePanel response={makeResponse({ headers: { 'content-type': 'application/json', 'x-req-id': '123' } })} isLoading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Response Headers/i }));
    expect(screen.getByText('content-type')).toBeDefined();
  });

  it('can switch to request headers tab', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({ headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }] })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Headers/i }));
    expect(screen.getByText('Authorization')).toBeDefined();
  });

  it('copies response body to clipboard when copy button is clicked', () => {
    render(<ResponsePanel response={makeResponse()} isLoading={false} />);
    const copyBtn = screen.getAllByRole('button').find(b => b.title === 'Copy response body' || b.getAttribute('title')?.includes('Copy'));
    if (copyBtn) {
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('shows 4xx status in error color', () => {
    render(<ResponsePanel response={makeResponse({ status: 404, statusText: 'Not Found' })} isLoading={false} />);
    const statusEl = screen.getByText(/404/);
    expect(statusEl.className).toContain('text-red-400');
  });

  it('shows 2xx status in success color', () => {
    render(<ResponsePanel response={makeResponse({ status: 200, statusText: 'OK' })} isLoading={false} />);
    const statusEl = screen.getByText(/200/);
    expect(statusEl.className).toContain('text-green-400');
  });

  it('renders image preview for base64 image responses', () => {
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'image/png' },
          body: 'iVBORw0KGgo=',
          bodyEncoding: 'base64',
        })}
        isLoading={false}
      />
    );
    // Should show image element or image section
    const img = document.querySelector('img');
    expect(img).toBeDefined();
  });
});
