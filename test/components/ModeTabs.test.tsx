// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModeTabs from '../../src/components/ModeTabs';

afterEach(cleanup);

describe('ModeTabs', () => {
  it('renders all mode tabs', () => {
    render(<ModeTabs activeMode="rest" onModeChange={vi.fn()} />);
    expect(screen.getByText('REST')).toBeDefined();
    expect(screen.getByText('GraphQL')).toBeDefined();
    expect(screen.getByText('gRPC')).toBeDefined();
    expect(screen.getByText('WebSocket')).toBeDefined();
    expect(screen.getByText('MQTT')).toBeDefined();
    expect(screen.getByText('SSE')).toBeDefined();
  });

  it('marks active mode tab with accent styles', () => {
    render(<ModeTabs activeMode="rest" onModeChange={vi.fn()} />);
    const restButton = screen.getByRole('button', { name: /REST/i });
    expect(restButton.className).toContain('bg-fetchy-accent');
  });

  it('calls onModeChange when a tab is clicked', () => {
    const onModeChange = vi.fn();
    render(<ModeTabs activeMode="rest" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('button', { name: /GraphQL/i }));
    expect(onModeChange).toHaveBeenCalledWith('graphql');
  });

  it('shows "Soon" badge for unavailable modes', () => {
    render(<ModeTabs activeMode="rest" onModeChange={vi.fn()} />);
    const soonBadges = screen.getAllByText('Soon');
    // REST is available, the rest 6 should show Soon (but not when active)
    expect(soonBadges.length).toBeGreaterThan(0);
  });

  it('does not show "Soon" badge on active mode even if unavailable', () => {
    // graphql is unavailable but active — "Soon" should not appear for it
    render(<ModeTabs activeMode="graphql" onModeChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const graphqlButton = buttons.find(b => b.textContent?.includes('GraphQL'));
    expect(graphqlButton?.textContent).not.toContain('Soon');
  });

  it('switches active style when activeMode prop changes', () => {
    const { rerender } = render(<ModeTabs activeMode="rest" onModeChange={vi.fn()} />);
    rerender(<ModeTabs activeMode="graphql" onModeChange={vi.fn()} />);
    const graphqlButton = screen.getByRole('button', { name: /GraphQL/i });
    expect(graphqlButton.className).toContain('bg-fetchy-accent');
  });
});
