// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EnvironmentModal from '../../src/components/EnvironmentModal';
import { useAppStore } from '../../src/store/appStore';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import { aiConvertEnvironment } from '../../src/utils/aiImport';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../src/utils/aiImport', () => ({
  aiConvertEnvironment: vi.fn(),
}));

vi.mock('uuid', () => {
  let count = 0;
  return {
    v4: vi.fn(() => `uuid-${++count}`),
  };
});

const dragHandlers: Array<(event: { active: { id: string }; over: { id: string } | null }) => void> = [];

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void }) => {
    dragHandlers.push(onDragEnd);
    return <div>{children}</div>;
  },
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

const bulkUpdateEnvironments = vi.fn();
const onClose = vi.fn();

let fileReaderMode: 'success' | 'error' = 'success';
let fileReaderResult = '';
let anchorClick = vi.fn();

function baseEnvironments() {
  return [
    {
      id: 'env-1',
      name: 'Staging',
      variables: [
        {
          id: 'var-1',
          key: 'token',
          value: 'shared-token',
          initialValue: 'shared-token',
          currentValue: 'local-token',
          enabled: true,
          isSecret: false,
        },
        {
          id: 'var-2',
          key: 'password',
          value: 'secret-password',
          initialValue: 'secret-password',
          currentValue: '',
          enabled: true,
          isSecret: true,
        },
        {
          id: 'script-1',
          key: 'scriptVar',
          value: 'runtime-value',
          currentValue: 'runtime-value',
          enabled: true,
          _fromScript: true,
        },
      ],
    },
    {
      id: 'env-2',
      name: 'Production',
      variables: [
        {
          id: 'prod-1',
          key: 'baseUrl',
          value: 'https://api.example.com',
          initialValue: 'https://api.example.com',
          currentValue: '',
          enabled: true,
          isSecret: false,
        },
      ],
    },
  ];
}

function mockStores(options?: {
  environments?: ReturnType<typeof baseEnvironments>;
  activeEnvironmentId?: string | null;
  aiEnabled?: boolean;
}) {
  const environments = options?.environments ?? baseEnvironments();
  const activeEnvironmentId = options?.activeEnvironmentId ?? 'env-1';

  vi.mocked(useAppStore).mockReturnValue({
    environments,
    activeEnvironmentId,
    bulkUpdateEnvironments,
  } as never);

  vi.mocked(usePreferencesStore).mockReturnValue({
    aiSettings: {
      enabled: options?.aiEnabled ?? true,
      apiKey: 'key',
      provider: 'gemini',
      baseUrl: '',
    },
  } as never);
}

class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsText() {
    if (fileReaderMode === 'error') {
      this.onerror?.();
      return;
    }

    this.onload?.({ target: { result: fileReaderResult } });
  }
}

