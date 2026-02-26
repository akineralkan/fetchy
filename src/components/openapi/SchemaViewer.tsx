// SchemaViewer Component - Displays OpenAPI schema definitions

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  List,
  Braces,
} from 'lucide-react';
import { ParsedOpenAPI } from './types';
import { resolveRef, getSchemaTypeDisplay } from './utils';

interface SchemaViewerProps {
  schema: Record<string, unknown>;
  spec: ParsedOpenAPI;
  title?: string;
  depth?: number;
}

// Schema viewer component
export const SchemaViewer = ({
  schema,
  spec,
  title,
  depth = 0
}: SchemaViewerProps) => {
  const [expanded, setExpanded] = useState(depth < 2);

  // Resolve $ref if present
  let resolvedSchema = schema;
  let refName: string | null = null;
  if (schema.$ref) {
    refName = (schema.$ref as string).split('/').pop() || null;
    const resolved = resolveRef(schema.$ref as string, spec);
    if (resolved) {
      resolvedSchema = resolved;
    }
  }

  const schemaType = resolvedSchema.type as string;
  const properties = resolvedSchema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (resolvedSchema.required as string[]) || [];
  const items = resolvedSchema.items as Record<string, unknown> | undefined;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return <Type size={12} className="text-green-400" />;
      case 'integer':
      case 'number': return <Hash size={12} className="text-blue-400" />;
      case 'array': return <List size={12} className="text-yellow-400" />;
      case 'object': return <Braces size={12} className="text-purple-400" />;
      case 'boolean': return <span className="text-[10px] text-orange-400">bool</span>;
      default: return null;
    }
  };

  if (schemaType === 'object' && properties) {
    return (
      <div className={`${depth > 0 ? 'ml-4 border-l border-fetchy-border pl-3' : ''}`}>
        {title ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-fetchy-text-muted hover:text-fetchy-text mb-1"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="font-medium">{title}</span>
            {refName ? <span className="text-fetchy-accent">({refName})</span> : null}
          </button>
        ) : null}
        {expanded ? (
          <div className="space-y-1">
            {Object.entries(properties).map(([propName, propSchema]) => {
              const isRequired = required.includes(propName);
              const propType = getSchemaTypeDisplay(propSchema);
              const hasNestedProps = propSchema.type === 'object' || propSchema.$ref ||
                (propSchema.type === 'array' && propSchema.items);

              return (
                <div key={propName} className="text-xs">
                  <div className="flex items-center gap-2 py-1 px-2 bg-fetchy-bg/50 rounded">
                    {getTypeIcon(propSchema.type as string || (propSchema.$ref ? 'object' : 'any'))}
                    <span className="font-mono text-fetchy-text">{propName}</span>
                    <span className="text-fetchy-text-muted">{propType}</span>
                    {isRequired ? (
                      <span className="px-1 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">required</span>
                    ) : null}
                    {propSchema.format ? (
                      <span className="text-fetchy-text-muted">({String(propSchema.format)})</span>
                    ) : null}
                  </div>
                  {propSchema.description ? (
                    <p className="text-fetchy-text-muted ml-6 mt-0.5">{String(propSchema.description)}</p>
                  ) : null}
                  {hasNestedProps && propSchema.type === 'object' ? (
                    <SchemaViewer schema={propSchema} spec={spec} depth={depth + 1} />
                  ) : null}
                  {hasNestedProps && propSchema.$ref ? (
                    <SchemaViewer schema={propSchema} spec={spec} depth={depth + 1} />
                  ) : null}
                  {propSchema.type === 'array' && propSchema.items ? (
                    <div className="ml-4 mt-1">
                      <span className="text-[10px] text-fetchy-text-muted">items:</span>
                      <SchemaViewer schema={propSchema.items as Record<string, unknown>} spec={spec} depth={depth + 1} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (schemaType === 'array' && items) {
    return (
      <div className={`${depth > 0 ? 'ml-4 border-l border-fetchy-border pl-3' : ''}`}>
        {title && (
          <div className="flex items-center gap-2 text-xs text-fetchy-text-muted mb-1">
            <List size={12} className="text-yellow-400" />
            <span className="font-medium">{title}</span>
            <span className="text-fetchy-accent">array</span>
          </div>
        )}
        <div className="text-xs text-fetchy-text-muted ml-2">
          <span>items: </span>
          {items.$ref ? (
            <SchemaViewer schema={items} spec={spec} depth={depth + 1} />
          ) : (
            <span className="text-fetchy-text">{getSchemaTypeDisplay(items)}</span>
          )}
        </div>
      </div>
    );
  }

  // Simple type
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      {getTypeIcon(schemaType)}
      {title ? <span className="font-medium text-fetchy-text-muted">{title}:</span> : null}
      <span className="text-fetchy-text">{schemaType || 'any'}</span>
      {resolvedSchema.format ? <span className="text-fetchy-text-muted">({String(resolvedSchema.format)})</span> : null}
      {refName ? <span className="text-fetchy-accent">({refName})</span> : null}
    </div>
  );
};

