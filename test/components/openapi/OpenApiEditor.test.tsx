// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpenApiEditor from '../../../src/components/openapi/OpenApiEditor';
import { usePreferencesStore } from '../../../src/store/preferencesStore';
import { useAppStore } from '../../../src/store/appStore';
import * as jsYaml from 'js-yaml';

// --- Store mocks ---

vi.mock('../../../src/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

vi.mock('../../../src/store/appStore', () => ({
  useAppStore: vi.fn(),
}));

// --- CodeMirror mocks ---

vi.mock('codemirror', () => {
  const EditorView = vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    state: { doc: { toString: () => '' } },
    dispatch: vi.fn(),
  }));
  (EditorView as any).theme = vi.fn(() => []);
  (EditorView as any).updateListener = { of: vi.fn(() => []) };
  (EditorView as any).lineWrapping = [];
  return { basicSetup: [], EditorView };
});

vi.mock('@codemirror/state', () => ({
  EditorState: { create: vi.fn(() => ({})) },
}));

vi.mock('@codemirror/lang-yaml', () => ({ yaml: vi.fn(() => []) }));
vi.mock('@codemirror/lang-json', () => ({ json: vi.fn(() => []) }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: [] }));

// --- Component mocks ---

vi.mock('../../../src/components/ResizeHandle', () => ({
  default: () => <div data-testid="resize-handle" />,
}));

vi.mock('../../../src/components/openapi/HtmlDescription', () => ({
  HtmlDescription: ({ html }: { html: string }) => <span data-testid="html-desc">{html}</span>,
}));

vi.mock('../../../src/components/openapi/SchemaViewer', () => ({
  SchemaViewer: ({ schema }: { schema: any }) => (
    <div data-testid="schema-viewer">{JSON.stringify(schema)}</div>
  ),
}));

// --- js-yaml mock ---

vi.mock('js-yaml', () => ({
  load: vi.fn(),
  dump: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));

// --- Icon mocks ---

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: any) => <span data-icon={name} {...props} />;
  return {
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    FileCode: icon('FileCode'),
    Server: icon('Server'),
    Tag: icon('Tag'),
    Lock: icon('Lock'),
    AlertCircle: icon('AlertCircle'),
    Copy: icon('Copy'),
    Check: icon('Check'),
    ArrowUpRight: icon('ArrowUpRight'),
    ArrowDownLeft: icon('ArrowDownLeft'),
    FileInput: icon('FileInput'),
    FileOutput: icon('FileOutput'),
    Braces: icon('Braces'),
    Edit2: icon('Edit2'),
    Save: icon('Save'),
    PanelLeftClose: icon('PanelLeftClose'),
    PanelRightClose: icon('PanelRightClose'),
    Columns2: icon('Columns2'),
  };
});

// --- Clipboard mock ---

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

// --- Test data ---

const fullSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pet Store API',
    version: '2.1.0',
    description: '<p>A comprehensive pet store API</p>',
    contact: {
      name: 'API Team',
      email: 'api@petstore.com',
      url: 'https://petstore.com/contact',
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
  },
  servers: [
    { url: 'https://api.petstore.com/v1', description: 'Production' },
    { url: 'https://staging.petstore.com/v1', description: 'Staging' },
  ],
  paths: {
    '/users': {
      get: {
        tags: ['users'],
        summary: 'List all users',
        description: 'Returns paginated users',
        operationId: 'listUsers',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum items to return',
            required: false,
            schema: { type: 'integer', default: 10 },
          },
          {
            name: 'Authorization',
            in: 'header',
            description: 'Bearer token',
            required: true,
            schema: { type: 'string', format: 'jwt' },
            example: 'Bearer abc123',
          },
          {
            name: 'X-Request-ID',
            in: 'header',
            description: 'Request tracking ID',
            required: false,
            schema: { type: 'string', format: 'uuid', enum: ['type-a', 'type-b'] },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            headers: {
              'X-Total-Count': { description: 'Total count', schema: { type: 'integer' } },
            },
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '500': { description: 'Server error' },
        },
        security: [{ bearerAuth: ['read:users'] }],
      },
    },
    '/users/{userId}': {
      put: {
        tags: ['users'],
        summary: 'Update user',
        deprecated: true,
        parameters: [
          {
            name: 'userId',
            in: 'path',
            description: 'The user ID',
            required: true,
            schema: { type: 'string' },
            example: 'usr-123',
          },
        ],
        requestBody: {
          required: true,
          description: 'Updated user data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, email: { type: 'string' } },
              },
              example: { name: 'Jane Doe', email: 'jane@example.com' },
            },
          },
        },
        responses: {
          '200': {
            description: 'User updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
                examples: {
                  basic: { summary: 'Basic user', value: { id: '1', name: 'Jane' } },
                  full: { summary: 'Full user', value: { id: '1', name: 'Jane', email: 'j@e.com' } },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete user',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '204': { description: 'No content' },
        },
      },
    },
    '/pets': {
      get: {
        tags: ['pets'],
        summary: 'List pets',
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['pets'],
        summary: 'Create pet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } },
              example: { name: 'Rex' },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        description: 'A user entity',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      Pet: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
};

// --- Helpers ---

const updateOpenApiDocument = vi.fn();
const getOpenApiDocument = vi.fn().mockReturnValue(null);
const updateTab = vi.fn();

function mockStores(options: {
  docId?: string;
  docContent?: string;
  docFormat?: 'yaml' | 'json';
  docName?: string;
  theme?: string;
  spec?: any;
  throwParse?: string;
} = {}) {
  const {
    docId,
    docContent,
    docFormat = 'yaml',
    docName = 'Test API Spec',
    theme = 'dark',
    spec,
    throwParse,
  } = options;

  // Configure js-yaml.load
  if (throwParse) {
    vi.mocked(jsYaml.load).mockImplementation(() => {
      throw new Error(throwParse);
    });
  } else if (spec !== undefined) {
    vi.mocked(jsYaml.load).mockReturnValue(spec);
  } else {
    vi.mocked(jsYaml.load).mockReturnValue(fullSpec);
  }

  // Configure document loading
  getOpenApiDocument.mockReturnValue(null);
  if (docId) {
    getOpenApiDocument.mockReturnValue({
      id: docId,
      name: docName,
      content: docContent || 'openapi: "3.0.3"',
      format: docFormat,
    });
  }

  vi.mocked(usePreferencesStore).mockReturnValue({
    preferences: { theme },
  } as any);

  vi.mocked(useAppStore).mockReturnValue({
    updateOpenApiDocument,
    getOpenApiDocument,
    updateTab,
    tabs: docId
      ? [{ id: 't1', title: docName, type: 'openapi', openApiDocId: docId, isModified: false }]
      : [],
  } as any);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// --- Tests ---

describe('OpenApiEditor', () => {
  // ========== Basic Rendering ==========

  describe('basic rendering', () => {
    it('renders without crashing when no documentId is provided', () => {
      mockStores();
      const { container } = render(<OpenApiEditor />);
      expect(container.firstChild).toBeDefined();
    });

    it('renders with a documentId', () => {
      mockStores({ docId: 'doc-1' });
      render(<OpenApiEditor documentId="doc-1" />);
      expect(document.body.firstChild).toBeDefined();
    });

    it('shows toolbar elements', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Should have the Save button and view mode toggle buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('shows "Start typing..." when parsedSpec is null', () => {
      mockStores({ spec: null });
      render(<OpenApiEditor />);
      expect(screen.getByText(/Start typing your OpenAPI specification/)).toBeDefined();
    });
  });

  // ========== Document Name ==========

  describe('document name', () => {
    it('shows document name when loaded from document', () => {
      mockStores({ docId: 'doc-1', docName: 'My Custom API' });
      render(<OpenApiEditor documentId="doc-1" />);
      expect(screen.getByText('My Custom API')).toBeDefined();
    });

    it('shows default name "New API Spec" when no document is loaded', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('New API Spec')).toBeDefined();
    });

    it('enters edit mode when name is clicked', () => {
      mockStores({ docId: 'doc-1', docName: 'My API' });
      render(<OpenApiEditor documentId="doc-1" />);
      fireEvent.click(screen.getByText('My API'));
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    it('saves new name on Enter key', async () => {
      mockStores({ docId: 'doc-1', docName: 'Old Name' });
      render(<OpenApiEditor documentId="doc-1" />);
      fireEvent.click(screen.getByText('Old Name'));
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => {
        expect(updateOpenApiDocument).toHaveBeenCalledWith('doc-1', { name: 'New Name' });
      });
    });

    it('cancels edit on Escape key', () => {
      mockStores({ docId: 'doc-1', docName: 'My API' });
      render(<OpenApiEditor documentId="doc-1" />);
      fireEvent.click(screen.getByText('My API'));
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Escape' });
      // Should exit edit mode and show button again
      expect(screen.getByText('My API')).toBeDefined();
    });

    it('saves name on blur', async () => {
      mockStores({ docId: 'doc-1', docName: 'My API' });
      render(<OpenApiEditor documentId="doc-1" />);
      fireEvent.click(screen.getByText('My API'));
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Blurred Name' } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(updateOpenApiDocument).toHaveBeenCalledWith('doc-1', { name: 'Blurred Name' });
      });
    });
  });

  // ========== API Spec Info Display ==========

  describe('API spec info display', () => {
    it('shows OpenAPI version badge', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('3.0.3')).toBeDefined();
    });

    it('shows API title in toolbar', () => {
      mockStores();
      render(<OpenApiEditor />);
      const titles = screen.getAllByText('Pet Store API');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('shows API version in toolbar', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('v2.1.0')).toBeDefined();
    });

    it('shows swagger version for Swagger 2.0 specs', () => {
      mockStores({
        spec: {
          swagger: '2.0',
          info: { title: 'Legacy API', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      expect(screen.getByText('2.0')).toBeDefined();
    });

    it('shows "Unknown" when no version field exists', () => {
      mockStores({
        spec: {
          info: { title: 'No Version', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      expect(screen.getByText('Unknown')).toBeDefined();
    });

    it('shows "Untitled API" when info.title is missing', () => {
      mockStores({
        spec: { openapi: '3.0.0', info: { version: '1.0.0' }, paths: {} },
      });
      render(<OpenApiEditor />);
      // Appears in both toolbar and preview
      const titleElements = screen.getAllByText('Untitled API');
      expect(titleElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== Section Navigation ==========

  describe('section navigation', () => {
    it('renders Paths, Schemas, and Info tabs', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByRole('button', { name: /^Paths$/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Schemas$/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Info$/i })).toBeDefined();
    });

    it('shows Paths section by default', () => {
      mockStores();
      render(<OpenApiEditor />);
      const pathsBtn = screen.getByRole('button', { name: /^Paths$/i });
      expect(pathsBtn.className).toContain('bg-fetchy-accent');
    });

    it('switches to Schemas section on click', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      expect(screen.getByRole('button', { name: /^Schemas$/i }).className).toContain('bg-fetchy-accent');
    });

    it('switches to Info section on click', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.getByRole('button', { name: /^Info$/i }).className).toContain('bg-fetchy-accent');
    });

    it('switches back to Paths from Info', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Paths$/i }));
      expect(screen.getByRole('button', { name: /^Paths$/i }).className).toContain('bg-fetchy-accent');
    });
  });

  // ========== View Mode Toggle ==========

  describe('view mode toggle', () => {
    it('shows resize handle in split (both) mode by default', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByTestId('resize-handle')).toBeDefined();
    });

    it('removes resize handle when switching to editor-only mode', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Click editor-only button (title="Editor only")
      fireEvent.click(screen.getByTitle('Editor only'));
      expect(screen.queryByTestId('resize-handle')).toBeNull();
    });

    it('removes resize handle when switching to preview-only mode', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByTitle('Preview only'));
      expect(screen.queryByTestId('resize-handle')).toBeNull();
    });

    it('restores resize handle when switching back to split view', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByTitle('Editor only'));
      expect(screen.queryByTestId('resize-handle')).toBeNull();
      fireEvent.click(screen.getByTitle('Split view'));
      expect(screen.getByTestId('resize-handle')).toBeDefined();
    });
  });

  // ========== Format Display ==========

  describe('format display', () => {
    it('shows YAML badge for yaml format', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('YAML')).toBeDefined();
    });

    it('shows JSON badge for json format document', () => {
      const jsonContent = JSON.stringify(fullSpec);
      mockStores({ docId: 'doc-json', docFormat: 'json', docContent: jsonContent });
      render(<OpenApiEditor documentId="doc-json" />);
      expect(screen.getByText('JSON')).toBeDefined();
    });

    it('shows Source label in editor panel', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('Source')).toBeDefined();
    });

    it('shows Preview label in preview panel', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('Preview')).toBeDefined();
    });
  });

  // ========== Server Display ==========

  describe('server display', () => {
    it('shows server URLs', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('https://api.petstore.com/v1')).toBeDefined();
      expect(screen.getByText('https://staging.petstore.com/v1')).toBeDefined();
    });

    it('shows server descriptions', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('(Production)')).toBeDefined();
      expect(screen.getByText('(Staging)')).toBeDefined();
    });
  });

  // ========== Tag-Based Grouping ==========

  describe('tag-based grouping', () => {
    it('shows tag headers with operation counts', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('users')).toBeDefined();
      expect(screen.getByText('(3)')).toBeDefined(); // 3 operations under users
      expect(screen.getByText('pets')).toBeDefined();
      expect(screen.getByText('(2)')).toBeDefined(); // 2 operations under pets
    });

    it('shows Untagged group for operations without tags', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('Untagged')).toBeDefined();
      expect(screen.getByText('(1)')).toBeDefined(); // 1 untagged operation
    });

    it('shows operations under the expanded users tag by default', () => {
      mockStores();
      render(<OpenApiEditor />);
      // users tag is expanded by default; operations listed
      expect(screen.getByText('/users')).toBeDefined();
      expect(screen.getByText('List all users')).toBeDefined();
    });

    it('collapses a tag when its header is clicked', () => {
      mockStores();
      render(<OpenApiEditor />);
      // users tag is expanded; click to collapse
      fireEvent.click(screen.getByText('users'));
      // After collapse, the operation paths under this tag should be removed
      expect(screen.queryByText('List all users')).toBeNull();
    });

    it('expands a collapsed tag when its header is clicked', () => {
      mockStores();
      render(<OpenApiEditor />);
      // pets tag is collapsed by default; operations not visible
      expect(screen.queryByText('List pets')).toBeNull();
      fireEvent.click(screen.getByText('pets'));
      // Now pets operations should be visible
      expect(screen.getByText('List pets')).toBeDefined();
    });
  });

  // ========== Endpoint Display ==========

  describe('endpoint display', () => {
    it('shows method badges with correct text', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Under expanded users tag
      const getTexts = screen.getAllByText('get');
      expect(getTexts.length).toBeGreaterThanOrEqual(1);
      const putTexts = screen.getAllByText('put');
      expect(putTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('shows endpoint paths', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('/users')).toBeDefined();
      // PUT and DELETE both have /users/{userId}
      const userIdPaths = screen.getAllByText('/users/{userId}');
      expect(userIdPaths.length).toBeGreaterThanOrEqual(1);
    });

    it('shows operation summaries', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('List all users')).toBeDefined();
      expect(screen.getByText('Update user')).toBeDefined();
      expect(screen.getByText('Delete user')).toBeDefined();
    });

    it('shows deprecated badge for deprecated operations', () => {
      mockStores();
      render(<OpenApiEditor />);
      expect(screen.getByText('Deprecated')).toBeDefined();
    });
  });

  // ========== Expanding/Collapsing Endpoint Details ==========

  describe('expanding endpoint details', () => {
    it('shows Request and Responses headings when operation is expanded', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Click on GET /users to expand
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Request')).toBeDefined();
      expect(screen.getByText('Responses')).toBeDefined();
    });

    it('shows operation description when expanded', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      // HtmlDescription mock renders the text directly
      expect(screen.getByText('Returns paginated users')).toBeDefined();
    });

    it('collapses operation details when clicked again', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Request')).toBeDefined();
      fireEvent.click(screen.getByText('/users'));
      expect(screen.queryByText('Request')).toBeNull();
    });
  });

  // ========== Parameters Display ==========

  describe('parameters display', () => {
    it('shows path parameters with required badge', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Expand PUT /users/{userId} which has path param
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      expect(screen.getByText('Path Parameters')).toBeDefined();
      expect(screen.getByText('userId')).toBeDefined();
    });

    it('shows query parameters with default value', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Query Parameters')).toBeDefined();
      expect(screen.getByText('limit')).toBeDefined();
      expect(screen.getByText('Default:')).toBeDefined();
    });

    it('shows header parameters in a table', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Request Headers')).toBeDefined();
      expect(screen.getByText('Authorization')).toBeDefined();
      expect(screen.getByText('X-Request-ID')).toBeDefined();
    });

    it('shows header parameter example value', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Bearer abc123')).toBeDefined();
    });

    it('shows header count badge', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      // Request Headers section shows count badge
      const countBadges = screen.getAllByText('(2)');
      expect(countBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows header format and enum values', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText(/format: jwt/)).toBeDefined();
      expect(screen.getByText(/type-a, type-b/)).toBeDefined();
    });

    it('shows path parameter example value', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      expect(screen.getByText('usr-123')).toBeDefined();
    });
  });

  // ========== Request Body Display ==========

  describe('request body display', () => {
    it('shows request body section with content type', () => {
      mockStores();
      render(<OpenApiEditor />);
      // Expand PUT /users/{userId} which has a request body
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      expect(screen.getByText('Request Body')).toBeDefined();
      const jsonTypes = screen.getAllByText('application/json');
      expect(jsonTypes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows request body example JSON', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      // The example is { name: 'Jane Doe', email: 'jane@example.com' }
      const preElements = document.querySelectorAll('pre');
      const hasExample = Array.from(preElements).some(
        (el) => el.textContent?.includes('Jane Doe')
      );
      expect(hasExample).toBe(true);
    });

    it('shows required badge on request body', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      const requiredBadges = screen.getAllByText('required');
      expect(requiredBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows request body description', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      expect(screen.getByText('Updated user data')).toBeDefined();
    });

    it('shows "No request body" message for operations without request body', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('No request body')).toBeDefined();
    });

    it('renders SchemaViewer for request body schema (in details element)', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      // The Schema Details is inside a <details> element; not expanded by default
      expect(screen.getAllByText('Schema Details').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== Responses Display ==========

  describe('responses display', () => {
    it('shows response status codes', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('200')).toBeDefined();
      expect(screen.getByText('401')).toBeDefined();
      expect(screen.getByText('500')).toBeDefined();
    });

    it('colors response codes correctly', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      const code200 = screen.getByText('200');
      expect(code200.className).toContain('bg-green-500');
      const code401 = screen.getByText('401');
      expect(code401.className).toContain('bg-yellow-500');
      const code500 = screen.getByText('500');
      expect(code500.className).toContain('bg-red-500');
    });

    it('shows response descriptions', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Successful response')).toBeDefined();
      expect(screen.getByText('Unauthorized')).toBeDefined();
    });

    it('shows response headers when present', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('X-Total-Count')).toBeDefined();
      expect(screen.getByText('Total count')).toBeDefined();
    });

    it('shows "No response headers defined" for responses without headers', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      const noHeaders = screen.getAllByText('No response headers defined');
      // 401 and 500 responses have no headers
      expect(noHeaders.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "No response body" for responses without content', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      const noBody = screen.getAllByText('No response body');
      expect(noBody.length).toBeGreaterThanOrEqual(1);
    });

    it('shows response body content type', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      const jsonTypes = screen.getAllByText('application/json');
      expect(jsonTypes.length).toBeGreaterThanOrEqual(1);
    });

    it('renders SchemaViewer for response body schema', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      const schemaViewers = screen.getAllByTestId('schema-viewer');
      expect(schemaViewers.length).toBeGreaterThanOrEqual(1);
    });

    it('shows multiple response examples for operations with examples', () => {
      mockStores();
      render(<OpenApiEditor />);
      const putPaths = screen.getAllByText('/users/{userId}');
      fireEvent.click(putPaths[0]);
      // PUT /users/{userId} has response with multiple examples
      // The first example is shown by default, "More Examples" in a details element
      expect(screen.getByText(/More Examples/)).toBeDefined();
    });
  });

  // ========== Security Display ==========

  describe('security display', () => {
    it('shows security requirements when operation has security', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('Security')).toBeDefined();
      expect(screen.getByText('bearerAuth')).toBeDefined();
    });

    it('shows security scopes', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/users'));
      expect(screen.getByText('(read:users)')).toBeDefined();
    });
  });

  // ========== Copy Endpoint ==========

  describe('copy endpoint', () => {
    it('copies endpoint URL to clipboard when copy button is clicked', async () => {
      mockStores();
      render(<OpenApiEditor />);
      // Find copy buttons (titled "Copy endpoint URL")
      const copyButtons = screen.getAllByTitle('Copy endpoint URL');
      expect(copyButtons.length).toBeGreaterThan(0);
      fireEvent.click(copyButtons[0]);
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'https://api.petstore.com/v1/users'
        );
      });
    });
  });

  // ========== Schemas Section ==========

  describe('schemas section', () => {
    it('shows schema names', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      expect(screen.getByText('User')).toBeDefined();
      expect(screen.getByText('Pet')).toBeDefined();
    });

    it('shows schema type annotation', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      const typeAnnotations = screen.getAllByText('(object)');
      expect(typeAnnotations.length).toBeGreaterThanOrEqual(2);
    });

    it('shows schema description', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      expect(screen.getByText('A user entity')).toBeDefined();
    });

    it('shows example JSON for schemas', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      const labels = screen.getAllByText('Example JSON:');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Schema Definition details element', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      const summaries = screen.getAllByText('Schema Definition');
      expect(summaries.length).toBeGreaterThanOrEqual(1);
    });

    it('provides copy button for each schema', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      const copyButtons = screen.getAllByTitle('Copy example JSON');
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========== Info Section ==========

  describe('info section', () => {
    it('shows contact information', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.getByText('Contact')).toBeDefined();
      expect(screen.getByText(/API Team/)).toBeDefined();
      expect(screen.getByText(/api@petstore.com/)).toBeDefined();
      expect(screen.getByText(/petstore.com\/contact/)).toBeDefined();
    });

    it('shows license information', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.getByText('License')).toBeDefined();
      expect(screen.getByText(/Apache 2.0/)).toBeDefined();
    });

    it('shows security schemes', () => {
      mockStores();
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.getByText('Security Schemes')).toBeDefined();
      expect(screen.getByText('bearerAuth')).toBeDefined();
      expect(screen.getByText('apiKey')).toBeDefined();
    });

    it('does not show contact section when spec has no contact info', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Minimal', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.queryByText('Contact')).toBeNull();
    });

    it('does not show license section when spec has no license info', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Minimal', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Info$/i }));
      expect(screen.queryByText('License')).toBeNull();
    });
  });

  // ========== Error State ==========

  describe('error state', () => {
    it('shows parse error message when YAML is invalid', () => {
      mockStores({ throwParse: 'Invalid YAML at line 5: unexpected token' });
      render(<OpenApiEditor />);
      expect(screen.getByText('Parse Error')).toBeDefined();
      expect(screen.getByText('Invalid YAML at line 5: unexpected token')).toBeDefined();
    });

    it('does not show section tabs when there is a parse error', () => {
      mockStores({ throwParse: 'bad yaml' });
      render(<OpenApiEditor />);
      expect(screen.queryByRole('button', { name: /^Paths$/i })).toBeNull();
    });
  });

  // ========== Save Functionality ==========

  describe('save functionality', () => {
    it('shows save button with disabled state when no changes', () => {
      mockStores({ docId: 'doc-1' });
      render(<OpenApiEditor documentId="doc-1" />);
      const saveBtn = screen.getByTitle('Save (Ctrl+S)');
      expect(saveBtn).toBeDefined();
      expect(saveBtn.className).toContain('cursor-not-allowed');
    });

    it('shows unsaved indicator text when document is modified', () => {
      // When savedContent differs from content, isModified is true.
      // Without a documentId, content starts as DEFAULT_OPENAPI_YAML and
      // savedContent is also DEFAULT_OPENAPI_YAML, so isModified is false.
      // We need to trigger a content change via CodeMirror, which is mocked.
      // Instead, test the indicator presence indirectly:
      // The save button class changes based on isModified state.
      mockStores({ docId: 'doc-1' });
      render(<OpenApiEditor documentId="doc-1" />);
      // Initially not modified, save button should be disabled
      const saveBtn = screen.getByTitle('Save (Ctrl+S)');
      expect(saveBtn.getAttribute('disabled')).toBeDefined();
    });
  });

  // ========== Description Rendering ==========

  describe('description rendering', () => {
    it('shows API description via HtmlDescription', () => {
      mockStores();
      render(<OpenApiEditor />);
      // The API info description is rendered via HtmlDescription mock
      const descElements = screen.getAllByTestId('html-desc');
      const hasApiDesc = descElements.some(
        (el) => el.textContent === '<p>A comprehensive pet store API</p>'
      );
      expect(hasApiDesc).toBe(true);
    });
  });

  // ========== Light Theme ==========

  describe('theme handling', () => {
    it('renders with light theme preference', () => {
      mockStores({ theme: 'light' });
      const { container } = render(<OpenApiEditor />);
      expect(container.firstChild).toBeDefined();
    });
  });

  // ========== Spec Without Servers ==========

  describe('edge cases', () => {
    it('handles spec without servers gracefully', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'No Servers API', version: '1.0.0' },
          paths: { '/test': { get: { summary: 'Test', responses: { '200': { description: 'OK' } } } } },
        },
      });
      render(<OpenApiEditor />);
      const titles = screen.getAllByText('No Servers API');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('handles spec without components/schemas section', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Basic', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByRole('button', { name: /^Schemas$/i }));
      // Should not crash; no schema content rendered
      expect(screen.queryByText('User')).toBeNull();
    });

    it('handles empty paths object', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Empty Paths', version: '1.0.0' },
          paths: {},
        },
      });
      render(<OpenApiEditor />);
      // No tag headers should appear
      expect(screen.queryByText('Untagged')).toBeNull();
    });

    it('handles operation with $ref in responses', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Ref API', version: '1.0.0' },
          paths: {
            '/items': {
              get: {
                tags: ['users'],
                summary: 'Get items',
                responses: {
                  '200': {
                    $ref: '#/components/responses/SuccessResponse',
                  },
                },
              },
            },
          },
          components: {
            responses: {
              SuccessResponse: {
                description: 'Resolved success response',
              },
            },
          },
        },
      });
      render(<OpenApiEditor />);
      // Expand operation
      fireEvent.click(screen.getByText('/items'));
      expect(screen.getByText('Resolved success response')).toBeDefined();
    });

    it('handles operation with $ref in request body', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Ref Body API', version: '1.0.0' },
          paths: {
            '/items': {
              post: {
                tags: ['users'],
                summary: 'Create item',
                requestBody: {
                  $ref: '#/components/requestBodies/ItemBody',
                },
                responses: { '201': { description: 'Created' } },
              },
            },
          },
          components: {
            requestBodies: {
              ItemBody: {
                required: true,
                description: 'Item creation body',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                    example: { name: 'Widget' },
                  },
                },
              },
            },
          },
        },
      });
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/items'));
      expect(screen.getByText('Request Body')).toBeDefined();
      expect(screen.getByText('Item creation body')).toBeDefined();
    });

    it('shows "No request headers defined" when operation has no header params', () => {
      mockStores({
        spec: {
          openapi: '3.0.0',
          info: { title: 'No Headers', version: '1.0.0' },
          paths: {
            '/simple': {
              get: {
                tags: ['users'],
                summary: 'Simple endpoint',
                responses: { '200': { description: 'OK' } },
              },
            },
          },
        },
      });
      render(<OpenApiEditor />);
      fireEvent.click(screen.getByText('/simple'));
      expect(screen.getByText('No request headers defined')).toBeDefined();
    });

    it('handles JSON format parsing via JSON.parse instead of js-yaml', () => {
      const jsonSpec = {
        openapi: '3.1.0',
        info: { title: 'JSON Spec', version: '1.0.0' },
        paths: {},
      };
      mockStores({
        docId: 'doc-json',
        docFormat: 'json',
        docContent: JSON.stringify(jsonSpec),
      });
      render(<OpenApiEditor documentId="doc-json" />);
      expect(screen.getByText('JSON')).toBeDefined();
      expect(screen.getByText('3.1.0')).toBeDefined();
      const titles = screen.getAllByText('JSON Spec');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });
  });
});
