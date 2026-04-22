// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResizeHandle from '../../src/components/ResizeHandle';

afterEach(cleanup);

describe('ResizeHandle', () => {
  it('renders with horizontal cursor style', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.cursor).toBe('col-resize');
  });

  it('renders with vertical cursor style', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="vertical" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.cursor).toBe('row-resize');
  });

  it('applies extra className', () => {
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={vi.fn()} className="my-class" />
    );
    expect((container.firstChild as HTMLElement).className).toContain('my-class');
  });

  it('calls onResize with correct delta on horizontal drag', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;

    // Start drag
    fireEvent.mouseDown(el, { clientX: 100, clientY: 0 });
    // Move mouse
    fireEvent.mouseMove(document, { clientX: 120, clientY: 0 });
    expect(onResize).toHaveBeenCalledWith(20);
  });

  it('calls onResize with correct delta on vertical drag', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="vertical" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;

    fireEvent.mouseDown(el, { clientX: 0, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 0, clientY: 230 });
    expect(onResize).toHaveBeenCalledWith(30);
  });

  it('stops calling onResize after mouseup', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;

    fireEvent.mouseDown(el, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(document);
    fireEvent.mouseMove(document, { clientX: 50, clientY: 0 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('accumulates multiple move events correctly', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={onResize} />
    );
    const el = container.firstChild as HTMLElement;

    fireEvent.mouseDown(el, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 10, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 25, clientY: 0 });

    expect(onResize).toHaveBeenNthCalledWith(1, 10);
    expect(onResize).toHaveBeenNthCalledWith(2, 15);
  });

  it('adds resizing class while dragging', () => {
    const { container } = render(
      <ResizeHandle direction="horizontal" onResize={vi.fn()} />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain('resizing');
    fireEvent.mouseDown(el, { clientX: 0, clientY: 0 });
    expect(el.className).toContain('resizing');
    fireEvent.mouseUp(document);
    expect(el.className).not.toContain('resizing');
  });
});
