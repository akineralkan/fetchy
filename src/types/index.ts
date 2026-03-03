// Type definitions for the REST Client Application

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValue {
  id: string;
  key: string;
  value: string; // For backward compatibility, maps to currentValue
  initialValue?: string; // Preset/shared value (can be exported)
  currentValue?: string; // Local/runtime value (overrides initialValue)
  enabled: boolean;
  description?: string;
  isSecret?: boolean;
}

export interface RequestAuth {
  type: 'none' | 'inherit' | 'basic' | 'bearer' | 'api-key';
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
  };
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
}

export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';
  raw?: string;
  formData?: KeyValue[];
  urlencoded?: KeyValue[];
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: RequestAuth;
  preScript?: string;
  script?: string;
  /** When false, TLS certificate verification is skipped for this request. Default: true */
  sslVerification?: boolean;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
  preScriptError?: string;
  preScriptOutput?: string;
  scriptError?: string;
  scriptOutput?: string;
}

export interface RequestFolder {
  id: string;
  name: string;
  description?: string;
  requests: ApiRequest[];
  folders: RequestFolder[];
  expanded?: boolean;
  auth?: RequestAuth;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  folders: RequestFolder[];
  requests: ApiRequest[];
  variables?: KeyValue[];
  expanded?: boolean;
  auth?: RequestAuth;
  preScript?: string;
  script?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValue[];
  isActive?: boolean;
}

export interface RequestHistoryItem {
  id: string;
  request: ApiRequest;
  response?: ApiResponse;
  timestamp: number;
}

export type BuiltinTheme = 'indigo' | 'light' | 'ocean' | 'forest' | 'earth' | 'aurora' | 'sunset' | 'candy' | 'dark';

export interface CustomThemeColors {
  bgColor: string;
  sidebarColor: string;
  cardColor: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
  hoverBg: string;
  inputBg: string;
  accent: string;
  accentHover: string;
  tabBarBg: string;
  tabActiveBg: string;
  dropdownBg: string;
  modalBg: string;
  tooltipBg: string;
  separatorColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  aiColor: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: CustomThemeColors;
}

export interface Workspace {
  id: string;
  name: string;
  homeDirectory: string;
  secretsDirectory: string;
  createdAt: number;
  gitAutoSync?: boolean;
}

export interface WorkspacesConfig {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

// AI Provider types
export type AIProvider = 'openai' | 'gemini' | 'claude' | 'ollama' | 'custom';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string; // Custom endpoint URL (used for custom/ollama providers)
  temperature: number;
  maxTokens: number;
  persistToFile?: boolean; // Whether to persist AI secrets to the secrets file
}

