// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AboutModal from '../../src/components/AboutModal';

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '1.0.0');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AboutModal', () => {
  it('renders without crashing when mounted', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByText('About Fetchy')).toBeTruthy();
  });

  it('does not show content when component is not mounted (isOpen=false equivalent)', () => {
    const { unmount } = render(<AboutModal onClose={vi.fn()} />);
    unmount();
    expect(screen.queryByText('About Fetchy')).toBeNull();
  });

  it('calls onClose when the close (X) button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);
    const closeBtns = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the "About Fetchy" heading', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'About Fetchy' })).toBeTruthy();
  });

  it('displays MIT License text', () => {
    render(<AboutModal onClose={vi.fn()} />);
    const licenseElements = screen.getAllByText('MIT License');
    expect(licenseElements.length).toBeGreaterThan(0);
  });

  it('renders at least one open source dependency item', () => {
    render(<AboutModal onClose={vi.fn()} />);
    // React is the first entry in OPEN_SOURCE_DEPS
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('calls onClose when Escape key is pressed on the modal backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<AboutModal onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── GH-88: External URL buttons open in OS default browser ───────────────
  describe('GH-88: external URL buttons open in OS default browser', () => {
    let openExternalUrl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      openExternalUrl = vi.fn().mockResolvedValue({ success: true });
      (window as typeof window & { electronAPI?: { openExternalUrl: ReturnType<typeof vi.fn> } }).electronAPI = {
        openExternalUrl,
      };
    });

    afterEach(() => {
      delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
    });

    it('GitHub Repository button calls openExternalUrl with the correct URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /github repository/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/akineralkan/fetchy');
    });

    it('Documentation button calls openExternalUrl with the correct URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /^documentation$/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://akineralkan.github.io/fetchy/');
    });

    it('MIT License button calls openExternalUrl with the correct URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /mit license/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/AkinerAlkan94/fetchy/blob/main/LICENSE');
    });

    it('View all contributors button calls openExternalUrl with the correct URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /view all contributors/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/AkinerAlkan94/fetchy/graphs/contributors');
    });

    it('React dependency button calls openExternalUrl with the React GitHub URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /^react$/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/facebook/react');
    });

    it('Electron dependency button calls openExternalUrl with the Electron GitHub URL', () => {
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /^electron$/i });
      fireEvent.click(btn);
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/electron/electron');
    });

    it('all OPEN_SOURCE_DEPS buttons call openExternalUrl with their respective URLs', () => {
      const deps = [
        { name: 'React', url: 'https://github.com/facebook/react' },
        { name: 'Electron', url: 'https://github.com/electron/electron' },
        { name: 'TypeScript', url: 'https://github.com/microsoft/TypeScript' },
        { name: 'Vite', url: 'https://github.com/vitejs/vite' },
        { name: 'Tailwind CSS', url: 'https://github.com/tailwindlabs/tailwindcss' },
        { name: 'Zustand', url: 'https://github.com/pmndrs/zustand' },
        { name: 'Immer', url: 'https://github.com/immerjs/immer' },
        { name: 'CodeMirror', url: 'https://github.com/codemirror/codemirror.next' },
        { name: 'dnd-kit', url: 'https://github.com/clauderic/dnd-kit' },
        { name: 'Lucide React', url: 'https://github.com/lucide-icons/lucide' },
        { name: 'Vitest', url: 'https://github.com/vitest-dev/vitest' },
        { name: 'uuid', url: 'https://github.com/uuidjs/uuid' },
        { name: 'js-yaml', url: 'https://github.com/nodeca/js-yaml' },
      ];
      render(<AboutModal onClose={vi.fn()} />);
      for (const dep of deps) {
        const btn = screen.getByRole('button', { name: new RegExp(`^${dep.name}$`, 'i') });
        fireEvent.click(btn);
      }
      for (const dep of deps) {
        expect(openExternalUrl).toHaveBeenCalledWith(dep.url);
      }
    });

    it('does not throw when electronAPI is undefined (graceful optional-chaining fallback)', () => {
      delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /github repository/i });
      expect(() => fireEvent.click(btn)).not.toThrow();
    });

    it('does not call openExternalUrl when electronAPI is undefined', () => {
      delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
      render(<AboutModal onClose={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /github repository/i });
      fireEvent.click(btn);
      expect(openExternalUrl).not.toHaveBeenCalled();
    });

    it('no external link buttons use <a> tags (all converted to <button>)', () => {
      render(<AboutModal onClose={vi.fn()} />);
      // None of the external links should be anchor tags — they should all be buttons
      const anchors = document.querySelectorAll('a[href]');
      expect(anchors.length).toBe(0);
    });
  });
});
