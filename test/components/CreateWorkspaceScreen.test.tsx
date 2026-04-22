// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import CreateWorkspaceScreen from '../../src/components/CreateWorkspaceScreen';
import { useWorkspacesStore } from '../../src/store/workspacesStore';

vi.mock('../../src/store/workspacesStore', () => ({
  useWorkspacesStore: vi.fn(),
}));

const addWorkspace = vi.fn();
const importWorkspaceFromFile = vi.fn();

function mockStore(isElectron: boolean) {
  vi.mocked(useWorkspacesStore).mockReturnValue({
    isElectron,
    addWorkspace,
    importWorkspaceFromFile,
  } as never);
}

beforeEach(() => {
  addWorkspace.mockResolvedValue({ id: 'ws-1' });
  importWorkspaceFromFile.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
});

describe('CreateWorkspaceScreen', () => {
  it('validates the name and creates browser-mode workspaces with virtual directories', async () => {
    mockStore(false);
    const onCreated = vi.fn();

    render(<CreateWorkspaceScreen onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
    expect(screen.getByText('Please enter a workspace name.')).toBeTruthy();

    const nameInput = screen.getByPlaceholderText('e.g. My Project');
    fireEvent.change(nameInput, { target: { value: 'Sandbox' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(addWorkspace).toHaveBeenCalledWith(
        'Sandbox',
        'browser:Sandbox:home',
        'browser:Sandbox:secrets',
      );
    });

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /import from file/i })).toBeNull();
  });

  it('requires directories in Electron mode and lets the user browse for them', async () => {
    mockStore(true);
    const onCreated = vi.fn();
    (window as typeof window & { electronAPI?: { selectDirectory: ReturnType<typeof vi.fn> } }).electronAPI = {
      selectDirectory: vi
        .fn()
        .mockResolvedValueOnce('C:/work/home')
        .mockResolvedValueOnce('C:/work/secrets'),
    };

    render(<CreateWorkspaceScreen onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. My Project'), {
      target: { value: 'Desktop Workspace' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(screen.getByText('Please select both directories.')).toBeTruthy();

    const browseButtons = screen.getAllByTitle('Browse');
    fireEvent.click(browseButtons[0]);
    fireEvent.click(browseButtons[1]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('C:/work/home')).toBeTruthy();
      expect(screen.getByDisplayValue('C:/work/secrets')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => {
      expect(addWorkspace).toHaveBeenCalledWith(
        'Desktop Workspace',
        'C:/work/home',
        'C:/work/secrets',
      );
    });

    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('shows workspace creation failures from the store action', async () => {
    mockStore(false);
    addWorkspace.mockRejectedValueOnce(new Error('Workspace directory already exists'));

    render(<CreateWorkspaceScreen onCreated={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. My Project'), {
      target: { value: 'Existing Workspace' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText('Workspace directory already exists')).toBeTruthy();
  });

  it('imports a workspace file and completes the flow on success', async () => {
    mockStore(true);
    importWorkspaceFromFile.mockResolvedValueOnce({ success: true });
    const onCreated = vi.fn();

    render(<CreateWorkspaceScreen onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: /import from file/i }));

    await waitFor(() => {
      expect(importWorkspaceFromFile).toHaveBeenCalledTimes(1);
    });

    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('surfaces import errors from both failed results and thrown exceptions', async () => {
    mockStore(true);
    importWorkspaceFromFile.mockResolvedValueOnce({ success: false, error: 'Invalid workspace file' });

    const { rerender } = render(<CreateWorkspaceScreen onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /import from file/i }));
    expect(await screen.findByText('Invalid workspace file')).toBeTruthy();

    importWorkspaceFromFile.mockRejectedValueOnce(new Error('Import crashed'));
    rerender(<CreateWorkspaceScreen onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /import from file/i }));
    expect(await screen.findByText('Import crashed')).toBeTruthy();
  });
});