export interface AISecretsStorage {
  version: string;
  aiSettings: Omit<AISettings, 'persistToFile'> & { persistToFile: true };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestPayload {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponseResult {
  success: boolean;
  content: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIFeatureType =
  | 'generate-request'
  | 'generate-script'
  | 'explain-response'
  | 'generate-docs'
  | 'suggest-name';

export interface AppPreferences {
  homeDirectory: string | null; // Legacy – kept for backward compat
  theme: BuiltinTheme | string; // string for custom theme IDs
  autoSave: boolean;
  maxHistoryItems: number;
  customThemes: CustomTheme[];
  aiSettings: AISettings;
}

// OpenAPI types
export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, { description?: string }>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
}

// Postman types for import
export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanEvent {
  listen: string;
  script?: {
    type?: string;
    exec?: string[] | string;
  };
}

export interface PostmanItem {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  description?: string;
  event?: PostmanEvent[];
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl | string;
  auth?: PostmanAuth;
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanBody {
  mode: string;
  raw?: string;
  urlencoded?: PostmanHeader[];
  formdata?: PostmanHeader[];
  options?: {
    raw?: {
      language?: string;
    };
  };
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanHeader[];
}

export interface PostmanVariable {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanAuth {
  type: string;
  basic?: Array<{ key: string; value: string }> | Record<string, string>;
  bearer?: Array<{ key: string; value: string }> | Record<string, string>;
  apikey?: Array<{ key: string; value: string }> | Record<string, string>;
}

// OpenAPI Document for storage
export interface OpenAPIDocument {
  id: string;
  name: string;
  content: string;
  format: 'yaml' | 'json';
  createdAt: number;
  updatedAt: number;
}

// App state types
export interface TabState {
  id: string;
  type: 'request' | 'collection' | 'environment' | 'openapi';
  title: string;
  requestId?: string;
  collectionId?: string;
  folderId?: string | null;
  environmentId?: string;
  openApiDocId?: string; // For OpenAPI editor tabs
  isModified?: boolean;
  isHistoryItem?: boolean; // Flag to indicate this tab is loaded from history
  historyRequest?: ApiRequest; // Store the original history request data
  historyResponse?: ApiResponse; // Store the original history response data
  scriptExecutionStatus?: 'success' | 'error' | 'none'; // Flag to indicate the result of the post-request script execution
}

export interface AppState {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  activeRequestId: string | null;
  tabs: TabState[];
  activeTabId: string | null;
  history: RequestHistoryItem[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

// Workspace export format
export interface WorkspaceExport {
  fetchyWorkspaceExport: true;
  version: '2.0';
  exportedAt: string;
  workspaceName: string;
  publicData: Record<string, unknown> | null;
  secretsData: SecretsStorage | null;
}

export interface SecretsStorage {
  version: string;
  /** key: "env:{envId}:{varId}" or "col:{colId}:{varId}" → secret value */
  secrets: Record<string, string>;
}

// Git types
export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatusResult {
  success: boolean;
  isRepo?: boolean;
  branch?: string;
  changes?: string[];
  remoteUrl?: string;
  lastCommit?: GitCommitInfo | null;
  ahead?: number;
  behind?: number;
  hasChanges?: boolean;
  error?: string;
}

export interface GitCheckResult {
  available: boolean;
  version: string;
}

export interface GitOperationResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface GitLogResult {
  success: boolean;
  commits?: GitCommitInfo[];
  error?: string;
}

export interface GitRemoteResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Electron API type definition
export interface ElectronAPI {
  httpRequest: (data: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    sslVerification?: boolean;
  }) => Promise<ApiResponse>;
  aiRequest: (data: {
    provider: AIProvider;
    apiKey: string;
    model: string;
    baseUrl: string;
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
  }) => Promise<AIResponseResult>;
  openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ filePath: string; content: string } | null>;
  saveFile: (data: { content: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  getDataPath: () => Promise<string>;
  readData: (filename: string) => Promise<string | null>;
  writeData: (data: { filename: string; content: string }) => Promise<boolean>;
  // Secrets
  readSecrets: () => Promise<string | null>;
  writeSecrets: (data: { content: string }) => Promise<boolean>;
  // AI Secrets (separate from variable secrets)
  readAISecrets: () => Promise<string | null>;
  writeAISecrets: (data: { content: string }) => Promise<boolean>;
  deleteAISecrets: () => Promise<boolean>;
  // Preferences
  getPreferences: () => Promise<AppPreferences | null>;
  savePreferences: (preferences: AppPreferences) => Promise<boolean>;
  // Legacy home directory
  selectHomeDirectory: () => Promise<string | null>;
  getHomeDirectory: () => Promise<string>;
  migrateData: (data: { oldPath: string; newPath: string }) => Promise<boolean>;
  // Workspace management
  getWorkspaces: () => Promise<WorkspacesConfig>;
  saveWorkspaces: (config: WorkspacesConfig) => Promise<boolean>;
  selectDirectory: (opts?: { title?: string }) => Promise<string | null>;
  exportWorkspaceToJson: (data: { workspaceId: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  importWorkspaceFromJson: (data: {
    name: string;
    homeDirectory: string;
    secretsDirectory: string;
    exportData: WorkspaceExport;
  }) => Promise<{ success: boolean; workspace?: Workspace; error?: string }>;
  // Git operations
  gitCheck: () => Promise<GitCheckResult>;
  gitStatus: (data: { directory: string }) => Promise<GitStatusResult>;
  gitInit: (data: { directory: string }) => Promise<GitOperationResult>;
  gitClone: (data: { url: string; directory: string }) => Promise<GitOperationResult>;
  gitPull: (data: { directory: string }) => Promise<GitOperationResult>;
  gitPush: (data: { directory: string }) => Promise<GitOperationResult>;
  gitAddCommit: (data: { directory: string; message?: string }) => Promise<GitOperationResult>;
  gitAddCommitPush: (data: { directory: string; message?: string }) => Promise<GitOperationResult>;
  gitLog: (data: { directory: string; count?: number }) => Promise<GitLogResult>;
  gitRemoteGet: (data: { directory: string }) => Promise<GitRemoteResult>;
  gitRemoteSet: (data: { directory: string; url: string }) => Promise<GitOperationResult>;
  gitFetch: (data: { directory: string }) => Promise<GitOperationResult>;
}

// Extend Window interface globally
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

