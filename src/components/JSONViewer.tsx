import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { isJWT, decodeJWT } from '../utils/helpers';
import JWTTooltip from './JWTTooltip';

interface JSONViewerProps {
  data: string;
}

/** Inline fold toggle arrow */
function FoldArrow({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center justify-center w-4 h-4 mr-1 text-fetchy-text-muted hover:text-fetchy-text transition-colors flex-shrink-0 align-middle"
      style={{ verticalAlign: 'middle' }}
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}

/** Collapsible wrapper for objects and arrays */
function CollapsibleNode({
  openBracket,
  closeBracket,
  summary,
  defaultCollapsed = false,
  children,
}: {
  openBracket: string;
  closeBracket: string;
  summary: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <div className="inline-block w-full">
        <FoldArrow collapsed onToggle={() => setCollapsed(false)} />
        <span className="text-fetchy-text">{openBracket}</span>
        <span className="text-fetchy-text-muted italic cursor-pointer" onClick={() => setCollapsed(false)}>
          {' '}{summary}{' '}
        </span>
        <span className="text-fetchy-text">{closeBracket}</span>
      </div>
    );
  }

  return (
    <div className="inline-block w-full">
      <FoldArrow collapsed={false} onToggle={() => setCollapsed(true)} />
      <span className="text-fetchy-text">{openBracket}</span>
      <div className="ml-8">
        {children}
      </div>
      <span className="text-fetchy-text" style={{ marginLeft: '1.25rem' }}>{closeBracket}</span>
    </div>
  );
}

export default function JSONViewer({ data }: JSONViewerProps) {
  const renderValue = (value: any, depth = 0): React.ReactNode => {
    // Handle null
    if (value === null) {
      return <span className="json-null">null</span>;
    }

    // Handle boolean
    if (typeof value === 'boolean') {
      return <span className="json-boolean">{value.toString()}</span>;
    }

    // Handle number
    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>;
    }

    // Handle string
    if (typeof value === 'string') {
      // Check if it's a JWT token
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

      // Regular string - truncate very long strings
      const maxLength = 500;
      const displayValue = value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
      return <span className="json-string break-all">"{displayValue}"</span>;
    }

    // Handle array
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-fetchy-text">[]</span>;
      }

      return (
        <CollapsibleNode
          openBracket="["
          closeBracket="]"
          summary={`${value.length} item${value.length !== 1 ? 's' : ''}`}
          defaultCollapsed={depth >= 3}
        >
          {value.map((item, index) => (
            <div key={index} className="mb-1 break-words">
              {renderValue(item, depth + 1)}
              {index < value.length - 1 && <span className="text-fetchy-text-muted">,</span>}
            </div>
          ))}
        </CollapsibleNode>
      );
    }

    // Handle object
    if (typeof value === 'object') {
      const entries = Object.entries(value);

      if (entries.length === 0) {
        return <span className="text-fetchy-text">{'{}'}</span>;
      }

      return (
        <CollapsibleNode
          openBracket="{"
          closeBracket="}"
          summary={`${entries.length} key${entries.length !== 1 ? 's' : ''}`}
          defaultCollapsed={depth >= 3}
        >
          {entries.map(([k, v], index) => (
            <div key={k} className="mb-1 break-words">
              <span className="json-key">"{k}"</span>
              <span className="text-fetchy-text-muted">: </span>
              {renderValue(v, depth + 1)}
              {index < entries.length - 1 && <span className="text-fetchy-text-muted">,</span>}
            </div>
          ))}
        </CollapsibleNode>
      );
    }

    // Fallback
    return <span className="text-fetchy-text">{String(value)}</span>;
  };

  const parsedData = useMemo(() => {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }, [data]);

  if (!parsedData) {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="text-sm text-fetchy-text whitespace-pre-wrap break-words">{data}</pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="text-sm font-mono break-words max-w-full">
        {renderValue(parsedData)}
      </div>
    </div>
  );
}

