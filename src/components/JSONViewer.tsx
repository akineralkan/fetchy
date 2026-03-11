import { useMemo, useState, useCallback, useEffect, useDeferredValue, startTransition, memo } from 'react';
import { isJWT, decodeJWT } from '../utils/helpers';
import JWTTooltip from './JWTTooltip';
import {
  parseJsonSafely,
  truncateJsonString,
  STRING_TRUNCATE_MAX,
} from '../utils/jsonViewerUtils';

interface JSONViewerProps {
  data: string;
}

// Arrays with more items than this auto-collapse on initial render
const AUTO_COLLAPSE_ARRAY_SIZE = 50;
// Objects/arrays at this depth or deeper auto-collapse on initial render
const AUTO_COLLAPSE_DEPTH = 3;
// Bodies larger than this (in chars) skip parsing until the user explicitly requests it
const LARGE_JSON_THRESHOLD = 300_000; // ~300 KB

// ─── Primitive leaf values ────────────────────────────────────────────────────
function JsonLeaf({ value }: { value: unknown }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === 'boolean') return <span className="json-boolean">{value.toString()}</span>;
  if (typeof value === 'number') return <span className="json-number">{value}</span>;
  if (typeof value === 'string') {
    if (isJWT(value)) {
      const decoded = decodeJWT(value);
      if (decoded) {
        return (
          <span className="json-string break-all">
            "<JWTTooltip decodedJWT={decoded}>
              <span className="json-jwt json-jwt-hover break-all">{value}</span>
            </JWTTooltip>"
          </span>
        );
      }
    }
    return <span className="json-string break-all">"{truncateJsonString(value, STRING_TRUNCATE_MAX)}"</span>;
  }
  return <span className="text-fetchy-text">{String(value)}</span>;
}

// ─── Collapsible object / array node ─────────────────────────────────────────
interface JsonNodeProps {
  value: object | unknown[];
  depth: number;
}

const JsonNode = memo(function JsonNode({ value, depth }: JsonNodeProps) {
  const isArray = Array.isArray(value);
  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);

  const count = entries.length;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  const defaultCollapsed =
    (isArray && count > AUTO_COLLAPSE_ARRAY_SIZE) || depth >= AUTO_COLLAPSE_DEPTH;

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (count === 0) {
    return <span className="text-fetchy-text">{openBracket}{closeBracket}</span>;
  }

  return (
    <span className="inline-block w-full">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="inline-flex items-center justify-center w-4 h-4 mr-1 text-[10px] text-fetchy-text-muted hover:text-fetchy-accent transition-colors select-none align-middle"
        aria-label={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? '▶' : '▼'}
      </button>
      <span className="text-fetchy-text">{openBracket}</span>
      {collapsed ? (
        <>
          <span
            className="text-fetchy-text-muted text-xs mx-1 cursor-pointer hover:text-fetchy-accent transition-colors"
            onClick={() => setCollapsed(false)}
          >
            {isArray
              ? `${count} item${count !== 1 ? 's' : ''}`
              : `${count} key${count !== 1 ? 's' : ''}`}
          </span>
          <span className="text-fetchy-text">{closeBracket}</span>
        </>
      ) : (
        <>
          <div className="ml-8">
            {entries.map(([k, v], index) => (
              <div key={k} className="mb-1 break-words">
                {!isArray && (
                  <>
                    <span className="json-key">"{k}"</span>
                    <span className="text-fetchy-text-muted">: </span>
                  </>
                )}
                <JsonValue value={v} depth={depth + 1} />
                {index < count - 1 && <span className="text-fetchy-text-muted">,</span>}
              </div>
            ))}
          </div>
          <span className="text-fetchy-text" style={{ marginLeft: '1.25rem' }}>{closeBracket}</span>
        </>
      )}
    </span>
  );
});

// ─── Value dispatcher – routes to leaf or collapsible node ───────────────────
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value !== null && typeof value === 'object') {
    return <JsonNode value={value as object | unknown[]} depth={depth} />;
  }
  return <JsonLeaf value={value} />;
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function JSONViewer({ data }: JSONViewerProps) {
  // Defer processing of new data so the rest of the UI (status bar, tabs, other
  // panels) stays responsive while the heavy JSON parse + render runs in the
  // background at lower priority.
  const deferredData = useDeferredValue(data);
  const isStale = data !== deferredData;

  const isLargeJson = deferredData.length > LARGE_JSON_THRESHOLD;
  const [renderLarge, setRenderLarge] = useState(false);

  // Reset the large-JSON gate whenever a completely new response body arrives
  // so the warning shows again for each new large response.
  useEffect(() => {
    setRenderLarge(false);
  }, [data]);

  const parsedData = useMemo(() => {
    if (isLargeJson && !renderLarge) return null;
    return parseJsonSafely(deferredData);
  }, [deferredData, isLargeJson, renderLarge]);

  const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString();
    try {
      const parsed = JSON.parse(selectedText.trim());
      e.preventDefault();
      e.clipboardData.setData('text/plain', JSON.stringify(parsed, null, 2));
    } catch {
      // Not standalone JSON — let the browser copy the selected text naturally.
    }
  }, []);

  // Large JSON gate: skip parsing entirely until the user opts in.
  // This prevents a 2 MB+ parse from blocking the main thread on arrival.
  if (isLargeJson && !renderLarge) {
    const sizeKB = Math.round(deferredData.length / 1024);
    const isArray = deferredData.trimStart().startsWith('[');
    return (
      <div className="h-full overflow-auto p-4 flex flex-col gap-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
          <span className="text-yellow-400 shrink-0 mt-0.5">⚠</span>
          <div className="text-fetchy-text-muted">
            <span className="font-medium text-fetchy-text">
              Large {isArray ? 'array' : 'object'} response ({sizeKB} KB)
            </span>
            {' — rendering the full interactive tree may temporarily freeze the UI.'}
          </div>
        </div>
        <button
          onClick={() => startTransition(() => setRenderLarge(true))}
          className="self-start px-3 py-1.5 text-sm rounded bg-fetchy-accent/20 hover:bg-fetchy-accent/30 text-fetchy-accent transition-colors"
        >
          Render Tree
        </button>
        <pre className="text-xs text-fetchy-text-muted font-mono whitespace-pre-wrap break-all leading-relaxed opacity-60 max-h-48 overflow-hidden">
          {deferredData.substring(0, 1500)}
          {deferredData.length > 1500 && '\n…'}
        </pre>
      </div>
    );
  }

  if (!parsedData) {
    return (
      <div className={`h-full overflow-auto p-4 transition-opacity duration-150 ${isStale ? 'opacity-40' : ''}`}>
        <pre className="text-sm text-fetchy-text whitespace-pre-wrap break-words">{deferredData}</pre>
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto p-4 transition-opacity duration-150 ${isStale ? 'opacity-40' : ''}`}
      onCopy={handleCopy}
    >
      <div className="text-sm font-mono break-words max-w-full">
        <JsonValue value={parsedData} />
      </div>
    </div>
  );
}

