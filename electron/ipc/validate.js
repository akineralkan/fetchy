/**
 * Shared IPC input validation helpers.
 *
 * All ipcMain.handle callbacks should validate their renderer-supplied
 * parameters using these helpers before processing.
 *
 * @module electron/ipc/validate
 */
'use strict';

const path = require('path');

// ─── Primitive Validators ────────────────────────────────────────────────────

/**
 * Assert a value is a non-empty string, optionally capped at maxLen.
 * @param {*} value     - The value to check
 * @param {string} name - Parameter name for error messages
 * @param {number} [maxLen=10000] - Maximum allowed length
 * @returns {string}    - The validated (trimmed if desired) string
 */
function requireString(value, name, maxLen = 10_000) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (value.length > maxLen) {
    throw new Error(`${name} exceeds maximum length of ${maxLen}`);
  }
  return value;
}

/**
 * Assert a value is a string (may be empty), optionally capped at maxLen.
 */
function optionalString(value, name, maxLen = 10_000) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }
  if (value.length > maxLen) {
    throw new Error(`${name} exceeds maximum length of ${maxLen}`);
  }
  return value;
}

/**
 * Assert a value is a positive integer, capped at max.
 */
function requirePositiveInt(value, name, max = 1_000_000) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${name} must be a positive integer (max ${max})`);
  }
  return n;
}

/**
 * Assert a value is a non-negative number, capped at max.
 */
function requireNonNegativeNumber(value, name, max = 1_000_000) {
  const n = Number(value);
  if (typeof n !== 'number' || Number.isNaN(n) || n < 0 || n > max) {
    throw new Error(`${name} must be a non-negative number (max ${max})`);
  }
  return n;
}

/**
 * Assert a value is a plain object (not null, not array).
 */
function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be a plain object`);
  }
  return value;
}

/**
 * Assert a value is an array.
 */
function requireArray(value, name, maxLen = 10_000) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  if (value.length > maxLen) {
    throw new Error(`${name} exceeds maximum length of ${maxLen}`);
  }
  return value;
}

// ─── Path Validators ─────────────────────────────────────────────────────────

/**
 * Validate that a relative filepath doesn't escape its parent directory.
 * Blocks `..` components, absolute paths, and null bytes.
 * @param {string} filepath - The relative file path to validate
 * @param {string} name     - Parameter name for error messages
 * @returns {string}        - The validated filepath
 */
function requireSafeRelativePath(filepath, name) {
  requireString(filepath, name, 1000);

  // Block null bytes
  if (filepath.includes('\0')) {
    throw new Error(`${name} contains null bytes`);
  }

  // Normalize separators
  const normalized = filepath.replace(/\\/g, '/');

  // Block absolute paths — check both Unix-style and Windows drive-letter style
  // (path.isAbsolute() is platform-aware and misses Windows paths on Linux CI)
  if (path.isAbsolute(filepath) || normalized.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filepath)) {
    throw new Error(`${name} must be a relative path`);
  }

  // Block traversal
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`${name} contains path traversal (..)`);
    }
  }

  return filepath;
}

/**
 * Validate that a directory path is a string and exists check is left to caller.
 * Blocks null bytes and path injection via unexpected characters.
 */
function requireDirectoryPath(value, name) {
  requireString(value, name, 1000);
  if (value.includes('\0')) {
    throw new Error(`${name} contains null bytes`);
  }
  return value;
}

/**
 * Validate an HTTP method.
 */
const ALLOWED_METHODS = new Set([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY',
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'query',
]);

function requireHttpMethod(value, name) {
  if (!ALLOWED_METHODS.has(value)) {
    throw new Error(`${name} must be a valid HTTP method`);
  }
  return value;
}

/**
 * Validate a URL string.
 */
function requireUrl(value, name) {
  requireString(value, name, 65_536);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  return value;
}

/**
 * Validate that a value is one of the allowed values.
 */
function requireOneOf(value, name, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

module.exports = {
  requireString,
  optionalString,
  requirePositiveInt,
  requireNonNegativeNumber,
  requireObject,
  requireArray,
  requireSafeRelativePath,
  requireDirectoryPath,
  requireHttpMethod,
  requireUrl,
  requireOneOf,
};
