import { useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Braces, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import Tooltip from '../Tooltip';
import { formatJson, validateJson, JsonValidationResult } from '../../utils/editorUtils';
import { KeyValue, RequestBody } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import VariableInput from '../VariableInput';
import VariableTextarea from '../VariableTextarea';
import CodeEditor, { CodeEditorHandle } from '../CodeEditor';
import { useAppStore } from '../../store/appStore';

const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'raw', label: 'Raw' },
  { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
  { value: 'form-data', label: 'Form Data' },
] as const;

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}

export default function BodyEditor({ body, onChange }: BodyEditorProps) {
  const { getActiveEnvironment, collections, tabs, activeTabId } = useAppStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeCollection = activeTab?.collectionId
    ? collections.find(c => c.id === activeTab.collectionId)
    : null;

  // Build a variable-name → status map from env + collection variables
  const variableStatuses = useMemo(() => {
    const envVars = getActiveEnvironment()?.variables.filter(v => v.enabled && v.key) ?? [];
    const colVars = activeCollection?.variables?.filter(v => v.enabled && v.key) ?? [];
    const result: Record<string, 'defined' | 'empty' | 'secret' | 'undefined'> = {};
    for (const v of colVars) {
      const val = v.currentValue || v.value || v.initialValue || '';
      result[v.key] = v.isSecret ? 'secret' : val ? 'defined' : 'empty';
    }
    for (const v of envVars) {
      const val = v.currentValue || v.value || v.initialValue || '';
      result[v.key] = v.isSecret ? 'secret' : val ? 'defined' : 'empty';
    }
    return result;
  }, [getActiveEnvironment, activeCollection]);

  const allVariableKeys = useMemo(() => Object.keys(variableStatuses), [variableStatuses]);

  // Suggestion dropdown state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState<{ x: number; y: number } | null>(null);
  const lastCursorRef = useRef<{ pos: number; startIdx: number } | null>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const [jsonValidation, setJsonValidation] = useState<JsonValidationResult | null>(null);

  const handleFormatJson = useCallback(() => {
    const formatted = formatJson(body.raw || '');
    if (formatted !== (body.raw || '')) onChange({ ...body, raw: formatted });
  }, [body, onChange]);

  const handleValidateJson = useCallback(() => {
    setJsonValidation(validateJson(body.raw || ''));
  }, [body.raw]);

  const handleCursorActivity = useCallback((value: string, cursorPos: number, coords: { x: number; y: number } | null) => {
    const textBefore = value.substring(0, cursorPos);
    const lastOpenIdx = textBefore.lastIndexOf('<<');
    if (lastOpenIdx === -1) { setSuggestions([]); setSuggestionPos(null); return; }
    const between = textBefore.substring(lastOpenIdx + 2);
    if (between.includes('>')) { setSuggestions([]); setSuggestionPos(null); return; }
    const partial = between.toLowerCase();
    const filtered = allVariableKeys.filter(k => k.toLowerCase().includes(partial));
    setSuggestions(filtered);
    setSuggestionIndex(0);
    lastCursorRef.current = filtered.length > 0 ? { pos: cursorPos, startIdx: lastOpenIdx } : null;
    setSuggestionPos(filtered.length > 0 && coords ? coords : null);
  }, [allVariableKeys]);

  const acceptSuggestion = useCallback((varName: string) => {
    if (!lastCursorRef.current || !codeEditorRef.current) return;
    const { pos, startIdx } = lastCursorRef.current;
    codeEditorRef.current.replaceRange(startIdx, pos, `<<${varName}>>`);
    setSuggestions([]);
    setSuggestionPos(null);
    lastCursorRef.current = null;
  }, []);

  const handleKeyDownIntercept = useCallback((e: KeyboardEvent): boolean => {
    if (suggestions.length === 0) return false;
    if (e.key === 'ArrowDown') {
      setSuggestionIndex(i => (i + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      setSuggestionIndex(i => (i - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      acceptSuggestion(suggestions[suggestionIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      setSuggestions([]);
      setSuggestionPos(null);
      return true;
    }
    return false;
  }, [suggestions, suggestionIndex, acceptSuggestion]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-fetchy-border">
        {BODY_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => onChange({ ...body, type: type.value as RequestBody['type'] })}
            className={`px-3 py-1 text-sm rounded ${
              body.type === type.value
                ? 'bg-fetchy-accent text-white'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
          >
            {type.label}
          </button>
        ))}

        {body.type === 'json' && (
          <>
            <div className="w-px h-4 bg-fetchy-border mx-1" />
            <button
              onClick={handleFormatJson}
              title="Format JSON"
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border transition-colors"
            >
              <Braces size={13} />
              Format
            </button>
            <Tooltip
              content={
                jsonValidation
                  ? jsonValidation.valid
                    ? '\u2713 Valid JSON'
                    : `\u2717 ${jsonValidation.error}`
                  : 'Validate JSON'
              }
              delay={jsonValidation ? 0 : 500}
            >
              <button
                onClick={handleValidateJson}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-fetchy-border transition-colors ${
                  jsonValidation
                    ? jsonValidation.valid
                      ? 'text-green-500 hover:text-green-400'
                      : 'text-red-400 hover:text-red-300'
                    : 'text-fetchy-text-muted hover:text-fetchy-text'
                }`}
              >
                {jsonValidation ? (
                  jsonValidation.valid ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />
                ) : (
                  <ShieldCheck size={13} />
                )}
                Validate
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {body.type === 'none' && (
          <div className="h-full flex items-center justify-center text-fetchy-text-muted">
            <p>This request does not have a body</p>
          </div>
        )}

        {body.type === 'json' && (
          <>
            <CodeEditor
              ref={codeEditorRef}
              value={body.raw || ''}
              onChange={(value: string) => { setJsonValidation(null); onChange({ ...body, raw: value }); }}
              language="json"
              variableStatuses={variableStatuses}
              onCursorActivity={handleCursorActivity}
              onKeyDownIntercept={handleKeyDownIntercept}
            />
            {suggestionPos && suggestions.length > 0 && createPortal(
              <div
                className="fixed z-[9999] bg-fetchy-card border border-fetchy-border rounded-lg shadow-xl overflow-auto"
                style={{
                  top: suggestionPos.y + 4,
                  left: Math.min(suggestionPos.x, window.innerWidth - 200),
                  maxHeight: '200px',
                  minWidth: '160px',
                }}
              >
                {suggestions.map((name, i) => (
                  <div
                    key={name}
                    className={`px-3 py-1.5 text-sm cursor-pointer font-mono ${
                      i === suggestionIndex
                        ? 'bg-fetchy-accent/20 text-fetchy-accent'
                        : 'text-fetchy-text hover:bg-fetchy-hover'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      acceptSuggestion(name);
                    }}
                  >
                    <span className="opacity-50">{`<<`}</span>{name}<span className="opacity-50">{`>>`}</span>
                  </div>
                ))}
              </div>,
              document.body
            )}
          </>
        )}

        {body.type === 'raw' && (
          <VariableTextarea
            value={body.raw || ''}
            onChange={(value: string) => onChange({ ...body, raw: value })}
            placeholder="Enter request body..."
          />
        )}

        {body.type === 'x-www-form-urlencoded' && (
          <KeyValueTable
            items={body.urlencoded || []}
            onChange={(updated) => onChange({ ...body, urlencoded: updated })}
          />
        )}

        {body.type === 'form-data' && (
          <KeyValueTable
            items={body.formData || []}
            onChange={(updated) => onChange({ ...body, formData: updated })}
          />
        )}
      </div>
    </div>
  );
}

/** Reusable key-value table for urlencoded and form-data body types */
function KeyValueTable({
  items,
  onChange,
}: {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
}) {
  return (
    <div className="p-2">
      <table className="w-full kv-table">
        <thead>
          <tr className="text-left text-xs text-fetchy-text-muted border-b border-fetchy-border">
            <th className="w-8 p-2"></th>
            <th className="p-2">Key</th>
            <th className="p-2">Value</th>
            <th className="w-8 p-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-fetchy-border/50">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => {
                    onChange(items.map(i => i.id === item.id ? { ...i, enabled: e.target.checked } : i));
                  }}
                  className="w-4 h-4 accent-fetchy-accent"
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => {
                    onChange(items.map(i => i.id === item.id ? { ...i, key: e.target.value } : i));
                  }}
                  placeholder="Key"
                  className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                />
              </td>
              <td className="p-0">
                <VariableInput
                  value={item.value}
                  onChange={(value) => {
                    onChange(items.map(i => i.id === item.id ? { ...i, value } : i));
                  }}
                  placeholder="Value"
                  className="w-full bg-transparent p-2 text-sm outline-none focus:bg-fetchy-card"
                />
              </td>
              <td className="p-2">
                <button
                  onClick={() => onChange(items.filter(i => i.id !== item.id))}
                  className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => {
          const newItem: KeyValue = { id: uuidv4(), key: '', value: '', enabled: true };
          onChange([...items, newItem]);
        }}
        className="flex items-center gap-1 px-3 py-2 text-sm text-fetchy-text-muted hover:text-fetchy-text"
      >
        <Plus size={14} /> Add Field
      </button>
    </div>
  );
}
