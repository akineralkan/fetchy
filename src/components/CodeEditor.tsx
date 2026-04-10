import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePreferencesStore } from '../store/preferencesStore';
import { isLightTheme } from '../utils/editorUtils';

// Light-mode syntax highlight style (VS Code Light+-inspired)
const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName,       color: '#0550ae', fontWeight: '500' }, // JSON keys – blue
  { tag: tags.string,              color: '#0a7a5a' },                    // string values – teal-green
  { tag: tags.number,              color: '#c75028' },                    // numbers – orange-red
  { tag: tags.bool,                color: '#6438bb' },                    // true/false – purple
  { tag: tags.null,                color: '#6438bb' },                    // null – purple
  { tag: tags.punctuation,         color: '#555555' },                    // brackets & colons
  { tag: tags.bracket,             color: '#555555' },
]);

// Dark-mode syntax highlight style (warm, muted palette for custom dark themes)
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName,       color: '#9cdcfe', fontWeight: '500' }, // JSON keys – soft blue
  { tag: tags.string,              color: '#ce9178' },                    // string values – warm peach
  { tag: tags.number,              color: '#b5cea8' },                    // numbers – soft green
  { tag: tags.bool,                color: '#569cd6' },                    // true/false – sky blue
  { tag: tags.null,                color: '#569cd6' },                    // null – sky blue
  { tag: tags.punctuation,         color: '#cccccc' },                    // brackets & colons
  { tag: tags.bracket,             color: '#cccccc' },
]);

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json' | 'javascript' | 'text';
  readOnly?: boolean;
  /** Map of variable name → status for inline highlighting */
  variableStatuses?: Record<string, 'defined' | 'empty' | 'secret' | 'undefined'>;
  /** Called on every doc-change / cursor-move so parent can manage suggestion dropdown */
  onCursorActivity?: (value: string, cursorPos: number, coords: { x: number; y: number } | null) => void;
  /** Return true to swallow the event (e.g. while a suggestion dropdown is open) */
  onKeyDownIntercept?: (e: KeyboardEvent) => boolean;
}

export interface CodeEditorHandle {
  insertAtCursor: (text: string) => void;
  replaceRange: (from: number, to: number, text: string) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ value, onChange, language = 'json', readOnly = false,
    variableStatuses, onCursorActivity, onKeyDownIntercept }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { preferences } = usePreferencesStore();
  const isLight = isLightTheme(preferences.theme);

  // Mutable refs so the extensions always see the latest values without being recreated
  const onChangeRef = useRef(onChange);
  const variableStatusesRef = useRef(variableStatuses ?? {});
  const onCursorActivityRef = useRef(onCursorActivity);
  const onKeyDownInterceptRef = useRef(onKeyDownIntercept);
  // Flag to suppress onChange when we are programmatically syncing the editor content
  const isSyncingRef = useRef(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { variableStatusesRef.current = variableStatuses ?? {}; }, [variableStatuses]);
  useEffect(() => { onCursorActivityRef.current = onCursorActivity; }, [onCursorActivity]);
  useEffect(() => { onKeyDownInterceptRef.current = onKeyDownIntercept; }, [onKeyDownIntercept]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Variable decoration plugin — reads from ref so it always reflects the latest environment
    const variableDecorationPlugin = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) { this.decorations = this._build(view); }
        update(u: ViewUpdate) {
          if (u.docChanged || u.viewportChanged) this.decorations = this._build(u.view);
        }
        _build(view: EditorView): DecorationSet {
          const text = view.state.doc.toString();
          const regex = /<<([^>]+)>>/g;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ranges: any[] = [];
          let m: RegExpExecArray | null;
          while ((m = regex.exec(text)) !== null) {
            const name = m[1].trim();
            const status = variableStatusesRef.current[name] ?? 'undefined';
            const cls = status === 'defined' ? 'var-highlight-defined'
              : status === 'empty' ? 'var-highlight-empty'
              : status === 'secret' ? 'var-highlight-secret'
              : 'var-highlight-undefined';
            ranges.push(Decoration.mark({ class: cls }).range(m.index, m.index + m[0].length));
          }
          return Decoration.set(ranges);
        }
      },
      { decorations: v => v.decorations }
    );

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      // Apply the appropriate syntax highlight style for the current theme
      syntaxHighlighting(isLight ? lightHighlightStyle : darkHighlightStyle),
      ...(isLight ? [] : [oneDark]),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { minHeight: '100%' },
      }),
      Prec.highest(EditorView.theme({
        '&': { backgroundColor: 'var(--input-bg)' },
        '.cm-gutters': { backgroundColor: 'var(--input-bg)', borderRight: '1px solid var(--border-color)' },
        '.cm-activeLine': { backgroundColor: 'transparent' },
        '.cm-activeLineGutter': { backgroundColor: 'transparent' },
        // Override oneDark's near-invisible #3E4451 selection with a clearly contrasted blue
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(99, 153, 225, 0.45)' },
        '& .cm-content ::selection': { backgroundColor: 'rgba(99, 153, 225, 0.35)' },
      })),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly && !isSyncingRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
        if (update.docChanged || update.selectionSet) {
          const cb = onCursorActivityRef.current;
          if (cb) {
            const val = update.state.doc.toString();
            const cursor = update.state.selection.main.head;
            const coords = update.view.coordsAtPos(cursor);
            cb(val, cursor, coords ? { x: coords.left, y: coords.bottom } : null);
          }
        }
      }),
      EditorView.domEventHandlers({
        keydown: (e) => {
          const intercept = onKeyDownInterceptRef.current;
          if (intercept) return intercept(e);
          return false;
        },
      }),
      variableDecorationPlugin,
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
  }, [language, readOnly, isLight]);

  // Update content when value changes externally (e.g. tab switch).
  // We set isSyncingRef so the updateListener does NOT fire onChange for
  // this programmatic content swap — otherwise the stale callback from
  // the previous tab would be invoked before React reconciles.
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        isSyncingRef.current = true;
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
        isSyncingRef.current = false;
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
    replaceRange: (from: number, to: number, text: string) => {
      if (!viewRef.current) return;
      const view = viewRef.current;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
  }));

  return <div ref={editorRef} className="h-full w-full" />;
});

export default CodeEditor;
