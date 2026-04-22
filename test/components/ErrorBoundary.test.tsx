// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import ErrorBoundary from '../../src/components/ErrorBoundary';

function ThrowingChild() {
  throw new Error('Boom from child');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>Healthy child</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Healthy child')).toBeTruthy();
  });

  it('shows the fallback UI and recovers after the crashing child is replaced', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Boom from child')).toBeTruthy();
    expect(
      consoleSpy.mock.calls.some(([message]) =>
        String(message).includes('[ErrorBoundary] Uncaught error:'),
      ),
    ).toBe(true);
    expect(
      consoleSpy.mock.calls.some(([message]) =>
        String(message).includes('[ErrorBoundary] Component stack:'),
      ),
    ).toBe(true);

    rerender(
      <ErrorBoundary>
        <div>Recovered child</div>
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try to recover/i }));

    expect(screen.getByText('Recovered child')).toBeTruthy();
  });

  it('renders both recovery actions in the fallback UI', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try to recover/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload app/i })).toBeTruthy();
  });
});