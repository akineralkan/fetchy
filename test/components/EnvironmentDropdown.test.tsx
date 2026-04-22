// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import EnvironmentDropdown from '../../src/components/EnvironmentDropdown';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

const setActiveEnvironment = vi.fn();

function mockStore(activeEnvironmentId: string | null, environments?: Array<{ id: string; name: string; variables?: Array<{ id: string }> }>) {
  const items = environments ?? [
    { id: 'env-1', name: 'Staging', variables: [{ id: 'var-1' }] },
    { id: 'env-2', name: 'Production', variables: [{ id: 'var-2' }, { id: 'var-3' }] },
  ];

  vi.mocked(useAppStore).mockReturnValue({
    environments: items,
    activeEnvironmentId,
    setActiveEnvironment,
    getActiveEnvironment: () => items.find((env) => env.id === activeEnvironmentId) ?? null,
  } as never);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EnvironmentDropdown', () => {
  beforeEach(() => {
    mockStore('env-1');
  });

  it('switches to another environment and closes the dropdown', () => {
    render(<EnvironmentDropdown onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /staging/i }));

    expect(screen.getByText('2 vars')).toBeTruthy();

    fireEvent.click(screen.getByText('Production').closest('button') as HTMLButtonElement);

    expect(setActiveEnvironment).toHaveBeenCalledWith('env-2');
    expect(screen.queryByText('Environments')).toBeNull();
  });

  it('supports clearing the active environment selection', () => {
    render(<EnvironmentDropdown onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /staging/i }));
    fireEvent.click(screen.getByText('No Environment').closest('button') as HTMLButtonElement);

    expect(setActiveEnvironment).toHaveBeenCalledWith(null);
  });

  it('opens environment settings from both the manage button and the empty state', () => {
    const onOpenSettings = vi.fn();

    render(<EnvironmentDropdown onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /staging/i }));
    fireEvent.click(screen.getByRole('button', { name: /manage/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Environments')).toBeNull();

    cleanup();
    mockStore(null, []);

    render(<EnvironmentDropdown onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /no environment/i }));
    fireEvent.click(screen.getByRole('button', { name: /create your first environment/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(2);
  });

  it('closes when the user clicks outside the dropdown', () => {
    render(<EnvironmentDropdown onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /staging/i }));
    expect(screen.getByText('Environments')).toBeTruthy();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText('Environments')).toBeNull();
  });
});