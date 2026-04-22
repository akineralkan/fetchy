// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportModal from '../../src/components/ExportModal';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/utils/helpers', () => ({
  exportToPostman: vi.fn(() => '{"postman":"collection"}'),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const onClose = vi.fn();

function mockCollections(collections: unknown[]) {
  vi.mocked(useAppStore).mockReturnValue({
    collections,
  } as ReturnType<typeof useAppStore>);
}

const makeCollection = (id: string, name: string, requests: unknown[] = [], folders: unknown[] = []) => ({
  id,
  name,
  requests,
  folders,
});

describe('ExportModal', () => {
  it('shows empty state when no collections exist', () => {
    mockCollections([]);
    render(<ExportModal onClose={onClose} />);
    expect(screen.getByText('No collections to export')).toBeDefined();
  });

  it('renders collection selector with available collections', () => {
    mockCollections([
      makeCollection('c1', 'My API', [{ id: 'r1' }]),
      makeCollection('c2', 'Other API'),
    ]);
    render(<ExportModal onClose={onClose} />);
    expect(screen.getByRole('option', { name: /My API/ })).toBeDefined();
    expect(screen.getByRole('option', { name: /Other API/ })).toBeDefined();
  });

  it('pre-selects the passed collectionId', () => {
    mockCollections([
      makeCollection('c1', 'First'),
      makeCollection('c2', 'Second'),
    ]);
    render(<ExportModal onClose={onClose} collectionId="c2" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('c2');
  });

  it('renders Postman format info', () => {
    mockCollections([makeCollection('c1', 'My API')]);
    render(<ExportModal onClose={onClose} />);
    expect(screen.getByText('Postman')).toBeDefined();
    expect(screen.getByText('v2.1 compatible')).toBeDefined();
  });

  it('calls onClose when Cancel is clicked', () => {
    mockCollections([makeCollection('c1', 'My API')]);
    render(<ExportModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a download and shows success message on export', async () => {
    mockCollections([makeCollection('c1', 'My API')]);

    // Mock anchor click to prevent jsdom navigation
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURL = vi.fn(() => 'blob:url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    render(<ExportModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));

    await waitFor(() => expect(screen.getByText(/Successfully exported/)).toBeDefined());
    expect(createObjectURL).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('export button is disabled when no collection is selected', () => {
    mockCollections([]);
    render(<ExportModal onClose={onClose} />);
    const exportBtn = screen.getByRole('button', { name: /Export/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onClose when header X button is clicked', () => {
    mockCollections([makeCollection('c1', 'My API')]);
    render(<ExportModal onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    // X button is first (before Cancel and Export)
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('updates selected collection when dropdown changes', () => {
    mockCollections([
      makeCollection('c1', 'First'),
      makeCollection('c2', 'Second'),
    ]);
    render(<ExportModal onClose={onClose} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'c2' } });
    expect(select.value).toBe('c2');
  });
});
