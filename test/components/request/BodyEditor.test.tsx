// @vitest-environment jsdom

/**
 * Tests for src/components/request/BodyEditor.tsx
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: vi.fn(() => ({
    getActiveEnvironment: vi.fn(() => null),
    collections: [],
    tabs: [],
    activeTabId: null,
  })),
}));

vi.mock('../../../src/utils/editorUtils', () => ({
  formatJson: vi.fn((val: string) => {
    try { return JSON.stringify(JSON.parse(val), null, 2); } catch { return val; }
  }),
  validateJson: vi.fn((val: string) => {
    try { JSON.parse(val); return { valid: true }; } catch (e: any) { return { valid: false, error: e.message }; }
  }),
}));

vi.mock('../../../src/components/CodeEditor', () => ({
  default: vi.fn(({ value, onChange }: any) => (
    <textarea data-testid="code-editor" value={value} onChange={(e: any) => onChange(e.target.value)} />
  )),
}));

vi.mock('../../../src/components/VariableInput', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <input data-testid="variable-input" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} />
  ),
}));

vi.mock('../../../src/components/VariableTextarea', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <textarea data-testid="variable-textarea" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} />
  ),
}));

vi.mock('../../../src/components/Tooltip', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span>+</span>,
  Trash2: () => <span>×</span>,
  Braces: () => <span>B</span>,
  ShieldCheck: () => <span>S</span>,
  CheckCircle2: () => <span>✓</span>,
  AlertCircle: () => <span>!</span>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Dynamic import to ensure mocks take effect
async function importBodyEditor() {
  const mod = await import('../../../src/components/request/BodyEditor');
  return mod.default;
}

describe('BodyEditor', () => {
  it('renders body type buttons', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'none' } as any} onChange={vi.fn()} />);
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('JSON')).toBeTruthy();
    expect(screen.getByText('Raw')).toBeTruthy();
    expect(screen.getByText('URL Encoded')).toBeTruthy();
    expect(screen.getByText('Form Data')).toBeTruthy();
  });

  it('shows "no body" message when type is none', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'none' } as any} onChange={vi.fn()} />);
    expect(screen.getByText('This request does not have a body')).toBeTruthy();
  });

  it('switches body type when button clicked', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(<BodyEditor body={{ type: 'none' } as any} onChange={onChange} />);
    fireEvent.click(screen.getByText('JSON'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'json' }));
  });

  it('renders code editor for JSON body', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'json', raw: '{"key":"value"}' } as any} onChange={vi.fn()} />);
    expect(screen.getByTestId('code-editor')).toBeTruthy();
  });

  it('renders textarea for raw body', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'raw', raw: 'hello' } as any} onChange={vi.fn()} />);
    expect(screen.getByTestId('variable-textarea')).toBeTruthy();
  });

  it('renders key-value table for urlencoded body', async () => {
    const BodyEditor = await importBodyEditor();
    render(
      <BodyEditor
        body={{
          type: 'x-www-form-urlencoded',
          urlencoded: [{ id: '1', key: 'name', value: 'test', enabled: true }],
        } as any}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('name')).toBeTruthy();
    expect(screen.getByDisplayValue('test')).toBeTruthy();
  });

  it('renders key-value table for form-data body', async () => {
    const BodyEditor = await importBodyEditor();
    render(
      <BodyEditor
        body={{
          type: 'form-data',
          formData: [{ id: '1', key: 'file', value: 'data', enabled: true }],
        } as any}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('file')).toBeTruthy();
  });

  it('shows Format and Validate buttons for JSON body', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'json', raw: '{}' } as any} onChange={vi.fn()} />);
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Validate')).toBeTruthy();
  });

  it('does not show Format/Validate for non-JSON body types', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'raw', raw: 'text' } as any} onChange={vi.fn()} />);
    expect(screen.queryByText('Format')).toBeNull();
    expect(screen.queryByText('Validate')).toBeNull();
  });

  it('calls onChange on code editor change for JSON body', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(<BodyEditor body={{ type: 'json', raw: '{}' } as any} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('code-editor'), { target: { value: '{"new":true}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: '{"new":true}' }));
  });

  it('calls onChange on raw textarea change', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(<BodyEditor body={{ type: 'raw', raw: '' } as any} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('variable-textarea'), { target: { value: 'new value' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: 'new value' }));
  });

  it('adds a new field to urlencoded table', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(
      <BodyEditor
        body={{ type: 'x-www-form-urlencoded', urlencoded: [] } as any}
        onChange={onChange}
      />
    );
    const addBtn = screen.getByText('Add Field').closest('button')!;
    fireEvent.click(addBtn);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        urlencoded: [expect.objectContaining({ key: '', value: '', enabled: true })],
      })
    );
  });

  it('removes a field from urlencoded table', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(
      <BodyEditor
        body={{
          type: 'x-www-form-urlencoded',
          urlencoded: [{ id: '1', key: 'a', value: 'b', enabled: true }],
        } as any}
        onChange={onChange}
      />
    );
    // Click the delete button (×)
    const deleteBtn = screen.getByText('×').closest('button')!;
    fireEvent.click(deleteBtn);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ urlencoded: [] })
    );
  });

  it('toggles checkbox in urlencoded table', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(
      <BodyEditor
        body={{
          type: 'x-www-form-urlencoded',
          urlencoded: [{ id: '1', key: 'a', value: 'b', enabled: true }],
        } as any}
        onChange={onChange}
      />
    );
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        urlencoded: [expect.objectContaining({ enabled: false })],
      })
    );
  });

  it('updates key in urlencoded table', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(
      <BodyEditor
        body={{
          type: 'x-www-form-urlencoded',
          urlencoded: [{ id: '1', key: 'oldkey', value: 'v', enabled: true }],
        } as any}
        onChange={onChange}
      />
    );
    const keyInput = screen.getByDisplayValue('oldkey');
    fireEvent.change(keyInput, { target: { value: 'newkey' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        urlencoded: [expect.objectContaining({ key: 'newkey' })],
      })
    );
  });

  it('highlights active body type button', async () => {
    const BodyEditor = await importBodyEditor();
    render(<BodyEditor body={{ type: 'json', raw: '' } as any} onChange={vi.fn()} />);
    const jsonBtn = screen.getByText('JSON');
    expect(jsonBtn.className).toContain('bg-fetchy-accent');
    const noneBtn = screen.getByText('None');
    expect(noneBtn.className).not.toContain('bg-fetchy-accent');
  });

  it('adds a new field to form-data table', async () => {
    const BodyEditor = await importBodyEditor();
    const onChange = vi.fn();
    render(
      <BodyEditor
        body={{ type: 'form-data', formData: [] } as any}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Add Field').closest('button')!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: [expect.objectContaining({ key: '', value: '', enabled: true })],
      })
    );
  });
});
