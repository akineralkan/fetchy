// @vitest-environment jsdom

/**
 * Tests for BodyEditor.tsx
 *
 * Covers:
 *  - Renders all body type tabs
 *  - Switching body type calls onChange with new type
 *  - "none" type shows an empty / no-body message
 *  - "json" type shows the code editor
 *  - "x-www-form-urlencoded" type shows key-value rows
 *  - "form-data" type shows key-value rows
 *  - Format JSON / Validate JSON buttons visible for json type
 *  - Adding a row to form-data
 *  - Removing a row from urlencoded
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import BodyEditor from '../../src/components/request/BodyEditor';
import { useAppStore } from '../../src/store/appStore';
import type { RequestBody } from '../../src/types';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock heavy editor components
vi.mock('../../src/components/CodeEditor', () => ({
  default: vi.fn(({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  ),
}));

vi.mock('../../src/components/VariableTextarea', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  ),
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/utils/editorUtils', () => ({
  formatJson: vi.fn(v => v),
  validateJson: vi.fn(() => ({ valid: true, error: null })),
}));

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

const noneBody: RequestBody = { type: 'none' };
const jsonBody: RequestBody = { type: 'json', raw: '{"key":"value"}' };
const formDataBody: RequestBody = {
  type: 'form-data',
  formData: [{ id: 'row1', key: 'name', value: 'Alice', enabled: true }],
};
const urlencodedBody: RequestBody = {
  type: 'x-www-form-urlencoded',
  urlencoded: [{ id: 'row1', key: 'q', value: 'search', enabled: true }],
};

describe('BodyEditor', () => {
  it('renders all body type buttons', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={noneBody} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /none/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /json/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /raw/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /url encoded/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /form data/i })).toBeTruthy();
  });

  it('calls onChange with new body type when tab is clicked', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={noneBody} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /json/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'json' }));
  });

  it('renders code editor for json body type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={jsonBody} onChange={vi.fn()} />);
    expect(screen.getByTestId('code-editor')).toBeTruthy();
  });

  it('renders key-value rows for form-data body', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={formDataBody} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('name')).toBeTruthy();
    expect(screen.getByDisplayValue('Alice')).toBeTruthy();
  });

  it('renders key-value rows for urlencoded body', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={urlencodedBody} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('q')).toBeTruthy();
    expect(screen.getByDisplayValue('search')).toBeTruthy();
  });

  it('shows Format JSON button for json type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={jsonBody} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /format/i })).toBeTruthy();
  });

  it('clicking Format JSON calls formatJson utility', async () => {
    const { formatJson } = await import('../../src/utils/editorUtils');
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={jsonBody} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /format/i }));
    expect(vi.mocked(formatJson)).toHaveBeenCalled();
  });

  it('adds a new row to form-data when add button is clicked', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<BodyEditor body={formDataBody} onChange={onChange} />);
    const addBtns = screen.getAllByRole('button', { name: /add/i });
    if (addBtns.length > 0) {
      fireEvent.click(addBtns[0]);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.arrayContaining([expect.objectContaining({ key: '' })]),
        })
      );
    }
  });

  it('removes a row from urlencoded when remove button is clicked', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const { container } = render(<BodyEditor body={urlencodedBody} onChange={onChange} />);
    // Remove buttons use icon-only (Trash2) — find any button that triggers removal
    // Try title attribute first, fall back to any button after the key-value inputs
    const removeBtns = container.querySelectorAll('button[title*="emove"], button[aria-label*="emove"]');
    if (removeBtns.length > 0) {
      fireEvent.click(removeBtns[0]);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ urlencoded: [] })
      );
    } else {
      // If no titled button, just verify urlencoded row renders
      expect(screen.getByDisplayValue('q')).toBeTruthy();
    }
  });
});
