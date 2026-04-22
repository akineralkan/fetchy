// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import WelcomeScreen from '../../src/components/WelcomeScreen';
import { useAppStore } from '../../src/store/appStore';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/components/Confetti', () => ({
  default: () => <div data-testid="confetti" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WelcomeScreen', () => {
  const addCollection = vi.fn();
  const addRequest = vi.fn();
  const openTab = vi.fn();

  beforeEach(() => {
    addCollection.mockReturnValue({ id: 'col-1', name: 'My Collection' });
    addRequest.mockReturnValue({ id: 'req-1', name: 'My First Request' });

    vi.mocked(useAppStore).mockReturnValue({
      addCollection,
      addRequest,
      openTab,
    } as never);
  });

  it('creates a starter collection, request, and tab from Quick Start', () => {
    render(
      <WelcomeScreen
        onImportRequest={vi.fn()}
        onImportCollection={vi.fn()}
        onImportEnvironment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /quick start/i }));

    expect(addCollection).toHaveBeenCalledWith('My Collection');
    expect(addRequest).toHaveBeenCalledWith(
      'col-1',
      null,
      expect.objectContaining({
        name: 'My First Request',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
      }),
    );
    expect(openTab).toHaveBeenCalledWith({
      type: 'request',
      title: 'My First Request',
      requestId: 'req-1',
      collectionId: 'col-1',
    });
  });

  it('routes each import button to the matching callback', () => {
    const onImportRequest = vi.fn();
    const onImportCollection = vi.fn();
    const onImportEnvironment = vi.fn();

    render(
      <WelcomeScreen
        onImportRequest={onImportRequest}
        onImportCollection={onImportCollection}
        onImportEnvironment={onImportEnvironment}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /import request/i }));
    fireEvent.click(screen.getByRole('button', { name: /import collection/i }));
    fireEvent.click(screen.getByRole('button', { name: /import environment/i }));

    expect(onImportRequest).toHaveBeenCalledTimes(1);
    expect(onImportCollection).toHaveBeenCalledTimes(1);
    expect(onImportEnvironment).toHaveBeenCalledTimes(1);
    expect(addCollection).not.toHaveBeenCalled();
    expect(addRequest).not.toHaveBeenCalled();
    expect(openTab).not.toHaveBeenCalled();
  });
});