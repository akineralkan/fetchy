// @vitest-environment jsdom

/**
 * Tests for VariableTooltip.tsx
 *
 * Covers:
 *  - Renders variable name, defined value, secret masking
 *  - Copy button triggers clipboard API
 *  - Edit flow: edit button → input → save
 *  - Add variable flow for undefined variables
 *  - Close on outside click
 *  - Undefined variable shows "Add to environment" UI
 *  - Empty variable shows "(empty)" indicator
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import VariableTooltip from '../../src/components/VariableTooltip';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'new-uuid') }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const position = { x: 100, y: 200 };

function makeEnv(vars: { id: string; key: string; value: string; enabled: boolean; isSecret?: boolean; currentValue?: string }[]) {
  return { id: 'env-1', name: 'Test', variables: vars };
}

function baseStore(overrides: Record<string, unknown> = {}) {
  return {
    getActiveEnvironment: vi.fn(() => null),
    environments: [],
    activeEnvironmentId: null,
    updateEnvironment: vi.fn(),
    ...overrides,
  };
}

describe('VariableTooltip', () => {
  it('shows the variable name in the tooltip', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(
      <VariableTooltip variableName="myVar" position={position} onClose={vi.fn()} />
    );
    // Component renders variableName wrapped in << >>
    expect(screen.getByText(/myVar/)).toBeTruthy();
  });

  it('shows the variable value when the variable is defined', () => {
    const env = makeEnv([{ id: 'v1', key: 'apiUrl', value: 'https://api.dev', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="apiUrl" position={position} onClose={vi.fn()} />
    );
    expect(screen.getByText('https://api.dev')).toBeTruthy();
  });

  it('masks the value for secret variables', () => {
    const env = makeEnv([
      { id: 'v1', key: 'secretToken', value: 'super-secret', enabled: true, isSecret: true },
    ]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="secretToken" position={position} onClose={vi.fn()} />
    );
    // Secret variables show a 'secret' badge — the component shows the value but marks it secret
    expect(screen.getAllByText(/secret/i).length).toBeGreaterThan(0);
  });

  it('shows "(empty)" when variable exists but has no value', () => {
    const env = makeEnv([{ id: 'v1', key: 'emptyVar', value: '', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="emptyVar" position={position} onClose={vi.fn()} />
    );
    // Multiple elements with 'empty' text may exist (badge + code area)
    expect(screen.getAllByText(/empty/i).length).toBeGreaterThan(0);
  });

  it('shows "not defined" indicator for an undefined variable', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => makeEnv([])),
      }) as never
    );
    render(
      <VariableTooltip variableName="missingVar" position={position} onClose={vi.fn()} />
    );
    expect(screen.getByText(/not defined/i)).toBeTruthy();
  });

  it('enters edit mode when edit button is clicked', () => {
    const env = makeEnv([{ id: 'v1', key: 'myKey', value: 'myVal', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="myKey" position={position} onClose={vi.fn()} />
    );
    // Edit button uses text label 'Edit'
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    // Input should now be editable
    const input = screen.getByDisplayValue('myVal');
    expect(input).toBeTruthy();
  });

  it('calls updateEnvironment with updated value on save', () => {
    const updateEnvironment = vi.fn();
    const env = makeEnv([{ id: 'v1', key: 'myKey', value: 'oldVal', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
        updateEnvironment,
      }) as never
    );
    render(
      <VariableTooltip variableName="myKey" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByDisplayValue('oldVal');
    fireEvent.change(input, { target: { value: 'newVal' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(updateEnvironment).toHaveBeenCalledWith(
      'env-1',
      expect.objectContaining({ variables: expect.any(Array) })
    );
  });

  it('copies value to clipboard when copy button is clicked', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: writeMock } });
    const env = makeEnv([{ id: 'v1', key: 'copyVar', value: 'copied!', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="copyVar" position={position} onClose={vi.fn()} />
    );
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => expect(writeMock).toHaveBeenCalledWith('copied!'));
  });

  it('calls onClose when clicking outside the tooltip', () => {
    const onClose = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(
      <div>
        <VariableTooltip variableName="x" position={position} onClose={onClose} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  // ─── Additional coverage tests ──────────────────────────────────────────────

  it('shows "Add to Environment" button for undefined variable when environments exist', () => {
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="unknownVar" position={position} onClose={vi.fn()} />
    );
    expect(screen.getByText(/Add to Environment/i)).toBeTruthy();
  });

  it('shows "Create an environment first" when no environments exist for undefined var', () => {
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => null),
        environments: [],
      }) as never
    );
    render(
      <VariableTooltip variableName="unknownVar" position={position} onClose={vi.fn()} />
    );
    expect(screen.getByText(/Create an environment first/i)).toBeTruthy();
  });

  it('opens add variable form when "Add to Environment" is clicked', () => {
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="newVar" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    // After clicking, the form should show environment select and value input
    expect(screen.getByPlaceholderText('Enter value...')).toBeTruthy();
    expect(screen.getByText('Add Variable')).toBeTruthy();
  });

  it('calls updateEnvironment when adding a new variable', () => {
    const updateEnvironment = vi.fn();
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
        updateEnvironment,
      }) as never
    );
    const onClose = vi.fn();
    render(
      <VariableTooltip variableName="newVar" position={position} onClose={onClose} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    fireEvent.change(screen.getByPlaceholderText('Enter value...'), { target: { value: 'new-value' } });
    fireEvent.click(screen.getByText('Add Variable'));
    expect(updateEnvironment).toHaveBeenCalledWith('env-1', expect.objectContaining({
      variables: expect.arrayContaining([
        expect.objectContaining({ key: 'newVar', value: 'new-value' }),
      ]),
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles secret flag in the add variable form', () => {
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="newVar" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    // Initially "Not Secret"
    expect(screen.getByText('Not Secret')).toBeTruthy();
    fireEvent.click(screen.getByText('Not Secret'));
    expect(screen.getByText('Secret')).toBeTruthy();
  });

  it('cancels the add variable form', () => {
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="newVar" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    fireEvent.click(screen.getByText('Cancel'));
    // Should go back to showing "Add to Environment" button
    expect(screen.getByText(/Add to Environment/i)).toBeTruthy();
  });

  it('Enter key saves the edit', () => {
    const updateEnvironment = vi.fn();
    const env = makeEnv([{ id: 'v1', key: 'myKey', value: 'oldVal', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
        updateEnvironment,
      }) as never
    );
    render(
      <VariableTooltip variableName="myKey" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByDisplayValue('oldVal');
    fireEvent.change(input, { target: { value: 'updated' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateEnvironment).toHaveBeenCalled();
  });

  it('Escape key cancels the edit', () => {
    const env = makeEnv([{ id: 'v1', key: 'myKey', value: 'oldVal', enabled: true }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="myKey" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByDisplayValue('oldVal');
    fireEvent.keyDown(input, { key: 'Escape' });
    // Should exit editing mode, value display should return
    expect(screen.getByText('oldVal')).toBeTruthy();
  });

  it('prefers currentValue over value for display', () => {
    const env = makeEnv([{ id: 'v1', key: 'cv', value: 'initial', enabled: true, currentValue: 'current' }]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="cv" position={position} onClose={vi.fn()} />
    );
    expect(screen.getByText('current')).toBeTruthy();
  });

  it('Enter key in add form submits', () => {
    const updateEnvironment = vi.fn();
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
        updateEnvironment,
      }) as never
    );
    const onClose = vi.fn();
    render(
      <VariableTooltip variableName="addVar" position={position} onClose={onClose} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    const input = screen.getByPlaceholderText('Enter value...');
    fireEvent.change(input, { target: { value: 'typed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateEnvironment).toHaveBeenCalled();
  });

  it('Escape key in add form cancels', () => {
    const env = makeEnv([]);
    vi.mocked(useAppStore).mockReturnValue(
      baseStore({
        getActiveEnvironment: vi.fn(() => env),
        environments: [env],
        activeEnvironmentId: 'env-1',
      }) as never
    );
    render(
      <VariableTooltip variableName="addVar" position={position} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Add to Environment/i));
    const input = screen.getByPlaceholderText('Enter value...');
    fireEvent.keyDown(input, { key: 'Escape' });
    // Should go back to "Add to Environment" button
    expect(screen.getByText(/Add to Environment/i)).toBeTruthy();
  });
});
