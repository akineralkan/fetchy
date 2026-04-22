// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import WorkspaceDropdown from '../../src/components/WorkspaceDropdown';
import { useWorkspacesStore } from '../../src/store/workspacesStore';

vi.mock('../../src/store/workspacesStore', () => ({
  useWorkspacesStore: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkspaceDropdown', () => {
  const switchWorkspace = vi.fn();

  beforeEach(() => {
    vi.mocked(useWorkspacesStore).mockReturnValue({
      workspaces: [
        { id: 'ws-1', name: 'Primary Workspace' },
        { id: 'ws-2', name: 'Sandbox Workspace' },
      ],
      activeWorkspaceId: 'ws-1',
      switchWorkspace,
    } as never);
  });

  it('switches to a different workspace from the dropdown list', () => {
    render(<WorkspaceDropdown onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /primary workspace/i }));
    fireEvent.click(screen.getByText('Sandbox Workspace').closest('button') as HTMLButtonElement);

    expect(switchWorkspace).toHaveBeenCalledWith('ws-2');
  });

  it('does not switch when the active workspace is selected again', () => {
    render(<WorkspaceDropdown onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /primary workspace/i }));
    fireEvent.click(screen.getAllByText('Primary Workspace')[1].closest('button') as HTMLButtonElement);

    expect(switchWorkspace).not.toHaveBeenCalled();
  });

  it('opens workspace settings from the manage action', () => {
    const onOpenSettings = vi.fn();

    render(<WorkspaceDropdown onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /primary workspace/i }));
    fireEvent.click(screen.getByRole('button', { name: /manage/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Workspaces')).toBeNull();
  });
});