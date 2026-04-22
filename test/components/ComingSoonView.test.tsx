// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import ComingSoonView from '../../src/components/ComingSoonView';
import type { AppMode } from '../../src/types';

afterEach(() => {
  cleanup();
});

describe('ComingSoonView', () => {
  const modes: Array<[AppMode, string]> = [
    ['rest', 'REST API'],
    ['graphql', 'GraphQL'],
    ['grpc', 'gRPC'],
    ['websocket', 'WebSocket'],
    ['mqtt', 'MQTT'],
    ['socketio', 'Socket.io'],
    ['sse', 'Server-Sent Events'],
  ];

  it.each(modes)('renders the %s placeholder copy', (mode, label) => {
    render(<ComingSoonView mode={mode} />);

    expect(screen.getByRole('heading', { name: label })).toBeTruthy();
    expect(screen.getByText(new RegExp(`${label} support is coming soon`, 'i'))).toBeTruthy();
    expect(screen.getByText('Coming Soon')).toBeTruthy();
  });
});