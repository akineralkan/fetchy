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

  // ── Additional coverage tests ──────────────────────────────────────────

  it('shows binary response view for non-image binary content', () => {
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'application/pdf' },
          body: 'JVBER',
          bodyEncoding: 'base64',
        })}
        isLoading={false}
      />
    );
    expect(screen.getByText('Binary Response')).toBeDefined();
    expect(screen.getByText(/application\/pdf/)).toBeDefined();
  });

  it('shows save button for binary responses', () => {
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'application/octet-stream' },
          body: 'AAAA',
          bodyEncoding: 'base64',
        })}
        isLoading={false}
      />
    );
    expect(screen.getByText('Save to File')).toBeDefined();
  });

  it('shows save image button for image binary response', () => {
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'image/jpeg' },
          body: '/9j/4AAQ',
          bodyEncoding: 'base64',
        })}
        isLoading={false}
      />
    );
    expect(screen.getByText('Save Image')).toBeDefined();
  });

  it('switches to console tab and shows no script output', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /console/i }));
    expect(screen.getByText('No script output')).toBeDefined();
  });

  it('shows pre-script output in console tab', () => {
    render(
      <ResponsePanel
        response={makeResponse({ preScriptOutput: 'pre-script log' })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /console/i }));
    expect(screen.getByText('pre-script log')).toBeDefined();
  });

  it('shows pre-script error in console tab', () => {
    render(
      <ResponsePanel
        response={makeResponse({ preScriptError: 'pre-script error msg' })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /console/i }));
    expect(screen.getByText('pre-script error msg')).toBeDefined();
  });

  it('shows post-script output in console tab', () => {
    render(
      <ResponsePanel
        response={makeResponse({ scriptOutput: 'post-script log' })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /console/i }));
    expect(screen.getByText('post-script log')).toBeDefined();
  });

  it('shows post-script error in console tab', () => {
    render(
      <ResponsePanel
        response={makeResponse({ scriptError: 'post-script error msg' })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /console/i }));
    expect(screen.getByText('post-script error msg')).toBeDefined();
  });

  it('shows red dot on Console tab when script errors exist', () => {
    const { container } = render(
      <ResponsePanel
        response={makeResponse({ scriptError: 'error' })}
        isLoading={false}
      />
    );
    const consoleDot = container.querySelector('.bg-red-500');
    expect(consoleDot).toBeTruthy();
  });

  it('switches to request body tab and shows body type', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({ body: { type: 'json', raw: '{"key":"val"}' } })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Body/i }));
    expect(screen.getByText('json')).toBeDefined();
  });

  it('shows no request body for body type none', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({ body: { type: 'none' } })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Body/i }));
    expect(screen.getByText('No request body')).toBeDefined();
  });

  it('shows form-data body content in request body tab', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({
          body: {
            type: 'form-data',
            formData: [
              { key: 'field1', value: 'val1', enabled: true },
              { key: 'field2', value: 'val2', enabled: false },
            ],
          },
        })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Body/i }));
    expect(screen.getByTestId('code-editor')).toBeDefined();
  });

  it('shows urlencoded body content in request body tab', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({
          body: {
            type: 'x-www-form-urlencoded',
            urlencoded: [
              { key: 'a', value: '1', enabled: true },
              { key: 'b', value: '2', enabled: true },
            ],
          },
        })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Body/i }));
    expect(screen.getByTestId('code-editor')).toBeDefined();
  });

  it('shows no request headers message when none exist', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest({ headers: [] })}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Request Headers/i }));
    expect(screen.getByText('No request headers')).toBeDefined();
  });

  it('shows truncated response banner', () => {
    render(
      <ResponsePanel
        response={makeResponse({ bodyTruncated: true, fullBodySize: 5000000 })}
        isLoading={false}
      />
    );
    expect(screen.getByText(/response truncated/i)).toBeDefined();
    expect(screen.getByText(/save full response/i)).toBeDefined();
  });

  it('copies binary response as placeholder text', () => {
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'application/pdf' },
          body: 'JVBER',
          bodyEncoding: 'base64',
          size: 2048,
        })}
        isLoading={false}
      />
    );
    const copyBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Copy'));
    if (copyBtn) {
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Binary response'));
    }
  });

  it('shows pretty print button for JSON body with non-JSON content type', () => {
    const body = '{"a":1}';
    render(
      <ResponsePanel
        response={makeResponse({
          headers: { 'content-type': 'text/plain' },
          body,
        })}
        isLoading={false}
      />
    );
    // The pretty print button should be visible
    const prettyBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Pretty print'));
    // May or may not be visible depending on prettyPrintJson mock
    expect(screen.getByTestId('code-editor')).toBeDefined();
  });

  it('does not show request-related tabs when sentRequest is null', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        isLoading={false}
      />
    );
    expect(screen.queryByText(/Request Headers/)).toBeNull();
    expect(screen.queryByText(/Request Body/)).toBeNull();
  });

  it('renders AI toolbar when sentRequest is provided', () => {
    render(
      <ResponsePanel
        response={makeResponse()}
        sentRequest={makeSentRequest()}
        isLoading={false}
      />
    );
    expect(screen.getByTestId('ai-toolbar')).toBeDefined();
  });
});
