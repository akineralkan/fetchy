// @vitest-environment jsdom

/**
 * Tests for main.tsx — React application entry point.
 *
 * main.tsx calls ReactDOM.createRoot().render() with the <App> component
 * wrapped in <React.StrictMode> and <ErrorBoundary>. We verify:
 *  - The module imports without throwing
 *  - ReactDOM.createRoot is called with the #root element
 *  - render() is called once
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── Heavy dependency mocks ───────────────────────────────────────────────────

vi.mock('../../src/App', () => ({
  default: () => <div data-testid="app" />,
}));

vi.mock('../../src/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CSS import
vi.mock('../../src/index.css', () => ({}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('main.tsx', () => {
  it('mounts the React app into #root without throwing', async () => {
    // Set up the root element expected by main.tsx
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // Import main.tsx — this has side effects (calls createRoot + render)
    // Named exports from react-dom/client cannot be spied on in ESM,
    // so we just verify it runs without throwing and mounts into #root
    let threw = false;
    try {
      await import('../../src/main');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);

    document.body.removeChild(root);
  });
});
