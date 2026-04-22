// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModeDropdown from '../../src/components/ModeDropdown';

afterEach(cleanup);

describe('ModeDropdown', () => {
  it('renders the active mode label', () => {
    render(<ModeDropdown activeMode="rest" onModeChange={vi.fn()} />);
    expect(screen.getByText('REST API')).toBeDefined();
  });

  it('opens the dropdown when button is clicked', () => {
    render(<ModeDropdown activeMode="rest" onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Switch Mode'));
    expect(screen.getByText('Select Mode')).toBeDefined();
  });

  it('closes the dropdown when clicking outside', () => {
    render(
      <div>
        <ModeDropdown activeMode="rest" onModeChange={vi.fn()} />
        <span data-testid="outside">outside</span>
      </div>
    );
    fireEvent.click(screen.getByTitle('Switch Mode'));
    expect(screen.getByText('Select Mode')).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Select Mode')).toBeNull();
  });

  it('calls onModeChange when clicking an available mode', () => {
    const onModeChange = vi.fn();
    render(<ModeDropdown activeMode="rest" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTitle('Switch Mode'));
    // Get buttons inside the dropdown list only (not the trigger button)
    const dropdownButtons = screen.getAllByRole('button').filter(
      b => b !== screen.getByTitle('Switch Mode')
    );
    const restButton = dropdownButtons.find(b => b.textContent?.includes('REST API'));
    fireEvent.click(restButton!);
    expect(onModeChange).toHaveBeenCalledWith('rest');
  });

  it('shows unavailable modes as disabled', () => {
    render(<ModeDropdown activeMode="rest" onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Switch Mode'));
    const graphqlButton = screen.getAllByRole('button').find(b => b.textContent?.includes('GraphQL'));
    expect(graphqlButton).toBeDefined();
    expect((graphqlButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows all mode options in the dropdown', () => {
    render(<ModeDropdown activeMode="rest" onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Switch Mode'));
    expect(screen.getByText('GraphQL')).toBeDefined();
    expect(screen.getByText('gRPC')).toBeDefined();
    expect(screen.getByText('WebSocket')).toBeDefined();
    expect(screen.getByText('MQTT')).toBeDefined();
  });
});
