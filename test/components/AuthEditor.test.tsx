// @vitest-environment jsdom

/**
 * Tests for AuthEditor.tsx
 *
 * Covers:
 *  - Renders all auth type buttons
 *  - Switching auth type calls onChange with correct type
 *  - 'none' type shows no-auth message
 *  - 'inherit' type with no parent shows guidance text
 *  - 'inherit' type with parent shows inherited auth details
 *  - 'basic' type shows username/password fields
 *  - 'bearer' type shows token field
 *  - 'api-key' type shows key/value/addTo fields
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import AuthEditor from '../../src/components/request/AuthEditor';
import { useAppStore } from '../../src/store/appStore';
import type { RequestAuth } from '../../src/types';

vi.mock('../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../src/components/VariableInput', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      role="textbox"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function baseStore() {
  return {
    getActiveEnvironment: vi.fn(() => null),
    collections: [],
    tabs: [],
    activeTabId: null,
  };
}

const noneAuth: RequestAuth = { type: 'none' };
const inheritAuth: RequestAuth = { type: 'inherit' };
const basicAuth: RequestAuth = { type: 'basic', basic: { username: 'admin', password: 'pass' } };
const bearerAuth: RequestAuth = { type: 'bearer', bearer: { token: 'mytoken' } };
const apiKeyAuth: RequestAuth = { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'key123', addTo: 'header' } };

describe('AuthEditor', () => {
  it('renders all auth type buttons', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={noneAuth} inheritedAuth={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /inherit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /no auth/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /basic auth/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bearer/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /api key/i })).toBeTruthy();
  });

  it('calls onChange with new type when a type button is clicked', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={noneAuth} inheritedAuth={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /bearer/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'bearer' }));
  });

  it('shows no-auth message for "none" type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={noneAuth} inheritedAuth={null} onChange={vi.fn()} />);
    expect(screen.getByText(/this request does not require authentication/i)).toBeTruthy();
  });

  it('shows guidance when "inherit" type and no parent auth', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={inheritAuth} inheritedAuth={null} onChange={vi.fn()} />);
    expect(screen.getByText(/no auth configured in parent/i)).toBeTruthy();
  });

  it('shows inherited auth details when "inherit" type with bearer parent', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    const parentAuth: RequestAuth = { type: 'bearer', bearer: { token: 'inherited-token' } };
    render(<AuthEditor auth={inheritAuth} inheritedAuth={parentAuth} onChange={vi.fn()} />);
    expect(screen.getByText(/inheriting auth from parent/i)).toBeTruthy();
    // Multiple elements may match /bearer token/i (button + inherited display) — just check at least one exists
    expect(screen.getAllByText(/bearer token/i).length).toBeGreaterThan(0);
  });

  it('shows username and password fields for "basic" type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={basicAuth} inheritedAuth={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/enter username/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/enter password/i)).toBeTruthy();
  });

  it('calls onChange with updated username in basic auth', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={basicAuth} inheritedAuth={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/enter username/i), { target: { value: 'newUser' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ basic: expect.objectContaining({ username: 'newUser' }) })
    );
  });

  it('shows token field for "bearer" type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={bearerAuth} inheritedAuth={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/enter bearer token/i)).toBeTruthy();
  });

  it('calls onChange with updated token in bearer auth', () => {
    const onChange = vi.fn();
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={bearerAuth} inheritedAuth={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/enter bearer token/i), { target: { value: 'newtoken' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bearer: { token: 'newtoken' } })
    );
  });

  it('shows key/value/addTo fields for "api-key" type', () => {
    vi.mocked(useAppStore).mockReturnValue(baseStore() as never);
    render(<AuthEditor auth={apiKeyAuth} inheritedAuth={null} onChange={vi.fn()} />);
    // Actual placeholder is "e.g., X-API-Key"
    expect(screen.getByPlaceholderText(/e\.g\., X-API-Key/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/enter api key value/i)).toBeTruthy();
  });
});
