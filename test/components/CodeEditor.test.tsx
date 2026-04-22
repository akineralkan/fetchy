// @vitest-environment jsdom

import { createRef } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { EditorView } from 'codemirror';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CodeEditor, { CodeEditorHandle } from '../../src/components/CodeEditor';
import { usePreferencesStore } from '../../src/store/preferencesStore';

vi.mock('../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(usePreferencesStore).mockReturnValue({
    preferences: { theme: 'dark' },
  } as never);

  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => ({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* iterator() {
        yield { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
      },
    }),
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CodeEditor', () => {
  it('renders variable decorations and syncs external value changes without firing onChange', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeEditor
        value='{"token":"<<token>>"}'
        onChange={onChange}
        variableStatuses={{ token: 'defined' }}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('.var-highlight-defined')).toBeTruthy();
    });

    rerender(
      <CodeEditor
        value='{"token":"updated"}'
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('.cm-content')?.textContent).toContain('updated');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports imperative insert and replace operations while reporting cursor activity', async () => {
    const ref = createRef<CodeEditorHandle>();
    const onChange = vi.fn();
    const onCursorActivity = vi.fn();

    render(
      <CodeEditor
        ref={ref}
        value=''
        onChange={onChange}
        onCursorActivity={onCursorActivity}
        language='javascript'
      />,
    );

    act(() => {
      ref.current?.insertAtCursor('const value = 1;');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('const value = 1;');
    });

    act(() => {
      ref.current?.replaceRange(0, 5, 'let');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('let value = 1;');
    });

    expect(onCursorActivity.mock.calls.length).toBeGreaterThan(0);
  });

  it('uses the light-theme path, read-only mode, and keydown interception', async () => {
    const onKeyDownIntercept = vi.fn(() => true);
    vi.mocked(usePreferencesStore).mockReturnValue({
      preferences: { theme: 'light' },
    } as never);

    render(
      <CodeEditor
        value='plain text'
        onChange={vi.fn()}
        language='text'
        readOnly
        onKeyDownIntercept={onKeyDownIntercept}
      />,
    );

    const editorElement = document.querySelector('.cm-editor') as HTMLElement;
    const textBox = document.querySelector('.cm-content') as HTMLElement;
    expect(editorElement).toBeTruthy();

    fireEvent.keyDown(textBox, { key: 'Tab' });

    expect(onKeyDownIntercept.mock.calls.length).toBeGreaterThan(0);
  });
});