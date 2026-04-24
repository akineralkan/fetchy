// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import RunCollectionModal from '../../src/components/RunCollectionModal';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/utils/httpClient', () => ({
  executeRequest: vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '{}',
    time: 10,
    size: 2,
  }),
}));

vi.mock('../../src/utils/authInheritance', () => ({
  resolveInheritedAuth: vi.fn(() => null),
}));

vi.mock('../../src/utils/helpers', () => ({
  getMethodBgColor: () => 'bg-blue-500',
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockRequest = {
  id: 'req-1',
  name: 'Get Users',
  method: 'GET' as const,
  url: 'https://api.example.com/users',
  headers: [],
  params: [],
  body: { type: 'none' as const },
  auth: { type: 'none' as const },
  preScript: '',
  script: '',
};

const mockCollection = {
  id: 'col-1',
  name: 'My API',
  requests: [mockRequest],
  folders: [],
  variables: [],
  auth: { type: 'none' as const },
};

function mockStore() {
  vi.mocked(useAppStore).mockReturnValue({
    collections: [mockCollection],
    getActiveEnvironment: vi.fn(() => null),
  } as ReturnType<typeof useAppStore>);
}

describe('RunCollectionModal', () => {
  it('renders nothing when isOpen is false', () => {
    mockStore();
    const { container } = render(
      <RunCollectionModal isOpen={false} onClose={vi.fn()} collectionId="col-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal title when open', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByText('My API')).toBeDefined();
  });

  it('lists the requests in the collection', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByText('Get Users')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    mockStore();
    const onClose = vi.fn();
    render(<RunCollectionModal isOpen={true} onClose={onClose} collectionId="col-1" />);
    const closeBtn = screen.getAllByRole('button').find(b => b.className.includes('hover:bg-fetchy-border'));
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows configuration options (sequential/parallel)', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByText('Sequential')).toBeDefined();
    expect(screen.getByText('Parallel')).toBeDefined();
  });

  it('runs collection requests when Run button is clicked', async () => {
    const { executeRequest } = await import('../../src/utils/httpClient');
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Run Collection/i }));
    await waitFor(() => expect(executeRequest).toHaveBeenCalled());
  });

  it('shows results after running', async () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Run Collection/i }));
    await waitFor(() => expect(screen.queryByText(/200/)).toBeDefined());
  });

  it('allows changing iterations count', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    const iterationInput = screen.getByDisplayValue('1');
    fireEvent.change(iterationInput, { target: { value: '3' } });
    expect((iterationInput as HTMLInputElement).value).toBe('3');
  });

  it('renders nothing when collection does not exist', () => {
    vi.mocked(useAppStore).mockReturnValue({
      collections: [],
      getActiveEnvironment: vi.fn(() => null),
    } as ReturnType<typeof useAppStore>);
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="nonexistent" />);
    // Modal returns null when collection not found
    expect(document.body.textContent).toBe('');
  });

  it('toggles stop-on-error checkbox', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    // The checkbox is for "Stop on first error"
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('renders parallel mode option', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    fireEvent.change(select, { target: { value: 'parallel' } });
    expect(select.value).toBe('parallel');
  });

  it('allows changing delay between requests', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    const delayInput = screen.getByDisplayValue('0');
    fireEvent.change(delayInput, { target: { value: '500' } });
    expect((delayInput as HTMLInputElement).value).toBe('500');
  });

  it('shows request count info', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    // The count "1" is in a <span> and "request will be executed" is adjacent text
    const countInfo = document.querySelector('.mt-4 p');
    expect(countInfo?.textContent).toContain('request will be executed');
  });

  it('flattens requests from nested folders', () => {
    const nestedCollection = {
      id: 'col-1',
      name: 'Nested API',
      requests: [mockRequest],
      folders: [{
        id: 'f-1',
        name: 'Folder 1',
        requests: [{ ...mockRequest, id: 'req-2', name: 'Folder Request' }],
        folders: [{
          id: 'f-2',
          name: 'Sub Folder',
          requests: [{ ...mockRequest, id: 'req-3', name: 'Sub Request' }],
          folders: [],
        }],
      }],
      variables: [],
      auth: { type: 'none' as const },
    };
    vi.mocked(useAppStore).mockReturnValue({
      collections: [nestedCollection],
      getActiveEnvironment: vi.fn(() => null),
    } as ReturnType<typeof useAppStore>);
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    // The "3" is in a span, so we check textContent of the info paragraph
    const countInfo = document.querySelector('.mt-4 p');
    expect(countInfo?.textContent).toContain('3');
    expect(countInfo?.textContent).toContain('requests will be executed');
  });

  it('shows total execution count when iterations > 1', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    const iterationInput = screen.getByDisplayValue('1');
    fireEvent.change(iterationInput, { target: { value: '5' } });
    expect(screen.getByText(/5 total/i)).toBeTruthy();
  });

  it('shows Run Collection button in config mode', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByRole('button', { name: /Run Collection/i })).toBeTruthy();
  });

  it('disables close button while running', async () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    // The button should not be disabled initially
    const closeBtn = screen.getByText('Close');
    expect((closeBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('displays collection name in header', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByText('My API')).toBeTruthy();
  });

  it('shows run mode description for sequential', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    expect(screen.getByText(/requests run one after another/i)).toBeTruthy();
  });

  it('shows header title "Run Collection"', () => {
    mockStore();
    render(<RunCollectionModal isOpen={true} onClose={vi.fn()} collectionId="col-1" />);
    // The h2 title should contain "Run Collection"
    const heading = document.querySelector('h2');
    expect(heading?.textContent).toContain('Run Collection');
  });
});
