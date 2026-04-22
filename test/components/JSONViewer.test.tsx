// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import JSONViewer from '../../src/components/JSONViewer';

vi.mock('../../src/components/JWTTooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <span data-testid="jwt-tooltip">{children}</span>,
}));

vi.mock('../../src/utils/helpers', () => ({
  isJWT: (val: string) => val === 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig',
  decodeJWT: () => ({ header: {}, payload: {}, signature: '', raw: '' }),
}));

afterEach(cleanup);

describe('JSONViewer', () => {
  it('shows loading indicator for large JSON bodies initially', () => {
    const bigJson = JSON.stringify({ a: 'x'.repeat(400_000) });
    render(<JSONViewer data={bigJson} />);
    // Large bodies render a "Render Tree" button
    expect(screen.getByRole('button', { name: /Render Tree/i })).toBeDefined();
  });

  it('renders a null value', () => {
    render(<JSONViewer data="null" />);
    expect(screen.getByText('null')).toBeDefined();
  });

  it('renders a string value', () => {
    render(<JSONViewer data={'"hello world"'} />);
    expect(screen.getByText(/"hello world"/)).toBeDefined();
  });

  it('renders a number value', () => {
    render(<JSONViewer data="42" />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('renders a boolean true value', () => {
    render(<JSONViewer data="true" />);
    expect(screen.getByText('true')).toBeDefined();
  });

  it('renders a boolean false value', () => {
    render(<JSONViewer data="false" />);
    expect(screen.getByText('false')).toBeDefined();
  });

  it('renders simple object with key-value pairs', () => {
    render(<JSONViewer data='{"name":"Alice","age":30}' />);
    expect(screen.getByText('"name"')).toBeDefined();
    expect(screen.getByText(/"Alice"/)).toBeDefined();
    expect(screen.getByText('"age"')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
  });

  it('renders array with items', () => {
    render(<JSONViewer data='[1,2,3]' />);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('collapses and expands a node', async () => {
    render(<JSONViewer data='{"key":"value"}' />);
    const collapseButton = screen.getByLabelText('Collapse');
    fireEvent.click(collapseButton);
    // After collapsing, should show item count
    expect(screen.getByText(/1 key/)).toBeDefined();

    // Click the count text to expand
    fireEvent.click(screen.getByText(/1 key/));
    expect(screen.getByText('"key"')).toBeDefined();
  });

  it('renders empty object without crash', () => {
    render(<JSONViewer data="{}" />);
    expect(screen.getByText('{}')).toBeDefined();
  });

  it('renders empty array without crash', () => {
    render(<JSONViewer data="[]" />);
    expect(screen.getByText('[]')).toBeDefined();
  });

  it('truncates very long strings', () => {
    const longStr = JSON.stringify('a'.repeat(600));
    render(<JSONViewer data={longStr} />);
    expect(screen.getByText(/\.\.\."/)).toBeDefined();
  });

  it('falls back to raw text for invalid JSON', () => {
    render(<JSONViewer data="not valid json" />);
    expect(screen.getByText('not valid json')).toBeDefined();
  });

  it('auto-collapses large arrays', () => {
    const arr = JSON.stringify(Array.from({ length: 60 }, (_, i) => i));
    render(<JSONViewer data={arr} />);
    // The array should be collapsed (showing item count)
    expect(screen.getByText(/60 items/)).toBeDefined();
  });
});
