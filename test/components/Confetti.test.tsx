// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Confetti from '../../src/components/Confetti';

let now = 0;

function createContext() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
  };
}

describe('Confetti', () => {
  let context: ReturnType<typeof createContext>;

  beforeEach(() => {
    now = 0;
    context = createContext();

    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    let randomIndex = 0;
    const randomValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randomValues[randomIndex % randomValues.length];
      randomIndex += 1;
      return value;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return 320;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return 180;
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sizes the canvas, draws confetti, and cleans up the animation frame', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { container, unmount } = render(
      <div>
        <Confetti />
      </div>,
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(180);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(context.arc).toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('stops scheduling new frames after the animation duration elapses', () => {
    render(
      <div>
        <Confetti />
      </div>,
    );

    now = 4000;
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(context.globalAlpha).toBe(0);
  });

  it('bails out cleanly when the canvas context is unavailable', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null);

    const { container } = render(
      <div>
        <Confetti />
      </div>,
    );

    expect(container.querySelector('canvas')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});