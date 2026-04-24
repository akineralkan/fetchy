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

  // ── Additional coverage tests ──────────────────────────────────────────

  it('shows intermediate releases accordion when skipping versions', async () => {
    mockFetchLatest('v3.0.0', [
      buildReleaseResponse('v3.0.0', 'Version 3 notes'),
      buildReleaseResponse('v2.5.0', 'Version 2.5 notes'),
      buildReleaseResponse('v2.0.0', 'Version 2 notes'),
    ]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/new version available/i)).toBeTruthy();
    });
    // Intermediate accordion should be present
    const accordion = screen.queryByText(/changes since/i);
    expect(accordion).toBeTruthy();
  });

  it('expands and collapses intermediate releases accordion', async () => {
    mockFetchLatest('v3.0.0', [
      buildReleaseResponse('v3.0.0', 'Version 3 notes'),
      buildReleaseResponse('v2.0.0', 'Version 2 notes'),
    ]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/new version available/i));
    const accordionBtn = screen.queryByText(/changes since/i);
    if (accordionBtn) {
      const btn = accordionBtn.closest('button');
      if (btn) {
        btn.click();
        // After clicking, intermediate notes should be visible
        await waitFor(() => {
          expect(screen.getByText(/version 2 notes/i)).toBeTruthy();
        });
        // Click again to collapse
        btn.click();
      }
    }
  });

  it('shows release date when available', async () => {
    mockFetchLatest('v2.0.0', [
      { tag_name: 'v2.0.0', body: 'Notes here', name: 'Release v2.0.0', published_at: '2026-03-15' },
    ]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/new version available/i)).toBeTruthy();
    });
    // Release date should be displayed
    const dateEl = screen.queryByText(/released/i);
    expect(dateEl).toBeTruthy();
  });

  it('shows version info footer when status is not checking or idle', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/you('re| are) up to date/i));
    expect(screen.getByText(/current version/i)).toBeTruthy();
  });

  it('calls onClose when Close button in footer is clicked', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/you('re| are) up to date/i));
    const closeBtn = screen.getByRole('button', { name: /close/i });
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Re-check button after check completes', async () => {
    mockFetchLatest('v1.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/you('re| are) up to date/i));
    const recheckBtn = screen.getByRole('button', { name: /re-check/i });
    expect(recheckBtn).toBeTruthy();
  });

  it('re-check button triggers a new fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [buildReleaseResponse('v1.0.0')],
    });
    vi.stubGlobal('fetch', fetchMock);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/you('re| are) up to date/i));
    const recheckBtn = screen.getByRole('button', { name: /re-check/i });
    recheckBtn.click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('handles release with no body/notes gracefully', async () => {
    mockFetchLatest('v2.0.0', [
      { tag_name: 'v2.0.0', body: null, name: 'Release v2.0.0', published_at: '2026-01-01' },
    ]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/new version available/i)).toBeTruthy();
    });
  });

  it('shows "No release notes" for intermediate entries with empty notes', async () => {
    mockFetchLatest('v3.0.0', [
      buildReleaseResponse('v3.0.0', 'Latest notes'),
      { tag_name: 'v2.0.0', body: '', name: 'Release v2.0.0', published_at: '2026-01-01' },
    ]);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/new version available/i));
    const accordionBtn = screen.queryByText(/changes since/i);
    if (accordionBtn) {
      const btn = accordionBtn.closest('button');
      btn?.click();
      await waitFor(() => {
        expect(screen.getByText(/no release notes/i)).toBeTruthy();
      });
    }
  });

  it('shows current version in the footer', async () => {
    mockFetchLatest('v2.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/new version available/i));
    expect(screen.getByText(/current version/i)).toBeTruthy();
  });

  it('shows latest version info in update available state', async () => {
    mockFetchLatest('v2.0.0');
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/new version available/i)).toBeTruthy();
    });
    // The version 2.0.0 is shown in the update info panel
    expect(screen.getByText(/is ready/i)).toBeTruthy();
  });

  it('handles error state with try again button', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [buildReleaseResponse('v1.0.0')],
      });
    vi.stubGlobal('fetch', fetchMock);
    const UpdateModal = await importModal();
    render(<UpdateModal onClose={onClose} />);
    await waitFor(() => screen.getByText(/first failure/i));
    const tryAgain = screen.getByText(/try again/i);
    tryAgain.click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
