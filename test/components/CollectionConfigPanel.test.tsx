// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import CollectionConfigPanel from '../../src/components/CollectionConfigPanel';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('uuid', () => {
  let count = 0;
  return {
    v4: vi.fn(() => `uuid-${++count}`),
  };
});

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

vi.mock('../../src/components/CodeEditor', async () => {
  const React = await import('react');

  return {
    default: React.forwardRef(function MockCodeEditor(
      {
        value,
        onChange,
        language = 'text',
        readOnly = false,
      }: {
        value: string;
        onChange: (value: string) => void;
        language?: string;
        readOnly?: boolean;
      },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({
        insertAtCursor: (text: string) => onChange(`${value}${text}`),
        replaceRange: (from: number, to: number, text: string) => onChange(`${value.slice(0, from)}${text}${value.slice(to)}`),
      }), [value, onChange]);

      return (
        <textarea
          data-testid={`code-editor-${language}`}
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }),
  };
});

vi.mock('../../src/components/Tooltip', async () => {
  const React = await import('react');

  return {
    default: ({ content, children }: { content: string; children: React.ReactNode }) =>
      React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            'aria-label': content,
            title: content,
          })
        : children,
  };
});

const updateCollection = vi.fn();

function mockStore(collectionOverrides?: Record<string, unknown>) {
  vi.mocked(useAppStore).mockReturnValue({
    collections: [
      {
        id: 'col-1',
        name: 'Main Collection',
        description: 'Initial description',
        requests: [{ id: 'req-1' }],
        folders: [{ id: 'folder-1' }],
        variables: [
          {
            id: 'var-1',
            key: 'token',
            value: 'abc',
            initialValue: 'abc',
            currentValue: 'abc',
            enabled: true,
            isSecret: false,
          },
        ],
        auth: { type: 'none' },
        preScript: '',
        script: '',
        ...collectionOverrides,
      },
    ],
    updateCollection,
  } as never);
}

beforeEach(() => {
  mockStore();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CollectionConfigPanel', () => {
  it('shows a not-found state when the target collection is missing', () => {
    vi.mocked(useAppStore).mockReturnValue({
      collections: [],
      updateCollection,
    } as never);

    render(<CollectionConfigPanel collectionId='missing' />);

    expect(screen.getByText('Collection not found')).toBeTruthy();
  });

  it('adds variables, updates the description, and saves with the keyboard shortcut', () => {
    mockStore({ variables: [] });

    render(<CollectionConfigPanel collectionId='col-1' />);

    fireEvent.change(screen.getByPlaceholderText('Add a description for this collection...'), {
      target: { value: 'Updated collection description' },
    });
    fireEvent.click(screen.getByText('Add Variable').closest('button') as HTMLButtonElement);

    fireEvent.change(screen.getByPlaceholderText('Variable name'), {
      target: { value: 'sessionId' },
    });
    fireEvent.change(screen.getByPlaceholderText('Initial value'), {
      target: { value: 'seed-123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Current value'), {
      target: { value: 'live-456' },
    });

    fireEvent.keyDown(window, { ctrlKey: true, key: 's' });

    expect(updateCollection).toHaveBeenCalledWith('col-1', {
      variables: [
        expect.objectContaining({
          id: 'uuid-1',
          key: 'sessionId',
          initialValue: 'seed-123',
          currentValue: 'live-456',
          value: 'live-456',
          enabled: true,
          isSecret: false,
        }),
      ],
      auth: { type: 'none' },
      preScript: '',
      script: '',
      description: 'Updated collection description',
    });
  });

  it('toggles variable secrecy and removes variables from the table', () => {
    const { container } = render(<CollectionConfigPanel collectionId='col-1' />);

    fireEvent.click(screen.getByRole('button', { name: /hide value/i }));

    const currentValueInput = screen.getByPlaceholderText('Current value') as HTMLInputElement;
    expect(currentValueInput.type).toBe('password');

    const rowButtons = container.querySelectorAll('tbody button');
    fireEvent.click(rowButtons[1]);

    expect(screen.getByText('No variables defined')).toBeTruthy();
  });

  it('edits collection auth and saves the updated API key settings', () => {
    render(<CollectionConfigPanel collectionId='col-1' />);

    fireEvent.click(screen.getByRole('button', { name: /^auth$/i }));
    fireEvent.click(screen.getByRole('button', { name: /api key/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., X-API-Key'), {
      target: { value: 'X-API-Key' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter API key value'), {
      target: { value: 'super-secret' },
    });
    fireEvent.change(screen.getByDisplayValue('Header'), {
      target: { value: 'query' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save collection settings/i }));

    expect(updateCollection).toHaveBeenCalledWith('col-1', {
      variables: expect.any(Array),
      auth: expect.objectContaining({
        type: 'api-key',
        apiKey: {
          key: 'X-API-Key',
          value: 'super-secret',
          addTo: 'query',
        },
      }),
      preScript: '',
      script: '',
      description: 'Initial description',
    });
  });

  it('inserts pre- and post-script snippets and saves both script editors', () => {
    render(<CollectionConfigPanel collectionId='col-1' />);

    fireEvent.click(screen.getByRole('button', { name: /pre-script/i }));
    fireEvent.click(screen.getByRole('button', { name: /log message/i }));

    expect(
      (screen.getByTestId('code-editor-javascript') as HTMLTextAreaElement).value,
    ).toBe('console.log("Hello from collection pre-script");');

    fireEvent.click(screen.getByTitle(/collapse snippets/i));
    fireEvent.click(screen.getByTitle(/expand snippets/i));

    fireEvent.click(screen.getByRole('button', { name: /post-script/i }));
    fireEvent.click(screen.getByRole('button', { name: /log response status/i }));
    fireEvent.click(screen.getByRole('button', { name: /save collection settings/i }));

    expect(updateCollection).toHaveBeenCalledWith('col-1', {
      variables: expect.any(Array),
      auth: { type: 'none' },
      preScript: 'console.log("Hello from collection pre-script");',
      script: 'console.log("Status:", fetchy.response.status);',
      description: 'Initial description',
    });
  });
});