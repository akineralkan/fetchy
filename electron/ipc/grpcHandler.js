/**
 * IPC handler for gRPC requests.
 * Handles: grpc:load-proto, grpc:invoke
 *
 * @module electron/ipc/grpcHandler
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { requireString, optionalString, requireArray } = require('./validate');

// Lazy-load gRPC modules so the app still starts if they're unavailable.
let grpc = null;
let protoLoader = null;

function loadGrpcModules() {
  if (!grpc) {
    grpc = require('@grpc/grpc-js');
  }
  if (!protoLoader) {
    protoLoader = require('@grpc/proto-loader');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate an absolute file path for a .proto file.
 * Blocks null bytes. Does NOT restrict to relative paths (proto files are user-picked
 * via file dialog so they will always be absolute).
 */
function requireAbsoluteProtoPath(value, name) {
  requireString(value, name, 4096);
  if (value.includes('\0')) {
    throw new Error(`${name} contains null bytes`);
  }
  // Must end with .proto
  if (!value.toLowerCase().endsWith('.proto')) {
    throw new Error(`${name} must be a .proto file`);
  }
  if (!fs.existsSync(value)) {
    throw new Error(`Proto file not found: ${value}`);
  }
  return value;
}

/**
 * Validate a gRPC server address (host:port or host).
 * Does NOT allow javascript: URIs, null bytes, etc.
 */
function requireServerAddress(value, name) {
  requireString(value, name, 512);
  if (value.includes('\0')) {
    throw new Error(`${name} contains null bytes`);
  }
  // Basic sanity — must not start with a protocol scheme other than expected forms
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(value) &&
      !value.startsWith('dns:') &&
      !value.startsWith('ipv4:') &&
      !value.startsWith('ipv6:') &&
      !value.startsWith('unix:')) {
    throw new Error(`${name} must be a host:port address, not a URL`);
  }
  return value;
}

/**
 * Navigate a nested object by a dot-separated path (e.g. "mypackage.MyService").
 */
function getNestedValue(obj, dotPath) {
  const parts = dotPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = current[part];
  }
  return current;
}

/**
 * Parse a PackageDefinition from @grpc/proto-loader and extract all service
 * definitions as a flat list of { name, methods[] } objects.
 *
 * @param {import('@grpc/proto-loader').PackageDefinition} packageDef
 * @returns {Array<{ name: string, methods: Array<{name, path, requestStream, responseStream}> }>}
 */
function extractServices(packageDef) {
  const services = [];
  for (const [fullName, definition] of Object.entries(packageDef)) {
    if (typeof definition !== 'object' || definition === null) continue;

    const methods = [];
    for (const [methodName, methodDef] of Object.entries(definition)) {
      // A service method descriptor always has a `path` string like "/pkg.Service/Method"
      if (
        methodDef &&
        typeof methodDef === 'object' &&
        typeof methodDef.path === 'string'
      ) {
        methods.push({
          name: methodName,
          path: methodDef.path,
          requestStream: methodDef.requestStream === true,
          responseStream: methodDef.responseStream === true,
        });
      }
    }

    if (methods.length > 0) {
      services.push({ name: fullName, methods });
    }
  }
  return services;
}

// ─── IPC Handler Registration ─────────────────────────────────────────────────

