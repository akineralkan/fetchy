/**
 * Tests for GH-49: gRPC request type support.
 *
 * Covers:
 * - gRPC TypeScript type definitions (GrpcMetadataEntry, GrpcMethodInfo,
 *   GrpcServiceInfo, GrpcRequestData) — shape and compatibility with ApiRequest
 * - grpcHandler.js IPC handlers (grpc:load-proto, grpc:invoke) — input validation
 * - extractServices helper logic via mocked proto-loader
 * - requireServerAddress validation (all rejection patterns)
 * - requireAbsoluteProtoPath validation (extension, null bytes, existence)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  GrpcMetadataEntry,
  GrpcMethodInfo,
  GrpcServiceInfo,
  GrpcRequestData,
  ApiRequest,
  AppMode,
} from '../src/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Get the CJS module objects — these are the SAME cached objects used by grpcHandler.js.
// Direct property assignment on these objects reliably affects grpcHandler.js calls
// across the ESM/CJS boundary.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeFs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeProtoLoader = require('@grpc/proto-loader') as { load: (...args: unknown[]) => Promise<unknown> };

const _origExistsSync = nodeFs.existsSync;
const _origProtoLoad = nodeProtoLoader.load;

// ─── IPC mock helper ──────────────────────────────────────────────────────────

type HandlerFn = (event: null, ...args: unknown[]) => Promise<unknown>;

function createMockIpcMain() {
  const handlers: Record<string, HandlerFn> = {};
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle: (channel: string, handler: any) => { handlers[channel] = handler; },
    getHandler: (channel: string): HandlerFn => handlers[channel],
  };
}

// Register grpcHandler once for the whole file.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { register } = require('../electron/ipc/grpcHandler');
const _ipcMain = createMockIpcMain();
register(_ipcMain);
const loadProtoHandler = _ipcMain.getHandler('grpc:load-proto');
const invokeHandler = _ipcMain.getHandler('grpc:invoke');

// Mock stubs replaced before each test; originals restored after.
let existsSyncMock: ReturnType<typeof vi.fn>;
let protoLoadMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  existsSyncMock = vi.fn().mockReturnValue(false);
  protoLoadMock = vi.fn();
  (nodeFs as any).existsSync = existsSyncMock;
  (nodeProtoLoader as any).load = protoLoadMock;
});

afterEach(() => {
  (nodeFs as any).existsSync = _origExistsSync;
  (nodeProtoLoader as any).load = _origProtoLoad;
});

// ─── gRPC Type Definitions ────────────────────────────────────────────────────

describe('GrpcMetadataEntry', () => {
  it('has required id, key, value, enabled fields', () => {
    const entry: GrpcMetadataEntry = {
      id: 'entry-1',
      key: 'authorization',
      value: 'Bearer my-token',
      enabled: true,
    };
    expect(entry.id).toBe('entry-1');
    expect(entry.key).toBe('authorization');
    expect(entry.value).toBe('Bearer my-token');
    expect(entry.enabled).toBe(true);
  });

  it('supports disabled entries', () => {
    const entry: GrpcMetadataEntry = {
      id: 'entry-2',
      key: 'x-trace-id',
      value: 'trace-abc',
      enabled: false,
    };
    expect(entry.enabled).toBe(false);
  });

  it('supports empty key and value', () => {
    const entry: GrpcMetadataEntry = { id: 'e3', key: '', value: '', enabled: true };
    expect(entry.key).toBe('');
    expect(entry.value).toBe('');
  });
});

describe('GrpcMethodInfo', () => {
  it('represents a unary method (no streaming)', () => {
    const method: GrpcMethodInfo = {
      name: 'GetUser',
      path: '/mypackage.UserService/GetUser',
      requestStream: false,
      responseStream: false,
    };
    expect(method.name).toBe('GetUser');
    expect(method.path).toBe('/mypackage.UserService/GetUser');
    expect(method.requestStream).toBe(false);
    expect(method.responseStream).toBe(false);
  });

  it('represents a server-streaming method', () => {
    const method: GrpcMethodInfo = {
      name: 'ListUsers',
      path: '/mypackage.UserService/ListUsers',
      requestStream: false,
      responseStream: true,
    };
    expect(method.responseStream).toBe(true);
    expect(method.requestStream).toBe(false);
  });

  it('represents a client-streaming method', () => {
    const method: GrpcMethodInfo = {
      name: 'UploadData',
      path: '/pkg.DataService/UploadData',
      requestStream: true,
      responseStream: false,
    };
    expect(method.requestStream).toBe(true);
    expect(method.responseStream).toBe(false);
  });

  it('represents a bidirectional streaming method', () => {
    const method: GrpcMethodInfo = {
      name: 'Chat',
      path: '/pkg.ChatService/Chat',
      requestStream: true,
      responseStream: true,
    };
    expect(method.requestStream).toBe(true);
    expect(method.responseStream).toBe(true);
  });
});

describe('GrpcServiceInfo', () => {
  it('has name and an array of methods', () => {
    const svc: GrpcServiceInfo = {
      name: 'mypackage.UserService',
      methods: [
        { name: 'GetUser', path: '/mypackage.UserService/GetUser', requestStream: false, responseStream: false },
        { name: 'CreateUser', path: '/mypackage.UserService/CreateUser', requestStream: false, responseStream: false },
      ],
    };
    expect(svc.name).toBe('mypackage.UserService');
    expect(svc.methods).toHaveLength(2);
    expect(svc.methods[0].name).toBe('GetUser');
    expect(svc.methods[1].name).toBe('CreateUser');
  });

  it('accepts a service with no methods', () => {
    const svc: GrpcServiceInfo = { name: 'pkg.EmptyService', methods: [] };
    expect(svc.methods).toHaveLength(0);
  });

  it('accepts deeply-namespaced service name', () => {
    const svc: GrpcServiceInfo = {
      name: 'com.example.v1.OrderService',
      methods: [
        { name: 'GetOrder', path: '/com.example.v1.OrderService/GetOrder', requestStream: false, responseStream: false },
      ],
    };
    expect(svc.name).toBe('com.example.v1.OrderService');
  });
});

describe('GrpcRequestData', () => {
  it('has all required fields with correct types', () => {
    const data: GrpcRequestData = {
      serverAddress: 'localhost:50051',
      protoFilePath: '/path/to/service.proto',
      serviceName: 'mypackage.UserService',
      methodName: 'GetUser',
      payload: '{"id": 42}',
      metadata: [],
      useTls: false,
    };
    expect(data.serverAddress).toBe('localhost:50051');
    expect(data.protoFilePath).toBe('/path/to/service.proto');
    expect(data.serviceName).toBe('mypackage.UserService');
    expect(data.methodName).toBe('GetUser');
    expect(data.payload).toBe('{"id": 42}');
    expect(data.metadata).toEqual([]);
    expect(data.useTls).toBe(false);
  });

  it('supports TLS enabled', () => {
    const data: GrpcRequestData = {
      serverAddress: 'grpc.example.com:443',
      protoFilePath: '/protos/service.proto',
      serviceName: 'pkg.Service',
      methodName: 'Call',
      payload: '{}',
      metadata: [],
      useTls: true,
    };
    expect(data.useTls).toBe(true);
  });

  it('supports metadata entries', () => {
    const data: GrpcRequestData = {
      serverAddress: 'localhost:50051',
      protoFilePath: '/protos/service.proto',
      serviceName: 'pkg.Service',
      methodName: 'Call',
      payload: '',
      metadata: [
        { id: 'm1', key: 'x-api-key', value: 'key-value', enabled: true },
        { id: 'm2', key: 'x-request-id', value: 'req-123', enabled: false },
      ],
      useTls: false,
    };
    expect(data.metadata).toHaveLength(2);
    expect(data.metadata[0].key).toBe('x-api-key');
    expect(data.metadata[1].enabled).toBe(false);
  });

  it('accepts an empty payload string', () => {
    const data: GrpcRequestData = {
      serverAddress: 'localhost:50051',
      protoFilePath: '/path/to/service.proto',
      serviceName: 'pkg.Service',
      methodName: 'Ping',
      payload: '',
      metadata: [],
      useTls: false,
    };
    expect(data.payload).toBe('');
  });
});

describe('ApiRequest grpc integration', () => {
  it('accepts appMode of grpc with a grpc sub-object', () => {
    const req: Partial<ApiRequest> = {
      appMode: 'grpc',
      grpc: {
        serverAddress: 'localhost:50051',
        protoFilePath: '/protos/service.proto',
        serviceName: 'pkg.Service',
        methodName: 'Hello',
        payload: '',
        metadata: [],
        useTls: false,
      },
    };
    expect(req.appMode).toBe('grpc');
    expect(req.grpc?.serverAddress).toBe('localhost:50051');
    expect(req.grpc?.useTls).toBe(false);
  });

  it('allows appMode rest without a grpc field (backward compatible)', () => {
    const req: Partial<ApiRequest> = { appMode: 'rest' };
    expect(req.grpc).toBeUndefined();
  });

  it('allows absent appMode (undefined means rest for backward compat)', () => {
    const req: Partial<ApiRequest> = {};
    expect(req.appMode).toBeUndefined();
    expect(req.grpc).toBeUndefined();
  });
});

describe('AppMode type includes grpc', () => {
  const ALL_MODES: AppMode[] = ['rest', 'graphql', 'grpc', 'websocket', 'mqtt', 'socketio', 'sse'];

  it('grpc is a valid AppMode', () => {
    const mode: AppMode = 'grpc';
    expect(mode).toBe('grpc');
  });

  it('AppMode list contains grpc', () => {
    expect(ALL_MODES).toContain('grpc');
  });

  it('AppMode has 7 values', () => {
    expect(ALL_MODES).toHaveLength(7);
  });
});

// ─── grpc:load-proto handler — input validation ────────────────────────────────

describe('grpc:load-proto — input validation', () => {
  it('returns error when filePath is not a string (number)', async () => {
    const result = await loadProtoHandler(null, 123) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/filePath must be a non-empty string/i);
  });

  it('returns error when filePath is undefined', async () => {
    const result = await loadProtoHandler(null, undefined) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/filePath must be a non-empty string/i);
  });

  it('returns error when filePath is an empty string', async () => {
    const result = await loadProtoHandler(null, '') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/filePath must be a non-empty string/i);
  });

  it('returns error when filePath contains null bytes', async () => {
    const result = await loadProtoHandler(null, '/path/to/bad\0.proto') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/null bytes/i);
  });

  it('returns error when filePath does not end with .proto', async () => {
    const result = await loadProtoHandler(null, '/path/to/service.txt') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('returns error when filePath has a .json extension', async () => {
    const result = await loadProtoHandler(null, '/path/to/schema.json') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('returns error when filePath is only the .proto extension', async () => {
    const result = await loadProtoHandler(null, '.proto') as { success: boolean; error?: string };
    // ".proto" is technically a valid extension — but file won't exist
    expect(result.success).toBe(false);
  });

  it('accepts .PROTO uppercase extension (case-insensitive) and reports file-not-found', async () => {
    existsSyncMock.mockReturnValue(false);
    const result = await loadProtoHandler(null, '/path/to/SERVICE.PROTO') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Extension check passes (.proto lowercase match), so error is file-not-found
    expect(result.error).toMatch(/Proto file not found/i);
  });

  it('returns error when proto file does not exist on disk', async () => {
    existsSyncMock.mockReturnValue(false);
    const result = await loadProtoHandler(null, '/nonexistent/path/test.proto') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Proto file not found/i);
  });

  it('returns error when filePath exceeds 4096 character limit', async () => {
    const longPath = '/path/' + 'a'.repeat(4100) + '.proto';
    const result = await loadProtoHandler(null, longPath) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds maximum length/i);
  });
});

// ─── grpc:load-proto handler — successful proto parsing ───────────────────────

describe('grpc:load-proto — extractServices via mocked proto-loader', () => {
  it('returns services when proto-loader returns a valid PackageDefinition', async () => {
    existsSyncMock.mockReturnValue(true);
    protoLoadMock.mockResolvedValue({
      'mypackage.UserService': {
        GetUser: { path: '/mypackage.UserService/GetUser', requestStream: false, responseStream: false },
        CreateUser: { path: '/mypackage.UserService/CreateUser', requestStream: false, responseStream: false },
      },
    });

    const result = await loadProtoHandler(null, '/fake/service.proto') as {
      success: boolean;
      services?: GrpcServiceInfo[];
      error?: string;
    };

    expect(result.success).toBe(true);
    expect(result.services).toHaveLength(1);
    const svc = result.services![0];
    expect(svc.name).toBe('mypackage.UserService');
    expect(svc.methods).toHaveLength(2);
    expect(svc.methods.map((m) => m.name)).toContain('GetUser');
    expect(svc.methods.map((m) => m.name)).toContain('CreateUser');
  });

  it('returns multiple services from a multi-service proto', async () => {
    existsSyncMock.mockReturnValue(true);
    protoLoadMock.mockResolvedValue({
      'pkg.UserService': {
        GetUser: { path: '/pkg.UserService/GetUser', requestStream: false, responseStream: false },
      },
      'pkg.OrderService': {
        CreateOrder: { path: '/pkg.OrderService/CreateOrder', requestStream: false, responseStream: false },
        StreamOrders: { path: '/pkg.OrderService/StreamOrders', requestStream: false, responseStream: true },
      },
    });

    const result = await loadProtoHandler(null, '/fake/multi.proto') as {
      success: boolean;
      services?: GrpcServiceInfo[];
    };

    expect(result.success).toBe(true);
    expect(result.services).toHaveLength(2);
    const orderSvc = result.services!.find((s) => s.name === 'pkg.OrderService');
    expect(orderSvc).toBeDefined();
    expect(orderSvc!.methods).toHaveLength(2);
    const streamMethod = orderSvc!.methods.find((m) => m.name === 'StreamOrders');
    expect(streamMethod?.responseStream).toBe(true);
  });

  it('identifies streaming method types correctly', async () => {
    existsSyncMock.mockReturnValue(true);
    protoLoadMock.mockResolvedValue({
      'pkg.StreamService': {
        Unary: { path: '/pkg.StreamService/Unary', requestStream: false, responseStream: false },
        ServerStream: { path: '/pkg.StreamService/ServerStream', requestStream: false, responseStream: true },
        ClientStream: { path: '/pkg.StreamService/ClientStream', requestStream: true, responseStream: false },
        BiDi: { path: '/pkg.StreamService/BiDi', requestStream: true, responseStream: true },
      },
    });

    const result = await loadProtoHandler(null, '/fake/stream.proto') as {
      success: boolean;
      services?: GrpcServiceInfo[];
    };

    expect(result.success).toBe(true);
    const methods = result.services![0].methods;

    const unary = methods.find((m) => m.name === 'Unary')!;
    expect(unary.requestStream).toBe(false);
    expect(unary.responseStream).toBe(false);

    const serverStream = methods.find((m) => m.name === 'ServerStream')!;
    expect(serverStream.responseStream).toBe(true);

    const clientStream = methods.find((m) => m.name === 'ClientStream')!;
    expect(clientStream.requestStream).toBe(true);

    const bidi = methods.find((m) => m.name === 'BiDi')!;
    expect(bidi.requestStream).toBe(true);
    expect(bidi.responseStream).toBe(true);
  });

  it('returns error when PackageDefinition contains no services with methods', async () => {
    existsSyncMock.mockReturnValue(true);
    // An entry that is a string (not an object with method-shaped values)
    protoLoadMock.mockResolvedValue({
      'pkg.NotAService': 'just-a-type-not-a-service',
      'pkg.AnotherType': null,
    });

    const result = await loadProtoHandler(null, '/fake/types-only.proto') as {
      success: boolean;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No services found/i);
  });

  it('returns error when proto-loader throws', async () => {
    existsSyncMock.mockReturnValue(true);
    protoLoadMock.mockRejectedValue(new Error('Syntax error in proto file at line 42'));

    const result = await loadProtoHandler(null, '/fake/broken.proto') as {
      success: boolean;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('Syntax error in proto file at line 42');
  });

  it('excludes entries without a path property from service methods', async () => {
    existsSyncMock.mockReturnValue(true);
    protoLoadMock.mockResolvedValue({
      'pkg.UserService': {
        GetUser: { path: '/pkg.UserService/GetUser', requestStream: false, responseStream: false },
        // An object without a path property — should be excluded
        SomeTypeDescriptor: { someField: 'not-a-method' },
      },
    });

    const result = await loadProtoHandler(null, '/fake/service.proto') as {
      success: boolean;
      services?: GrpcServiceInfo[];
    };

    expect(result.success).toBe(true);
    expect(result.services![0].methods).toHaveLength(1);
    expect(result.services![0].methods[0].name).toBe('GetUser');
  });
});

// ─── grpc:invoke handler — params validation ──────────────────────────────────

describe('grpc:invoke — params validation', () => {
  it('returns error when params is null', async () => {
    const result = await invokeHandler(null, null) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/params must be a plain object/i);
  });

  it('returns error when params is a string', async () => {
    const result = await invokeHandler(null, 'invalid') as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/params must be a plain object/i);
  });

  it('returns error when params is a number', async () => {
    const result = await invokeHandler(null, 42) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/params must be a plain object/i);
  });
});

// ─── grpc:invoke handler — serverAddress validation ───────────────────────────

describe('grpc:invoke — serverAddress validation', () => {
  it('returns error when serverAddress is empty', async () => {
    const result = await invokeHandler(null, { serverAddress: '', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/serverAddress must be a non-empty string/i);
  });

  it('returns error when serverAddress is not a string', async () => {
    const result = await invokeHandler(null, { serverAddress: 12345, protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/serverAddress must be a non-empty string/i);
  });

  it('returns error when serverAddress contains null bytes', async () => {
    const result = await invokeHandler(null, { serverAddress: 'localhost\0:50051', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/null bytes/i);
  });

  it('returns error when serverAddress is an http:// URL', async () => {
    const result = await invokeHandler(null, { serverAddress: 'http://localhost:50051', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/host:port address, not a URL/i);
  });

  it('returns error when serverAddress is an https:// URL', async () => {
    const result = await invokeHandler(null, { serverAddress: 'https://example.com:50051', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/host:port address, not a URL/i);
  });

  it('allows javascript: without // (not an attack vector for gRPC server addr)', async () => {
    // javascript:alert(1) has a single colon without //, so does NOT match ://
    // and is treated as a valid host string (would just fail to connect).
    // The validation only rejects scheme://host patterns.
    const result = await invokeHandler(null, { serverAddress: 'javascript:alert(1)', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Passes serverAddress validation, fails at proto file check
    expect(result.error).not.toMatch(/serverAddress/i);
  });

  it('returns error when serverAddress is an ftp:// URL', async () => {
    const result = await invokeHandler(null, { serverAddress: 'ftp://files.example.com', protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/host:port address, not a URL/i);
  });

  it('accepts plain host:port address (fails at protoFilePath next)', async () => {
    const result = await invokeHandler(null, { serverAddress: 'localhost:50051', protoFilePath: '/path/service.json' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Error is about protoFilePath, not serverAddress
    expect(result.error).not.toMatch(/serverAddress/i);
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('accepts dns: scheme (allowed gRPC name resolver)', async () => {
    const result = await invokeHandler(null, { serverAddress: 'dns:///my.service:50051', protoFilePath: '/not-a-proto.txt' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // dns: is allowed, error falls to protoFilePath
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('accepts ipv4: scheme (allowed gRPC name resolver)', async () => {
    const result = await invokeHandler(null, { serverAddress: 'ipv4:127.0.0.1:50051', protoFilePath: '/not.txt' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/serverAddress/i);
  });

  it('accepts unix: scheme (allowed gRPC name resolver)', async () => {
    const result = await invokeHandler(null, { serverAddress: 'unix:/var/run/grpc.sock', protoFilePath: '/not.txt' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/serverAddress/i);
  });

  it('returns error when serverAddress exceeds 512 character limit', async () => {
    const longAddress = 'a'.repeat(513);
    const result = await invokeHandler(null, { serverAddress: longAddress, protoFilePath: '/a.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds maximum length/i);
  });
});

// ─── grpc:invoke handler — protoFilePath validation ───────────────────────────

describe('grpc:invoke — protoFilePath validation', () => {
  it('returns error when protoFilePath does not end with .proto', async () => {
    const result = await invokeHandler(null, { serverAddress: 'localhost:50051', protoFilePath: '/path/schema.json' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('returns error when protoFilePath has a .txt extension', async () => {
    const result = await invokeHandler(null, { serverAddress: 'localhost:50051', protoFilePath: '/path/service.txt' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.proto file/i);
  });

  it('returns error when protoFilePath contains null bytes', async () => {
    const result = await invokeHandler(null, { serverAddress: 'localhost:50051', protoFilePath: '/path/null\0byte.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/null bytes/i);
  });

  it('returns error when proto file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    const result = await invokeHandler(null, { serverAddress: 'localhost:50051', protoFilePath: '/nonexistent/service.proto' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Proto file not found/i);
  });
});

// ─── grpc:invoke handler — metadata validation ────────────────────────────────

describe('grpc:invoke — metadata validation', () => {
  const validBase = {
    serverAddress: 'localhost:50051',
    protoFilePath: '/fake/service.proto',
    serviceName: 'pkg.Service',
    methodName: 'Call',
    payload: '',
    useTls: false,
  };

  beforeEach(() => {
    // Allow fake proto file to "exist" for deeper validation testing
    existsSyncMock.mockReturnValue(true);
  });

  it('returns error when metadata exceeds 200 entries', async () => {
    const metadata = Array.from({ length: 201 }, (_, i) => ({
      key: `key-${i}`,
      value: `value-${i}`,
      enabled: true,
    }));
    const result = await invokeHandler(null, { ...validBase, metadata }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/metadata exceeds maximum of 200 entries/i);
  });

  it('accepts exactly 200 metadata entries without error (fails later at proto-loader)', async () => {
    protoLoadMock.mockRejectedValue(new Error('proto-loader: test'));
    const metadata = Array.from({ length: 200 }, (_, i) => ({
      key: `key-${i}`,
      value: `value-${i}`,
      enabled: true,
    }));
    const result = await invokeHandler(null, { ...validBase, metadata }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Error is from proto-loader, NOT from metadata count check
    expect(result.error).not.toMatch(/metadata exceeds maximum/i);
  });

  it('returns error when a metadata entry is null', async () => {
    const result = await invokeHandler(null, { ...validBase, metadata: [null] }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid metadata entry/i);
  });

  it('returns error when a metadata entry key is not a string', async () => {
    const result = await invokeHandler(null, {
      ...validBase,
      metadata: [{ key: 123, value: 'val', enabled: true }],
    }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Metadata key must be a string/i);
  });

  it('returns error when a metadata entry value is not a string', async () => {
    const result = await invokeHandler(null, {
      ...validBase,
      metadata: [{ key: 'x-header', value: 456, enabled: true }],
    }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Metadata value must be a string/i);
  });

  it('returns error when a metadata entry is a plain string (not an object)', async () => {
    const result = await invokeHandler(null, {
      ...validBase,
      metadata: ['not-an-object'],
    }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid metadata entry/i);
  });

  it('treats non-array metadata as empty (no error)', async () => {
    protoLoadMock.mockRejectedValue(new Error('proto-loader: test'));
    // metadata is not an array → treated as []
    const result = await invokeHandler(null, { ...validBase, metadata: undefined }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Should NOT fail due to metadata validation
    expect(result.error).not.toMatch(/metadata/i);
  });
});

// ─── grpc:invoke handler — payload validation ─────────────────────────────────

describe('grpc:invoke — payload JSON validation', () => {
  const validBase = {
    serverAddress: 'localhost:50051',
    protoFilePath: '/fake/service.proto',
    serviceName: 'pkg.Service',
    methodName: 'Call',
    metadata: [],
    useTls: false,
  };

  beforeEach(() => {
    existsSyncMock.mockReturnValue(true);
    // proto-loader will be called after validation; make it throw to isolate validation errors
    protoLoadMock.mockRejectedValue(new Error('proto-loader: test'));
  });

  it('returns error when payload is invalid JSON', async () => {
    // Override proto-loader mock: invalid JSON should be caught before proto-loader
    protoLoadMock.mockResolvedValue({});
    const result = await invokeHandler(null, { ...validBase, payload: 'not-json-{{{' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/payload must be valid JSON/i);
  });

  it('returns error when payload is a bare string without quotes', async () => {
    protoLoadMock.mockResolvedValue({});
    const result = await invokeHandler(null, { ...validBase, payload: 'hello' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/payload must be valid JSON/i);
  });

  it('returns error when payload has unclosed braces', async () => {
    protoLoadMock.mockResolvedValue({});
    const result = await invokeHandler(null, { ...validBase, payload: '{"key": "value"' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/payload must be valid JSON/i);
  });

  it('does NOT error when payload is empty string (treated as empty object)', async () => {
    const result = await invokeHandler(null, { ...validBase, payload: '' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Error should be from proto-loader, not JSON parsing
    expect(result.error).not.toMatch(/payload must be valid JSON/i);
  });

  it('does NOT error when payload is undefined (treated as empty)', async () => {
    const result = await invokeHandler(null, { ...validBase, payload: undefined }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/payload must be valid JSON/i);
  });

  it('does NOT error when payload is valid JSON object', async () => {
    const result = await invokeHandler(null, { ...validBase, payload: '{"userId": 1, "name": "Alice"}' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    // Error from proto-loader, not JSON parsing
    expect(result.error).not.toMatch(/payload must be valid JSON/i);
  });

  it('does NOT error when payload is a valid JSON array', async () => {
    const result = await invokeHandler(null, { ...validBase, payload: '[1, 2, 3]' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/payload must be valid JSON/i);
  });

  it('does NOT error when payload is whitespace only (treated as empty)', async () => {
    const result = await invokeHandler(null, { ...validBase, payload: '   ' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/payload must be valid JSON/i);
  });
});
