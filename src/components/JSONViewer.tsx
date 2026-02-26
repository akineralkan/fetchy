import { useMemo } from 'react';
import { isJWT, decodeJWT } from '../utils/helpers';
import JWTTooltip from './JWTTooltip';

interface JSONViewerProps {
  data: string;
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
        <div className="inline-block w-full">
          <span className="text-fetchy-text">[</span>
          <div className="ml-4">
            {value.map((item, index) => (
              <div key={index} className="mb-1 break-words">
                {renderValue(item, depth + 1)}
                {index < value.length - 1 && <span className="text-fetchy-text-muted">,</span>}
              </div>
            ))}
          </div>
          <span className="text-fetchy-text">]</span>
        </div>
      );
    }

    // Handle object
    if (typeof value === 'object') {
      const entries = Object.entries(value);

      if (entries.length === 0) {
        return <span className="text-fetchy-text">{'{}'}</span>;
      }

      return (
        <div className="inline-block w-full">
          <span className="text-fetchy-text">{'{'}</span>
          <div className="ml-4">
            {entries.map(([k, v], index) => (
              <div key={k} className="flex flex-wrap items-start gap-2 mb-1">
                <span className="json-key flex-shrink-0">"{k}"</span>
                <span className="text-fetchy-text-muted flex-shrink-0">:</span>
                <div className="flex-1 min-w-0 break-words">
                  {renderValue(v, depth + 1)}
                  {index < entries.length - 1 && <span className="text-fetchy-text-muted">,</span>}
                </div>
              </div>
            ))}
          </div>
          <span className="text-fetchy-text">{'}'}</span>
        </div>
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