/**
 * Register gRPC IPC handlers.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function register(ipcMain) {

  /**
   * Load a .proto file and return the list of services and their methods.
   *
   * Renderer → main: { filePath: string }
   * Main → renderer: { success: boolean, services?: GrpcServiceInfo[], error?: string }
   */
  ipcMain.handle('grpc:load-proto', async (_event, filePath) => {
    try {
      loadGrpcModules();
      requireAbsoluteProtoPath(filePath, 'filePath');

      const includeDirs = [path.dirname(filePath)];

      const packageDef = await protoLoader.load(filePath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs,
      });

      const services = extractServices(packageDef);

      if (services.length === 0) {
        return { success: false, error: 'No services found in the .proto file' };
      }

      return { success: true, services };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  });

  /**
   * Invoke a gRPC unary call.
   *
   * Renderer → main: {
   *   serverAddress: string,  // host:port
   *   protoFilePath: string,
   *   serviceName: string,    // fully-qualified, e.g. "mypackage.MyService"
   *   methodName: string,
   *   payload: string,        // JSON string
   *   metadata: Array<{ key: string, value: string, enabled: boolean }>,
   *   useTls: boolean,
   * }
   * Main → renderer: { success: boolean, response?: string, error?: string, code?: number, time?: number }
   */
  ipcMain.handle('grpc:invoke', async (_event, params) => {
    try {
      loadGrpcModules();

      if (!params || typeof params !== 'object') {
        throw new Error('params must be a plain object');
      }

      const serverAddress = requireServerAddress(params.serverAddress, 'serverAddress');
      const protoFilePath = requireAbsoluteProtoPath(params.protoFilePath, 'protoFilePath');
      const serviceName = requireString(params.serviceName, 'serviceName', 512);
      const methodName = requireString(params.methodName, 'methodName', 512);
      const payloadStr = optionalString(params.payload, 'payload', 1_000_000);
      const useTls = params.useTls === true;

      const metadataList = Array.isArray(params.metadata) ? params.metadata : [];
      if (metadataList.length > 200) {
        throw new Error('metadata exceeds maximum of 200 entries');
      }

      // Validate each metadata entry
      for (const entry of metadataList) {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid metadata entry');
        if (typeof entry.key !== 'string') throw new Error('Metadata key must be a string');
        if (typeof entry.value !== 'string') throw new Error('Metadata value must be a string');
      }

      // Parse the JSON payload
      let requestPayload = {};
      if (payloadStr && payloadStr.trim()) {
        try {
          requestPayload = JSON.parse(payloadStr);
        } catch {
          throw new Error('payload must be valid JSON');
        }
      }

      const includeDirs = [path.dirname(protoFilePath)];
      const packageDef = await protoLoader.load(protoFilePath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs,
      });

      const grpcObject = grpc.loadPackageDefinition(packageDef);

      // Navigate to the service constructor using the fully-qualified service name
      const ServiceConstructor = getNestedValue(grpcObject, serviceName);
      if (!ServiceConstructor || typeof ServiceConstructor !== 'function') {
        throw new Error(`Service "${serviceName}" not found in the proto file`);
      }

      const credentials = useTls
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();

      const client = new ServiceConstructor(serverAddress, credentials);

      // Validate that the method exists on the client
      if (typeof client[methodName] !== 'function') {
        client.close();
        throw new Error(`Method "${methodName}" not found on service "${serviceName}"`);
      }

      // Build gRPC metadata
      const grpcMeta = new grpc.Metadata();
      for (const entry of metadataList) {
        if (entry.enabled !== false && entry.key && entry.value) {
          grpcMeta.add(entry.key, entry.value);
        }
      }

      const startTime = Date.now();

      // Execute unary call
      return new Promise((resolve) => {
        const deadline = new Date(Date.now() + 30_000); // 30 s timeout

        // Check streaming type from packageDef
        const serviceDef = packageDef[serviceName];
        const methodDef = serviceDef ? serviceDef[methodName] : null;
        const requestStream = methodDef ? methodDef.requestStream : false;
        const responseStream = methodDef ? methodDef.responseStream : false;

        if (requestStream || responseStream) {
          // For streaming methods, only collect the first response and note the limitation
          const call = requestStream
            ? client[methodName](grpcMeta)
            : client[methodName](requestPayload, grpcMeta);

          const responses = [];
          let hasError = false;

          if (requestStream) {
            // Client streaming: write the payload and end
            call.write(requestPayload);
            call.end();
          }

          call.on('data', (data) => {
            responses.push(data);
          });

          call.on('error', (err) => {
            hasError = true;
            client.close();
            resolve({
              success: false,
              error: err.message,
              code: err.code,
              time: Date.now() - startTime,
            });
          });

          call.on('end', () => {
            if (!hasError) {
              client.close();
              const streamType = requestStream && responseStream
                ? 'bidirectional'
                : requestStream
                  ? 'client-streaming'
                  : 'server-streaming';
              resolve({
                success: true,
                response: JSON.stringify(responses.length === 1 ? responses[0] : responses),
                streamType,
                time: Date.now() - startTime,
              });
            }
          });
        } else {
          // Unary call
          client[methodName](requestPayload, grpcMeta, { deadline }, (err, response) => {
            client.close();
            if (err) {
              resolve({
                success: false,
                error: err.message,
                code: err.code,
                time: Date.now() - startTime,
              });
            } else {
              resolve({
                success: true,
                response: JSON.stringify(response),
                time: Date.now() - startTime,
              });
            }
          });
        }
      });
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  });
}

module.exports = { register };
