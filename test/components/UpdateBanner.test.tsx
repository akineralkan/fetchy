// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import UpdateBanner from '../../src/components/UpdateBanner';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UpdateBanner', () => {
  it('shows release details for the current and skipped versions when expanded', () => {
    const updatedAt = '2026-04-22T00:00:00.000Z';

    render(
      <UpdateBanner
        info={{
          version: 'v1.5.67',
          previousVersion: '1.5.64',
          releaseNotes: [
            { version: 'v1.5.67', note: '<p>Added workspace quick start improvements.</p>' },
            { version: 'v1.5.66', note: '<p>Fixed update banner rendering.</p>' },
          ],
          updatedAt,
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('Fetchy updated to v1.5.67!')).toBeTruthy();
    expect(screen.getByText(new Date(updatedAt).toLocaleDateString())).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /what changed\?/i }));

    expect(screen.getByText("What's new in v1.5.67")).toBeTruthy();
    expect(screen.getByText('Added workspace quick start improvements.')).toBeTruthy();
    expect(screen.getByText('Earlier updates since v1.5.64')).toBeTruthy();
    expect(screen.getByText('Fixed update banner rendering.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /hide/i }));

    expect(screen.queryByText("What's new in v1.5.67")).toBeNull();
  });

  it('hides the changelog toggle when there are no release notes and still dismisses', () => {
    const onDismiss = vi.fn();

    render(
      <UpdateBanner
        info={{ version: 'v1.5.67', releaseNotes: null }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.queryByRole('button', { name: /what changed\?/i })).toBeNull();

    fireEvent.click(screen.getByTitle('Dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});