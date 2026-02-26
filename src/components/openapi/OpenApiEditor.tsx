// OpenApiEditor Component

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useAppStore } from '../../store/appStore';
import ResizeHandle from '../ResizeHandle';
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Server,
  Tag,
  Lock,
  AlertCircle,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  FileInput,
  FileOutput,
  Braces,
  Edit2,
  Save,
  PanelLeftClose,
  PanelRightClose,
  Columns2,
} from 'lucide-react';
import * as jsYaml from 'js-yaml';

import {
  ParsedOpenAPI,
  PathOperation,
  OpenApiEditorProps,
  DEFAULT_OPENAPI_YAML,
  METHOD_COLORS,
  generateExampleFromSchema,
  getSchemaTypeDisplay,
  HtmlDescription,
  SchemaViewer,
} from './index';

export default function OpenApiEditor({ documentId }: OpenApiEditorProps) {
  const { preferences } = usePreferencesStore();
  const { updateOpenApiDocument, getOpenApiDocument, updateTab, tabs } = useAppStore();
  const isDark = preferences.theme !== 'light';

  const [content, setContent] = useState(DEFAULT_OPENAPI_YAML);
  const [savedContent, setSavedContent] = useState(DEFAULT_OPENAPI_YAML);
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [savedFormat, setSavedFormat] = useState<'yaml' | 'json'>('yaml');
  const [parsedSpec, setParsedSpec] = useState<ParsedOpenAPI | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editorWidth, setEditorWidth] = useState(50);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['users', 'products']));
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'info' | 'paths' | 'schemas'>('paths');
  const [documentName, setDocumentName] = useState('New API Spec');
  const [isEditingName, setIsEditingName] = useState(false);
  const [viewMode, setViewMode] = useState<'both' | 'editor' | 'preview'>('both');

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if document has unsaved changes
  const isModified = content !== savedContent || format !== savedFormat;

  // Update tab's isModified state when it changes
  useEffect(() => {
    if (documentId) {
      const tab = tabs.find(t => t.openApiDocId === documentId);
      if (tab && tab.isModified !== isModified) {
        updateTab(tab.id, { isModified });
      }
    }
  }, [isModified, documentId, tabs, updateTab]);

  // Load document if documentId is provided
  useEffect(() => {
    if (documentId) {
      const doc = getOpenApiDocument(documentId);
      if (doc) {
        // Document exists, load its content
        const docContent = doc.content || DEFAULT_OPENAPI_YAML;
        const docFormat = doc.format || 'yaml';
        setContent(docContent);
        setSavedContent(docContent);
        setFormat(docFormat);
        setSavedFormat(docFormat);
        setDocumentName(doc.name || 'New API Spec');
      }
    }
  }, [documentId, getOpenApiDocument]);

  // Parse the OpenAPI content (without auto-saving)
  useEffect(() => {
    try {
      let parsed: ParsedOpenAPI;
      if (format === 'yaml') {
        parsed = jsYaml.load(content) as ParsedOpenAPI;
      } else {
        parsed = JSON.parse(content);
      }
      setParsedSpec(parsed);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
      setParsedSpec(null);
    }
  }, [content, format]);

  // Save document manually
  const saveDocument = useCallback(() => {
    if (documentId) {
      updateOpenApiDocument(documentId, { content, format });
      setSavedContent(content);
      setSavedFormat(format);
    }
  }, [documentId, content, format, updateOpenApiDocument]);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocument]);

  // Handle document name change
  const handleNameChange = useCallback((newName: string) => {
    if (documentId && newName.trim()) {
      setDocumentName(newName.trim());
      updateOpenApiDocument(documentId, { name: newName.trim() });
      // Update all tabs with this openApiDocId to reflect the new name
      tabs.forEach(tab => {
        if (tab.openApiDocId === documentId) {
          updateTab(tab.id, { title: newName.trim() });
        }
      });
    }
    setIsEditingName(false);
  }, [documentId, updateOpenApiDocument, tabs, updateTab]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Initialize CodeMirror
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
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setContent(update.state.doc.toString());
        }
      }),
    ];

    if (format === 'yaml') {
      extensions.push(yaml());
    } else {
      extensions.push(json());
    }

    const state = EditorState.create({
      doc: content,
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
  }, [format, isDark]);

  // Update editor content when it changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: content,
          },
        });
      }
    }
  }, [content]);

  const handleEditorResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const pixelWidth = (editorWidth / 100) * containerWidth;
    const newPixelWidth = Math.max(200, Math.min(containerWidth - 200, pixelWidth + delta));
    const newPercentage = (newPixelWidth / containerWidth) * 100;
    setEditorWidth(newPercentage);
  }, [editorWidth]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const copyEndpoint = (method: string, path: string) => {
    const server = parsedSpec?.servers?.[0]?.url || '';
    const fullUrl = `${server}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEndpoint(`${method}:${path}`);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  // Utility function to resolve $ref references (local scope version)
  const resolveRefLocal = (ref: string, spec: Record<string, unknown>): Record<string, unknown> | null => {
    if (!ref.startsWith('#/')) {
      return null; // Only handle internal references for now
    }

    const path = ref.substring(2).split('/'); // Remove '#/' and split by '/'
    let current: any = spec;

    for (const segment of path) {
      if (current && typeof current === 'object') {
        current = current[segment];
      } else {
        return null;
      }
    }

    return current || null;
  };

  // Utility function to resolve response objects (handles $ref in responses)
  const resolveResponse = (response: any): any => {
    if (response && typeof response === 'object' && response.$ref && typeof response.$ref === 'string') {
      const resolved = resolveRefLocal(response.$ref, parsedSpec as Record<string, unknown> || {});
      return resolved || response;
    }
    return response;
  };

  // Utility function to resolve request body objects (handles $ref in request bodies)
  const resolveRequestBody = (requestBody: any): any => {
    if (requestBody && typeof requestBody === 'object' && requestBody.$ref && typeof requestBody.$ref === 'string') {
      const resolved = resolveRefLocal(requestBody.$ref, parsedSpec as Record<string, unknown> || {});
      return resolved || requestBody;
    }
    return requestBody;
  };

  // Helper to merge path-level and operation-level parameters
  const getMergedParameters = (
    pathItem: Record<string, unknown>,
    operation: PathOperation
  ): Array<{
    name: string;
    in: string;
    description?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
    example?: unknown;
  }> => {
    const pathParams = (pathItem.parameters as Array<Record<string, unknown>> | undefined) || [];
    const opParams = (operation.parameters as Array<Record<string, unknown>> | undefined) || [];

    // Convert path-level $ref parameters to resolved parameters
    const resolvedPathParams = pathParams.map(param => {
      if (param.$ref && typeof param.$ref === 'string') {
        const resolved = resolveRefLocal(param.$ref, parsedSpec as Record<string, unknown> || {});
        if (resolved) {
          return resolved;
        }
        // Fallback to original param if resolution fails
        return param;
      }
      return param;
    });

    // Convert operation-level $ref parameters to resolved parameters
    const resolvedOpParams = opParams.map(param => {
      if (param.$ref && typeof param.$ref === 'string') {
        const resolved = resolveRefLocal(param.$ref, parsedSpec as Record<string, unknown> || {});
        if (resolved) {
          return resolved;
        }
        // Fallback to original param if resolution fails
        return param;
      }
      return param;
    });

    // Merge path and operation parameters, with operation parameters taking precedence
    const paramMap = new Map<string, any>();

    // Add path-level parameters first
    resolvedPathParams.forEach(param => {
      if (param.name && param.in) {
        paramMap.set(`${param.name}:${param.in}`, param);
      }
    });

    // Add/override with operation-level parameters
    resolvedOpParams.forEach(param => {
      if (param.name && param.in) {
        paramMap.set(`${param.name}:${param.in}`, param);
      }
    });

    return Array.from(paramMap.values());
  };

  const convertFormat = () => {
    try {
      if (format === 'yaml') {
        const parsed = jsYaml.load(content);
        setContent(JSON.stringify(parsed, null, 2));
        setFormat('json');
      } else {
        const parsed = JSON.parse(content);
        setContent(jsYaml.dump(parsed, { indent: 2, lineWidth: -1 }));
        setFormat('yaml');
      }
    } catch (e) {
      // Keep the current format if conversion fails
    }
  };

  const downloadSpec = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openapi.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group paths by tags
  const pathsByTag = useMemo(() => {
    if (!parsedSpec?.paths) return new Map<string, Array<{ path: string; method: string; operation: PathOperation; pathItem: Record<string, unknown> }>>();

    const grouped = new Map<string, Array<{ path: string; method: string; operation: PathOperation; pathItem: Record<string, unknown> }>>();

    // Valid HTTP methods in OpenAPI
    const httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

    for (const [path, methods] of Object.entries(parsedSpec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        // Skip non-HTTP method properties (like 'parameters', 'servers', 'summary', 'description', '$ref')
        if (!httpMethods.has(method.toLowerCase())) continue;
        if (typeof operation !== 'object' || !operation) continue;
        const op = operation as PathOperation;

        // If operation has tags, use them; otherwise it goes to 'Untagged'
        if (op.tags && op.tags.length > 0) {
          for (const tag of op.tags) {
            if (!grouped.has(tag)) {
              grouped.set(tag, []);
            }
            grouped.get(tag)!.push({ path, method, operation: op, pathItem: methods as Record<string, unknown> });
          }
        } else {
          // No tags defined, put in Untagged
          if (!grouped.has('Untagged')) {
            grouped.set('Untagged', []);
          }
          grouped.get('Untagged')!.push({ path, method, operation: op, pathItem: methods as Record<string, unknown> });
        }
      }
    }

    return grouped;
  }, [parsedSpec]);

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden bg-fetchy-bg">
      {/* Toolbar */}
      <div className="h-12 bg-fetchy-sidebar border-b border-fetchy-border flex items-center px-4 gap-2 shrink-0 overflow-hidden">
        {/* Document Name */}
        <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
          <FileCode size={18} className="text-fetchy-accent shrink-0" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              defaultValue={documentName}
              className="font-medium text-fetchy-text bg-fetchy-bg border border-fetchy-accent rounded px-2 py-0.5 text-sm outline-none w-full min-w-0"
              onBlur={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameChange(e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="font-medium text-fetchy-text hover:text-fetchy-accent flex items-center gap-1 group min-w-0 max-w-full"
              title={documentName}
            >
              <span className="truncate">{documentName}</span>
              <Edit2 size={12} className="text-fetchy-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save button */}
          <button
            onClick={saveDocument}
            disabled={!isModified}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors whitespace-nowrap ${
              isModified
                ? 'bg-fetchy-accent text-white hover:bg-fetchy-accent/90'
                : 'bg-fetchy-bg border border-fetchy-border text-fetchy-text-muted cursor-not-allowed'
            }`}
            title="Save (Ctrl+S)"
          >
            <Save size={14} />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>

        {/* Unsaved indicator */}
        {isModified ? (
          <div className="flex items-center gap-1.5 text-xs text-yellow-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="hidden lg:inline whitespace-nowrap">Unsaved changes</span>
          </div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1 min-w-4" />

        {/* API Spec Info */}
        {parsedSpec ? (
          <div className="flex items-center gap-2 text-sm text-fetchy-text-muted min-w-0 shrink">
            <span className="px-2 py-0.5 bg-fetchy-accent/20 text-fetchy-accent rounded text-xs font-medium whitespace-nowrap shrink-0">
              {parsedSpec.openapi || parsedSpec.swagger || 'Unknown'}
            </span>
            <span className="truncate hidden md:inline" title={parsedSpec.info?.title || 'Untitled API'}>
              {parsedSpec.info?.title || 'Untitled API'}
            </span>
            <span className="text-fetchy-text-muted whitespace-nowrap shrink-0">
              v{parsedSpec.info?.version || '0.0.0'}
            </span>
          </div>
        ) : null}

        {/* Separator */}
        <div className="w-[2px] h-8 bg-[#3a3a5a] dark:bg-[#3a3a5a] light:bg-[#dee2e6] mx-2 shrink-0" />

        {/* View Mode Toggle - with background extending to right edge to prevent overlap */}
        <div className="flex items-center gap-1 shrink-0 relative z-10 bg-fetchy-sidebar pl-2 pr-4 -ml-2 -mr-4">
          <button
            onClick={() => setViewMode('editor')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'editor'
                ? 'bg-fetchy-accent text-white'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
            title="Editor only"
          >
            <PanelRightClose size={16} />
          </button>
          <button
            onClick={() => setViewMode('both')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'both'
                ? 'bg-fetchy-accent text-white'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
            title="Split view"
          >
            <Columns2 size={16} />
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'preview'
                ? 'bg-fetchy-accent text-white'
                : 'text-fetchy-text-muted hover:text-fetchy-text hover:bg-fetchy-border'
            }`}
            title="Preview only"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel - always render but hide with CSS to preserve editor state */}
        <div
          style={{
            width: viewMode === 'editor' ? '100%' : viewMode === 'both' ? `${editorWidth}%` : '0',
            display: viewMode === 'preview' ? 'none' : 'flex'
          }}
          className="h-full flex-col shrink-0 overflow-hidden"
        >
          <div className="h-8 bg-fetchy-sidebar border-b border-fetchy-border flex items-center px-3 gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${format === 'yaml' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {format.toUpperCase()}
            </span>
            <span className="text-xs text-fetchy-text-muted">Source</span>
          </div>
          <div ref={editorRef} className="flex-1 overflow-auto" />
        </div>

        {/* Resize Handle - only show in split view */}
        {viewMode === 'both' && (
          <ResizeHandle direction="horizontal" onResize={handleEditorResize} />
        )}

        {/* Visualization Panel - always render but hide with CSS to maintain consistency */}
        <div
          style={{
            display: viewMode === 'editor' ? 'none' : 'flex'
          }}
          className="flex-1 h-full flex-col overflow-hidden"
        >
          <div className="h-8 bg-fetchy-sidebar border-b border-fetchy-border flex items-center px-3">
            <span className="text-xs text-fetchy-text-muted">Preview</span>
          </div>

          {parseError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-fetchy-text mb-2">Parse Error</h3>
                <p className="text-sm text-fetchy-text-muted font-mono bg-fetchy-sidebar p-3 rounded">
                  {parseError}
                </p>
              </div>
            </div>
          ) : parsedSpec ? (
            <div className="flex-1 overflow-auto">
              {/* API Info Section */}
              <div className="p-4 border-b border-fetchy-border">
                <h2 className="text-xl font-bold text-fetchy-text mb-1">{parsedSpec.info?.title || 'Untitled API'}</h2>
                {parsedSpec.info?.description && (
                  <div className="text-sm text-fetchy-text-muted mb-3"><HtmlDescription html={parsedSpec.info.description} /></div>
                )}

                {/* Servers */}
                {parsedSpec.servers && parsedSpec.servers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {parsedSpec.servers.map((server, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-fetchy-sidebar rounded text-xs">
                        <Server size={12} className="text-fetchy-accent" />
                        <span className="text-fetchy-text">{server.url}</span>
                        {server.description && (
                          <span className="text-fetchy-text-muted">({server.description})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Section tabs */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setActiveSection('paths')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'paths' ? 'bg-fetchy-accent text-white' : 'bg-fetchy-sidebar text-fetchy-text hover:bg-fetchy-border'}`}
                  >
                    Paths
                  </button>
                  <button
                    onClick={() => setActiveSection('schemas')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'schemas' ? 'bg-fetchy-accent text-white' : 'bg-fetchy-sidebar text-fetchy-text hover:bg-fetchy-border'}`}
                  >
                    Schemas
                  </button>
                  <button
                    onClick={() => setActiveSection('info')}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${activeSection === 'info' ? 'bg-fetchy-accent text-white' : 'bg-fetchy-sidebar text-fetchy-text hover:bg-fetchy-border'}`}
                  >
                    Info
                  </button>
                </div>
              </div>

              {/* Paths Section */}
              {activeSection === 'paths' && (
                <div className="p-4">
                  {Array.from(pathsByTag.entries()).map(([tag, operations]) => (
                    <div key={tag} className="mb-4">
                      {/* Tag Header */}
                      <button
                        onClick={() => toggleTag(tag)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-fetchy-sidebar transition-colors"
                      >
                        {expandedTags.has(tag) ? (
                          <ChevronDown size={16} className="text-fetchy-text-muted" />
                        ) : (
                          <ChevronRight size={16} className="text-fetchy-text-muted" />
                        )}
                        <Tag size={14} className="text-fetchy-accent" />
                        <span className="font-medium text-fetchy-text">{tag}</span>
                        <span className="text-xs text-fetchy-text-muted">({operations.length})</span>
                      </button>

                      {/* Operations */}
                      {expandedTags.has(tag) && (
                        <div className="ml-6 space-y-2">
                          {operations.map(({ path, method, operation, pathItem }) => {
                            const pathKey = `${method}:${path}`;
                            const isExpanded = expandedPaths.has(pathKey);
                            const mergedParameters = getMergedParameters(pathItem, operation);

                            return (
                              <div key={pathKey} className="border border-fetchy-border rounded overflow-hidden">
                                {/* Operation Header */}
                                <button
                                  onClick={() => togglePath(pathKey)}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-fetchy-sidebar/50 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={14} className="text-fetchy-text-muted shrink-0" />
                                  ) : (
                                    <ChevronRight size={14} className="text-fetchy-text-muted shrink-0" />
                                  )}
                                  <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded border ${METHOD_COLORS[method] || METHOD_COLORS.get}`}>
                                    {method}
                                  </span>
                                  <span className="font-mono text-sm text-fetchy-text flex-1 text-left">{path}</span>
                                  {operation.deprecated && (
                                    <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                                      Deprecated
                                    </span>
                                  )}
                                  {operation.summary && (
                                    <span className="text-sm text-fetchy-text-muted truncate max-w-[200px]">
                                      {operation.summary}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyEndpoint(method, path);
                                    }}
                                    className="p-1 hover:bg-fetchy-border rounded"
                                    title="Copy endpoint URL"
                                  >
                                    {copiedEndpoint === pathKey ? (
                                      <Check size={14} className="text-green-400" />
                                    ) : (
                                      <Copy size={14} className="text-fetchy-text-muted" />
                                    )}
                                  </button>
                                </button>

                                {/* Operation Details */}
                                {isExpanded && (
                                  <div className="border-t border-fetchy-border bg-fetchy-sidebar/30">
                                    {/* Description */}
                                    {operation.description && (
                                      <div className="p-4 border-b border-fetchy-border">
                                        <div className="text-sm text-fetchy-text"><HtmlDescription html={operation.description} /></div>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 divide-x divide-fetchy-border">
                                      {/* REQUEST SIDE */}
                                      <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                          <ArrowUpRight size={16} className="text-blue-400" />
                                          <h4 className="text-sm font-semibold text-fetchy-text">Request</h4>
                                        </div>

                                        {/* Path Parameters */}
                                        {(() => {
                                          const pathParams = mergedParameters?.filter(p => p.in === 'path') || [];
                                          return pathParams.length > 0 ? (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-fetchy-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Path Parameters
                                              </h5>
                                              <div className="space-y-1">
                                                {pathParams.map((param, idx) => (
                                                  <div key={idx} className="p-2 bg-fetchy-bg rounded text-xs">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-mono font-medium text-fetchy-accent">{param.name}</span>
                                                      {param.schema && (
                                                        <span className="text-fetchy-text-muted">{getSchemaTypeDisplay(param.schema)}</span>
                                                      )}
                                                      <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">required</span>
                                                    </div>
                                                    {param.description && (
                                                      <div className="text-fetchy-text-muted mt-1"><HtmlDescription html={param.description} /></div>
                                                    )}
                                                    {param.example !== undefined && (
                                                      <p className="text-fetchy-text mt-1">Example: <code className="bg-fetchy-sidebar px-1 rounded">{String(param.example)}</code></p>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null;
                                        })()}

                                        {/* Query Parameters */}
                                        {(() => {
                                          const queryParams = mergedParameters?.filter(p => p.in === 'query') || [];
                                          return queryParams.length > 0 ? (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-fetchy-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Query Parameters
                                              </h5>
                                              <div className="space-y-1">
                                                {queryParams.map((param, idx) => (
                                                  <div key={idx} className="p-2 bg-fetchy-bg rounded text-xs">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-mono font-medium text-fetchy-accent">{param.name}</span>
                                                      {param.schema && (
                                                        <span className="text-fetchy-text-muted">{getSchemaTypeDisplay(param.schema)}</span>
                                                      )}
                                                      {param.required && (
                                                        <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">required</span>
                                                      )}
                                                    </div>
                                                    {param.description && (
                                                      <div className="text-fetchy-text-muted mt-1"><HtmlDescription html={param.description} /></div>
                                                    )}
                                                    {param.schema?.default !== undefined && (
                                                      <p className="text-fetchy-text mt-1">Default: <code className="bg-fetchy-sidebar px-1 rounded">{String(param.schema.default)}</code></p>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null;
                                        })()}

                                        {/* Request Headers - Always show */}
                                        {(() => {
                                          const headerParams = mergedParameters?.filter(p => p.in === 'header') || [];
                                          return (
                                            <div className="mb-4">
                                              <h5 className="text-xs font-medium text-fetchy-text-muted uppercase mb-2 flex items-center gap-1">
                                                <FileInput size={12} />
                                                Request Headers
                                                {headerParams.length > 0 && (
                                                  <span className="text-[10px] text-fetchy-accent ml-1">
                                                    ({headerParams.length})
                                                  </span>
                                                )}
                                              </h5>
                                              {headerParams.length > 0 ? (
                                                <div className="bg-fetchy-bg rounded overflow-hidden">
                                                  <table className="w-full text-xs">
                                                    <thead>
                                                      <tr className="border-b border-fetchy-border bg-fetchy-sidebar/50">
                                                        <th className="text-left p-2 font-medium text-fetchy-text-muted">Header</th>
                                                        <th className="text-left p-2 font-medium text-fetchy-text-muted">Type</th>
                                                        <th className="text-left p-2 font-medium text-fetchy-text-muted">Required</th>
                                                        <th className="text-left p-2 font-medium text-fetchy-text-muted">Description</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {headerParams.map((param, idx) => (
                                                        <tr key={idx} className="border-b border-fetchy-border/50 last:border-0">
                                                          <td className="p-2">
                                                            <span className="font-mono font-medium text-fetchy-accent">{param.name}</span>
                                                          </td>
                                                          <td className="p-2 text-fetchy-text-muted">
                                                            {param.schema ? getSchemaTypeDisplay(param.schema) : 'string'}
                                                            {param.schema?.format ? (
                                                              <div className="text-[10px] text-fetchy-text-muted mt-0.5">
                                                                format: {String(param.schema.format)}
                                                              </div>
                                                            ) : null}
                                                            {param.schema?.enum ? (
                                                              <div className="text-[10px] text-fetchy-text-muted mt-0.5">
                                                                enum: [{(param.schema.enum as string[]).join(', ')}]
                                                              </div>
                                                            ) : null}
                                                          </td>
                                                          <td className="p-2">
                                                            {param.required ? (
                                                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">Yes</span>
                                                            ) : (
                                                              <span className="text-fetchy-text-muted">No</span>
                                                            )}
                                                          </td>
                                                          <td className="p-2 text-fetchy-text-muted">
                                                            {param.description || '-'}
                                                            {param.example !== undefined ? (
                                                              <div className="mt-1">
                                                                <span className="text-[10px]">Example: </span>
                                                                <code className="bg-fetchy-sidebar px-1 rounded text-fetchy-text">{String(param.example)}</code>
                                                              </div>
                                                            ) : null}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p className="text-xs text-fetchy-text-muted italic bg-fetchy-bg p-2 rounded">No request headers defined</p>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Request Body */}
                                        {operation.requestBody && (() => {
                                          const resolvedRequestBody = resolveRequestBody(operation.requestBody);
                                          return (
                                          <div className="mb-4">
                                            <h5 className="text-xs font-medium text-fetchy-text-muted uppercase mb-2 flex items-center gap-1">
                                              <FileInput size={12} />
                                              Request Body
                                              {resolvedRequestBody.required ? (
                                                <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] ml-1">required</span>
                                              ) : null}
                                            </h5>
                                            {resolvedRequestBody.description ? (
                                              <div className="text-xs text-fetchy-text-muted mb-2"><HtmlDescription html={resolvedRequestBody.description} /></div>
                                            ) : null}
                                            {resolvedRequestBody.content ? Object.entries(resolvedRequestBody.content).map(([contentType, content]) => {
                                              // Generate example JSON from schema if no explicit example
                                              const typedContent = content as { schema?: Record<string, unknown>; example?: unknown };
                                              const exampleJson = typedContent.example ||
                                                (typedContent.schema ? generateExampleFromSchema(typedContent.schema, parsedSpec!) : null);

                                              return (
                                                <div key={contentType} className="bg-fetchy-bg rounded overflow-hidden mb-2">
                                                  <div className="px-2 py-1 bg-fetchy-sidebar/50 border-b border-fetchy-border flex items-center justify-between">
                                                    <span className="text-xs font-mono text-fetchy-accent">{contentType}</span>
                                                    {exampleJson ? (
                                                      <button
                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                                                        className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
                                                        title="Copy JSON"
                                                      >
                                                        <Copy size={12} />
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div className="p-2">
                                                    {/* Show JSON Example First */}
                                                    {exampleJson ? (
                                                      <div className="mb-3">
                                                        <span className="text-[10px] text-fetchy-text-muted uppercase font-medium">Example JSON:</span>
                                                        <pre className="text-xs bg-fetchy-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                                          {JSON.stringify(exampleJson, null, 2)}
                                                        </pre>
                                                      </div>
                                                    ) : null}
                                                    {/* Schema Details (collapsible) */}
                                                    {typedContent.schema ? (
                                                      <details className="mt-2">
                                                        <summary className="text-[10px] text-fetchy-text-muted uppercase cursor-pointer hover:text-fetchy-text">
                                                          Schema Details
                                                        </summary>
                                                        <div className="mt-2 pl-2 border-l-2 border-fetchy-border">
                                                          <SchemaViewer schema={typedContent.schema} spec={parsedSpec!} />
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            }) : null}
                                          </div>
                                          );
                                        })()}

                                        {/* Security */}
                                        {operation.security && operation.security.length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-medium text-fetchy-text-muted uppercase mb-2 flex items-center gap-1">
                                              <Lock size={12} />
                                              Security
                                            </h5>
                                            <div className="flex flex-wrap gap-1">
                                              {operation.security.map((sec, idx) => (
                                                Object.entries(sec).map(([key, scopes]) => (
                                                  <div key={`${idx}-${key}`} className="px-2 py-1 bg-fetchy-bg rounded text-xs">
                                                    <span className="font-medium text-fetchy-accent">{key}</span>
                                                    {scopes && scopes.length > 0 && (
                                                      <span className="text-fetchy-text-muted ml-1">({scopes.join(', ')})</span>
                                                    )}
                                                  </div>
                                                ))
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* No request body message */}
                                        {!operation.requestBody && (
                                          <p className="text-xs text-fetchy-text-muted italic bg-fetchy-bg p-2 rounded">No request body</p>
                                        )}
                                      </div>

                                      {/* RESPONSE SIDE */}
                                      <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                          <ArrowDownLeft size={16} className="text-green-400" />
                                          <h4 className="text-sm font-semibold text-fetchy-text">Responses</h4>
                                        </div>

                                        {operation.responses && Object.entries(operation.responses).map(([code, response]) => {
                                          const resolvedResponse = resolveResponse(response);
                                          return (
                                          <div key={code} className="mb-4 last:mb-0">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                                code.startsWith('2') ? 'bg-green-500/20 text-green-400' :
                                                code.startsWith('3') ? 'bg-blue-500/20 text-blue-400' :
                                                code.startsWith('4') ? 'bg-yellow-500/20 text-yellow-400' :
                                                code.startsWith('5') ? 'bg-red-500/20 text-red-400' :
                                                'bg-fetchy-sidebar text-fetchy-text-muted'
                                              }`}>
                                                {code}
                                              </span>
                                              <span className="text-xs text-fetchy-text"><HtmlDescription html={resolvedResponse.description || ''} /></span>
                                            </div>

                                            {/* Response Headers - Always show */}
                                            {(() => {
                                              const responseHeaders = resolvedResponse.headers ? Object.entries(resolvedResponse.headers) : [];
                                              return (
                                                <div className="mb-2 ml-2">
                                                  <h6 className="text-[10px] font-medium text-fetchy-text-muted uppercase mb-1 flex items-center gap-1">
                                                    <FileOutput size={10} />
                                                    Response Headers
                                                    {responseHeaders.length > 0 && (
                                                      <span className="text-[10px] text-fetchy-accent ml-1">
                                                        ({responseHeaders.length})
                                                      </span>
                                                    )}
                                                  </h6>
                                                  {responseHeaders.length > 0 ? (
                                                    <div className="bg-fetchy-bg rounded overflow-hidden">
                                                      <table className="w-full text-xs">
                                                        <thead>
                                                          <tr className="border-b border-fetchy-border bg-fetchy-sidebar/50">
                                                            <th className="text-left p-1.5 font-medium text-fetchy-text-muted">Header</th>
                                                            <th className="text-left p-1.5 font-medium text-fetchy-text-muted">Type</th>
                                                            <th className="text-left p-1.5 font-medium text-fetchy-text-muted">Description</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {responseHeaders.map(([headerName, headerDef]) => {
                                                            const typedHeaderDef = headerDef as { description?: string; schema?: Record<string, unknown> };
                                                            return (
                                                            <tr key={headerName} className="border-b border-fetchy-border/50 last:border-0">
                                                              <td className="p-1.5">
                                                                <span className="font-mono font-medium text-fetchy-accent">{headerName}</span>
                                                              </td>
                                                              <td className="p-1.5 text-fetchy-text-muted">
                                                                {typedHeaderDef.schema ? getSchemaTypeDisplay(typedHeaderDef.schema) : 'string'}
                                                                {typedHeaderDef.schema?.format ? (
                                                                  <div className="text-[10px] mt-0.5">format: {String(typedHeaderDef.schema.format)}</div>
                                                                ) : null}
                                                              </td>
                                                              <td className="p-1.5 text-fetchy-text-muted">
                                                                {typedHeaderDef.description || '-'}
                                                              </td>
                                                            </tr>
                                                          )})}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  ) : (
                                                    <p className="text-[10px] text-fetchy-text-muted italic bg-fetchy-bg p-1.5 rounded">No response headers defined</p>
                                                  )}
                                                </div>
                                              );
                                            })()}

                                            {/* Response Body */}
                                            {resolvedResponse.content ? Object.entries(resolvedResponse.content).map(([contentType, content]) => {
                                              const typedContent = content as { schema?: Record<string, unknown>; example?: unknown; examples?: Record<string, { value?: unknown; summary?: string }> };
                                              // Generate example JSON from schema if no explicit example
                                              const exampleJson = typedContent.example ||
                                                (typedContent.examples ? Object.values(typedContent.examples)[0]?.value : null) ||
                                                (typedContent.schema ? generateExampleFromSchema(typedContent.schema, parsedSpec!) : null);

                                              return (
                                                <div key={contentType} className="bg-fetchy-bg rounded overflow-hidden ml-2 mb-2">
                                                  <div className="px-2 py-1 bg-fetchy-sidebar/50 border-b border-fetchy-border flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      <FileOutput size={10} className="text-fetchy-text-muted" />
                                                      <span className="text-xs font-mono text-fetchy-accent">{contentType}</span>
                                                    </div>
                                                    {exampleJson ? (
                                                      <button
                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                                                        className="p-1 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
                                                        title="Copy JSON"
                                                      >
                                                        <Copy size={12} />
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div className="p-2">
                                                    {/* Show JSON Example First */}
                                                    {exampleJson ? (
                                                      <div className="mb-3">
                                                        <span className="text-[10px] text-fetchy-text-muted uppercase font-medium">Example JSON:</span>
                                                        <pre className="text-xs bg-fetchy-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                                          {JSON.stringify(exampleJson, null, 2)}
                                                        </pre>
                                                      </div>
                                                    ) : null}
                                                    {/* Multiple examples if available */}
                                                    {typedContent.examples && Object.keys(typedContent.examples).length > 1 ? (
                                                      <details className="mb-2">
                                                        <summary className="text-[10px] text-fetchy-text-muted uppercase cursor-pointer hover:text-fetchy-text">
                                                          More Examples ({Object.keys(typedContent.examples).length})
                                                        </summary>
                                                        <div className="mt-2 space-y-2">
                                                          {Object.entries(typedContent.examples).slice(1).map(([exName, ex]) => (
                                                            <div key={exName}>
                                                              <span className="text-[10px] text-fetchy-text-muted">
                                                                {ex.summary || exName}:
                                                              </span>
                                                              <pre className="text-xs bg-fetchy-sidebar text-green-400 p-2 rounded mt-1 overflow-auto max-h-40 font-mono">
                                                                {JSON.stringify(ex.value, null, 2)}
                                                              </pre>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                    {/* Schema Details (collapsible) */}
                                                    {typedContent.schema ? (
                                                      <details>
                                                        <summary className="text-[10px] text-fetchy-text-muted uppercase cursor-pointer hover:text-fetchy-text">
                                                          Schema Details
                                                        </summary>
                                                        <div className="mt-2 pl-2 border-l-2 border-fetchy-border">
                                                          <SchemaViewer schema={typedContent.schema} spec={parsedSpec!} />
                                                        </div>
                                                      </details>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            }) : null}

                                            {/* No response body message */}
                                            {!resolvedResponse.content ? (
                                              <p className="text-[10px] text-fetchy-text-muted italic ml-2 bg-fetchy-bg p-1.5 rounded">No response body</p>
                                            ) : null}
                                          </div>
                                        )})}

                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Schemas Section */}
              {activeSection === 'schemas' && parsedSpec.components?.schemas ? (
                <div className="p-4">
                  <div className="space-y-3">
                    {Object.entries(parsedSpec.components.schemas).map(([name, schema]) => {
                      const schemaObj = schema as Record<string, unknown>;
                      const exampleJson = generateExampleFromSchema(schemaObj, parsedSpec);

                      return (
                        <div key={name} className="border border-fetchy-border rounded overflow-hidden">
                          <div className="flex items-center justify-between p-3 bg-fetchy-sidebar/50">
                            <div className="flex items-center gap-2">
                              <Braces size={14} className="text-purple-400" />
                              <span className="font-mono font-medium text-fetchy-text">{name}</span>
                              {schemaObj.type ? (
                                <span className="text-xs text-fetchy-text-muted">({String(schemaObj.type)})</span>
                              ) : null}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(JSON.stringify(exampleJson, null, 2))}
                              className="p-1.5 hover:bg-fetchy-border rounded text-fetchy-text-muted hover:text-fetchy-text"
                              title="Copy example JSON"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          {schemaObj.description ? (
                            <div className="px-3 py-2 border-b border-fetchy-border bg-fetchy-bg/50">
                              <p className="text-xs text-fetchy-text-muted">{String(schemaObj.description)}</p>
                            </div>
                          ) : null}
                          <div className="p-3 bg-fetchy-bg">
                            {/* Example JSON */}
                            <div className="mb-3">
                              <span className="text-[10px] text-fetchy-text-muted uppercase font-medium">Example JSON:</span>
                              <pre className="text-xs bg-fetchy-sidebar text-green-400 p-3 rounded mt-1 overflow-auto max-h-60 font-mono">
                                {JSON.stringify(exampleJson, null, 2)}
                              </pre>
                            </div>
                            {/* Schema Definition */}
                            <details>
                              <summary className="text-[10px] text-fetchy-text-muted uppercase cursor-pointer hover:text-fetchy-text">
                                Schema Definition
                              </summary>
                              <pre className="text-xs text-fetchy-text-muted overflow-auto mt-2 p-2 bg-fetchy-sidebar rounded">
                                {JSON.stringify(schema, null, 2)}
                              </pre>
                            </details>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Info Section */}
              {activeSection === 'info' && (
                <div className="p-4 space-y-4">
                  {parsedSpec.info?.contact && (
                    <div className="border border-fetchy-border rounded p-4">
                      <h3 className="font-medium text-fetchy-text mb-2">Contact</h3>
                      <div className="space-y-1 text-sm text-fetchy-text-muted">
                        {parsedSpec.info.contact.name && <p>Name: {parsedSpec.info.contact.name}</p>}
                        {parsedSpec.info.contact.email && <p>Email: {parsedSpec.info.contact.email}</p>}
                        {parsedSpec.info.contact.url && <p>URL: {parsedSpec.info.contact.url}</p>}
                      </div>
                    </div>
                  )}

                  {parsedSpec.info?.license && (
                    <div className="border border-fetchy-border rounded p-4">
                      <h3 className="font-medium text-fetchy-text mb-2">License</h3>
                      <div className="space-y-1 text-sm text-fetchy-text-muted">
                        <p>Name: {parsedSpec.info.license.name}</p>
                        {parsedSpec.info.license.url && <p>URL: {parsedSpec.info.license.url}</p>}
                      </div>
                    </div>
                  )}

                  {parsedSpec.components?.securitySchemes && (
                    <div className="border border-fetchy-border rounded p-4">
                      <h3 className="font-medium text-fetchy-text mb-2">Security Schemes</h3>
                      <div className="space-y-2">
                        {Object.entries(parsedSpec.components.securitySchemes).map(([name, scheme]) => (
                          <div key={name} className="p-2 bg-fetchy-sidebar rounded">
                            <span className="font-mono text-sm text-fetchy-accent">{name}</span>
                            <pre className="text-xs text-fetchy-text-muted mt-1">
                              {JSON.stringify(scheme, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-fetchy-text-muted">
              Start typing your OpenAPI specification...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

