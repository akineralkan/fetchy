import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePreferencesStore } from '../store/preferencesStore';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json' | 'javascript' | 'text';
  readOnly?: boolean;
}

export interface CodeEditorHandle {
  insertAtCursor: (text: string) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ value, onChange, language = 'json', readOnly = false }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { preferences } = usePreferencesStore();
  const isDark = preferences.theme !== 'light';

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      ...(isDark ? [oneDark] : []),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { minHeight: '100%' },
      }),
      Prec.highest(EditorView.theme({
        '&': { backgroundColor: 'var(--input-bg)' },
        '.cm-gutters': { backgroundColor: 'var(--input-bg)', borderRight: '1px solid var(--border-color)' },
        '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--input-bg) 80%, var(--text-color) 20%)' },
        '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--input-bg) 80%, var(--text-color) 20%)' },
      })),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    if (language === 'json') {
      extensions.push(json());
    } else if (language === 'javascript') {
      extensions.push(javascript());
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [language, readOnly, isDark]);

  // Update content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      if (!viewRef.current) return;
      const view = viewRef.current;
      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: text },
        selection: { anchor: selection.from + text.length },
      });
      view.focus();
    },
  }));

  return <div ref={editorRef} className="h-full w-full" />;
});

export default CodeEditor;
