// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import CollectionAuthModal from '../../src/components/CollectionAuthModal';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: ({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) => (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

const updateCollection = vi.fn();
const updateFolder = vi.fn();

function mockStore() {
  vi.mocked(useAppStore).mockReturnValue({
    collections: [
      {
        id: 'col-1',
        name: 'Main Collection',
        requests: [],
        folders: [
          {
            id: 'folder-parent',
            name: 'Parent Folder',
            requests: [],
            folders: [
              {
                id: 'folder-child',
                name: 'Child Folder',
                requests: [],
                folders: [],
                auth: { type: 'none' },
              },
            ],
          },
        ],
        auth: { type: 'bearer', bearer: { token: 'top-secret-token' } },
      },
    ],
    updateCollection,
    updateFolder,
  } as never);
}

beforeEach(() => {
  mockStore();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CollectionAuthModal', () => {
  it('does not render when the collection cannot be found', () => {
    vi.mocked(useAppStore).mockReturnValue({
      collections: [],
      updateCollection,
      updateFolder,
    } as never);

    const { container } = render(
      <CollectionAuthModal
        isOpen
        onClose={vi.fn()}
        collectionId='missing'
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('loads existing collection auth and saves updated basic auth settings', () => {
    const onClose = vi.fn();

    render(
      <CollectionAuthModal
        isOpen
        onClose={onClose}
        collectionId='col-1'
      />,
    );

    expect(screen.getByDisplayValue('top-secret-token')).toBeTruthy();
    expect(screen.queryByText('Inherit')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /basic auth/i }));
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 's3cr3t' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(updateCollection).toHaveBeenCalledWith(
      'col-1',
      {
        auth: expect.objectContaining({
          type: 'basic',
          basic: { username: 'alice', password: 's3cr3t' },
        }),
      },
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the inherit option for folders and saves folder auth changes recursively', () => {
    render(
      <CollectionAuthModal
        isOpen
        onClose={vi.fn()}
        collectionId='col-1'
        folderId='folder-child'
      />,
    );

    expect(screen.getByText(/configure auth for/i)).toBeTruthy();
    expect(screen.getByText('Child Folder')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inherit' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Inherit' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(updateFolder).toHaveBeenCalledWith('col-1', 'folder-child', {
      auth: { type: 'inherit' },
    });
  });

  it('supports API key auth fields and no-auth messaging', () => {
    vi.mocked(useAppStore).mockReturnValue({
      collections: [
        {
          id: 'col-1',
          name: 'Main Collection',
          requests: [],
          folders: [],
          auth: { type: 'none' },
        },
      ],
      updateCollection,
      updateFolder,
    } as never);

    render(
      <CollectionAuthModal
        isOpen
        onClose={vi.fn()}
        collectionId='col-1'
      />,
    );

    expect(screen.getByText(/no authentication required/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /api key/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., X-API-Key'), {
      target: { value: 'X-API-Key' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter API key value'), {
      target: { value: 'secret-value' },
    });
    fireEvent.change(screen.getByDisplayValue('Header'), {
      target: { value: 'query' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(updateCollection).toHaveBeenCalledWith('col-1', {
      auth: expect.objectContaining({
        type: 'api-key',
        apiKey: {
          key: 'X-API-Key',
          value: 'secret-value',
          addTo: 'query',
        },
      }),
    });
  });
});