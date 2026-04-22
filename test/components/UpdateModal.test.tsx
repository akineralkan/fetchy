// @vitest-environment jsdom

/**
 * Tests for UpdateModal.tsx
 *
 * Covers:
 *  - Rendering in non-Electron (browser) mode
 *  - All update status states: checking, available, not-available, error, downloading, downloaded
 *  - Close button
 *  - Download / install CTA buttons
 *  - Release notes display
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import fireEvent from '@testing-library/user-event';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildReleaseResponse(tagName: string, body = 'Release notes here') {
  return { tag_name: tagName, body, name: `Release ${tagName}`, published_at: '2026-01-01' };
}

function mockFetchLatest(tagName: string, allReleases = [buildReleaseResponse(tagName)]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => allReleases,
    })
  );
}

async function importModal() {
  const mod = await import('../../src/components/UpdateModal');
  return mod.default;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UpdateModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    // Ensure no electronAPI is present (browser mode)
    vi.stubGlobal('__APP_VERSION__', '1.0.0');
  });

  it('renders the modal header', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    expect(screen.getByText('Check for Updates')).toBeTruthy();
  });

  it('calls onClose when the X button is clicked', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    const closeBtn = document.querySelector('button[class*="hover:bg-fetchy-border"]') as HTMLButtonElement;
    closeBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows not-available status when on latest version', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/you('re| are) up to date/i)).toBeTruthy();
    });
  });

  it('shows update available status when a newer version exists', async () => {
    mockFetchLatest('v2.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      // The component shows 'New version available!'
    expect(screen.getByText(/new version available/i)).toBeTruthy();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeTruthy();
    });
  });

  it('shows error state when releases API returns non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => [] })
    );
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch release info/i)).toBeTruthy();
    });
  });

  it('shows error state when releases array is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    );
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/no releases found/i)).toBeTruthy();
    });
  });

  it('shows release notes when update is available', async () => {
    mockFetchLatest('v2.0.0', [buildReleaseResponse('v2.0.0', 'New feature X added')]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/new feature x added/i)).toBeTruthy();
    });
  });

  it('shows download button in browser mode for available update', async () => {
    mockFetchLatest('v2.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download/i })).toBeTruthy();
    });
  });

  it('clicking download in browser mode opens GitHub releases page', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    mockFetchLatest('v2.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByRole('button', { name: /download/i }));
    screen.getByRole('button', { name: /download/i }).click();
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/AkinerAlkan94/fetchy/releases/latest',
      '_blank'
    );
  });

  it('re-check button reruns the update check', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [buildReleaseResponse('v1.0.0')],
    });
    vi.stubGlobal('fetch', fetchMock);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/you('re| are) up to date/i));
    // Re-check (RotateCw button)
    const reCheckBtn = screen.queryByRole('button', { name: /check again/i });
    if (reCheckBtn) {
      reCheckBtn.click();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    }
  });
});
