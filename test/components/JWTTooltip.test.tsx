// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import JWTTooltip from '../../src/components/JWTTooltip';
import { DecodedJWT, formatJWTDate, isJWTExpired } from '../../src/utils/helpers';

vi.mock('../../src/utils/helpers', () => ({
  formatJWTDate: vi.fn((ts: number) => new Date(ts * 1000).toISOString()),
  isJWTExpired: vi.fn(() => false),
}));

// Clipboard mock
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeJWT = (overrides: Partial<DecodedJWT> = {}): DecodedJWT => ({
  header: { alg: 'HS256', typ: 'JWT' },
  payload: { sub: 'user123', exp: 9999999999 },
  signature: 'sig',
  raw: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.sig',
  ...overrides,
});

describe('JWTTooltip', () => {
  it('renders children', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token-text</span>
      </JWTTooltip>
    );
    expect(screen.getByText('token-text')).toBeDefined();
  });

  it('shows dropdown menu on click', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    expect(screen.getByText('Copy Token')).toBeDefined();
    expect(screen.getByText('Show Decoded Token')).toBeDefined();
  });

  it('copies raw token when "Copy Token" is clicked', async () => {
    const jwt = makeJWT();
    render(
      <JWTTooltip decodedJWT={jwt}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Copy Token'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(jwt.raw);
  });

  it('shows "Copied!" after token copy', async () => {
    vi.useFakeTimers();
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Copy Token'));
    expect(screen.getByText('Copied!')).toBeDefined();
    act(() => { vi.advanceTimersByTime(2000); });
    vi.useRealTimers();
  });

  it('opens decoded modal when "Show Decoded Token" is clicked', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Show Decoded Token'));
    expect(screen.getByText('JWT Token Decoded')).toBeDefined();
    expect(screen.getByText('Header')).toBeDefined();
  });

  it('shows Expired badge when token is expired', () => {
    vi.mocked(isJWTExpired).mockReturnValue(true);
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Show Decoded Token'));
    expect(screen.getByText('Expired')).toBeDefined();
  });

  it('closes modal when X button is clicked', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Show Decoded Token'));
    expect(screen.getByText('JWT Token Decoded')).toBeDefined();
    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByText('JWT Token Decoded')).toBeNull();
  });

  it('closes dropdown with Escape key', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    expect(screen.getByText('Copy Token')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Copy Token')).toBeNull();
  });

  it('closes modal with Escape key', () => {
    render(
      <JWTTooltip decodedJWT={makeJWT()}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Show Decoded Token'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('JWT Token Decoded')).toBeNull();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <JWTTooltip decodedJWT={makeJWT()}>
          <span>token</span>
        </JWTTooltip>
        <span data-testid="outside">outside</span>
      </div>
    );
    fireEvent.click(screen.getByText('token'));
    expect(screen.getByText('Copy Token')).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Copy Token')).toBeNull();
  });

  it('copies header section when header copy button is clicked', () => {
    const jwt = makeJWT();
    render(
      <JWTTooltip decodedJWT={jwt}>
        <span>token</span>
      </JWTTooltip>
    );
    fireEvent.click(screen.getByText('token'));
    fireEvent.click(screen.getByText('Show Decoded Token'));
    const copyButtons = screen.getAllByTitle('Copy header');
    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(jwt.header, null, 2)
    );
  });
});
