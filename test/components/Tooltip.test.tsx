// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import Tooltip from '../../src/components/Tooltip';

afterEach(cleanup);

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <Tooltip content="Hello">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeDefined();
  });

  it('does not show tooltip initially', () => {
    render(
      <Tooltip content="My tooltip">
        <span>target</span>
      </Tooltip>
    );
    expect(screen.queryByText('My tooltip')).toBeNull();
  });

  it('shows tooltip after default delay on mouse enter', async () => {
    render(
      <Tooltip content="Visible tooltip">
        <span>target</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Visible tooltip')).toBeDefined();
  });

  it('hides tooltip on mouse leave before delay', async () => {
    render(
      <Tooltip content="Quick hide">
        <span>target</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByText('Quick hide')).toBeNull();
  });

  it('hides tooltip on mouse leave after it is visible', () => {
    render(
      <Tooltip content="Goes away">
        <span>target</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Goes away')).toBeDefined();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('Goes away')).toBeNull();
  });

  it('respects custom delay prop', () => {
    render(
      <Tooltip content="Custom delay" delay={1000}>
        <span>target</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByText('Custom delay')).toBeNull();
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Custom delay')).toBeDefined();
  });

  it('does not show tooltip if content is empty string', () => {
    render(
      <Tooltip content="">
        <span>target</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    // Tooltip element should not be rendered when content is falsy
    const tooltipEl = document.querySelector('.fixed.px-3');
    expect(tooltipEl).toBeNull();
  });
});