beforeEach(() => {
  dragHandlers.length = 0;
  anchorClick = vi.fn();
  fileReaderMode = 'success';
  fileReaderResult = '';
  onClose.mockClear();
  bulkUpdateEnvironments.mockClear();
  mockStores();
  vi.mocked(aiConvertEnvironment).mockReset();

  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    const element = originalCreateElement(tagName);
    if (tagName === 'a') {
      element.click = anchorClick;
    }
    return element;
  }) as typeof document.createElement);

  Object.defineProperty(globalThis, 'FileReader', {
    configurable: true,
    value: MockFileReader,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:environment-export'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EnvironmentModal', () => {
  it('adds variables, switches the active environment, and saves draft changes', () => {
    render(<EnvironmentModal onClose={onClose} />);

    fireEvent.click(screen.getByText('Production'));
    fireEvent.click(screen.getByRole('button', { name: /set as active/i }));
    fireEvent.click(screen.getByRole('button', { name: /add variable/i }));

    const nameInputs = screen.getAllByPlaceholderText('Variable name');
    const presetInputs = screen.getAllByPlaceholderText('Preset value (shared)');
    const overrideInputs = screen.getAllByPlaceholderText('Override value (local)');

    fireEvent.change(nameInputs[nameInputs.length - 1], { target: { value: 'sessionId' } });
    fireEvent.change(presetInputs[presetInputs.length - 1], { target: { value: 'seed-123' } });
    fireEvent.change(overrideInputs[overrideInputs.length - 1], { target: { value: 'runtime-456' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(bulkUpdateEnvironments).toHaveBeenCalledTimes(1);
    const [savedEnvironments, savedActiveEnvironmentId] = bulkUpdateEnvironments.mock.calls[0];

    expect(savedActiveEnvironmentId).toBe('env-2');
    expect(
      savedEnvironments
        .find((environment: { id: string }) => environment.id === 'env-2')
        ?.variables.some((variable: { key: string; currentValue: string }) => variable.key === 'sessionId' && variable.currentValue === 'runtime-456'),
    ).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('duplicates, renames, and deletes environments through the list actions', () => {
    render(<EnvironmentModal onClose={onClose} />);

    fireEvent.click(screen.getAllByTitle('Duplicate')[0]);
    expect(screen.getAllByText('Staging (Copy)').length).toBeGreaterThan(0);

    let cloneRow = screen.getAllByText('Staging (Copy)')[0].closest('div') as HTMLElement;
    fireEvent.click(within(cloneRow).getByTitle('Rename'));
    fireEvent.change(screen.getByDisplayValue('Staging (Copy)'), {
      target: { value: 'Staging Clone' },
    });
    fireEvent.blur(screen.getByDisplayValue('Staging Clone'));

    expect(screen.getAllByText('Staging Clone').length).toBeGreaterThan(0);

    cloneRow = screen.getAllByText('Staging Clone')[0].closest('div') as HTMLElement;
    fireEvent.click(within(cloneRow).getByTitle('Delete'));

    expect(screen.getByText('Delete Environment?')).toBeTruthy();
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /^delete$/i })
        .find((button) => button.textContent?.trim() === 'Delete') as HTMLButtonElement,
    );

    expect(screen.queryByText('Staging Clone')).toBeNull();
  });

  it('exports environments to a downloadable JSON blob', () => {
    render(<EnvironmentModal onClose={onClose} />);

    const exportButton = screen
      .getAllByRole('button', { name: /export/i })
      .find((button) => button.textContent?.includes('Export')) as HTMLButtonElement;

    fireEvent.click(exportButton);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('imports standard environment files and shows validation errors for bad files', async () => {
    const { container } = render(<EnvironmentModal onClose={onClose} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fileReaderResult = JSON.stringify({
      _type: 'environment',
      name: 'Imported Env',
      variables: [{ key: 'baseUrl', value: 'https://example.com', enabled: true }],
    });

    fireEvent.change(fileInput, {
      target: { files: [new File(['{}'], 'environment.json', { type: 'application/json' })] },
    });

    expect(await screen.findByText('Successfully imported "Imported Env"')).toBeTruthy();
    expect(screen.getAllByText('Imported Env').length).toBeGreaterThan(0);

    fileReaderResult = '{}';
    fireEvent.change(fileInput, {
      target: { files: [new File(['{}'], 'bad-environment.json', { type: 'application/json' })] },
    });

    expect(await screen.findByText('Invalid environment file format')).toBeTruthy();
  });

  it('supports AI-assisted imports for arbitrary environment files', async () => {
    vi.mocked(aiConvertEnvironment).mockResolvedValue({
      environment: {
        id: 'ai-env',
        name: 'AI Imported Env',
        variables: [],
      },
      error: undefined,
    } as never);

    const { container } = render(<EnvironmentModal onClose={onClose} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.click(container.querySelector('button.group') as HTMLButtonElement);
    expect(screen.getByText('AI Import')).toBeTruthy();

    fileReaderResult = 'BASE_URL=https://api.example.com';
    fireEvent.change(fileInput, {
      target: { files: [new File(['BASE_URL=https://api.example.com'], 'environment.env')] },
    });

    await waitFor(() => {
      expect(aiConvertEnvironment).toHaveBeenCalled();
    });

    expect(await screen.findByText('AI imported "AI Imported Env"')).toBeTruthy();
    expect(screen.getAllByText('AI Imported Env').length).toBeGreaterThan(0);
  });

  it('reorders environments and variables through drag handlers before saving', () => {
    render(<EnvironmentModal onClose={onClose} />);

    act(() => {
      dragHandlers[0]({ active: { id: 'env-2' }, over: { id: 'env-1' } });
      dragHandlers[1]({ active: { id: 'var-2' }, over: { id: 'var-1' } });
    });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const [savedEnvironments] = bulkUpdateEnvironments.mock.calls[0];

    expect(savedEnvironments[0].id).toBe('env-2');
    expect(savedEnvironments[1].variables[0].id).toBe('var-2');
    expect(savedEnvironments[1].variables[1].id).toBe('var-1');
  });

  it('prompts before discarding unsaved changes', () => {
    render(<EnvironmentModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /add variable/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByText('Discard changes?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.queryByText('Discard changes?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});