/**
 * Tests for electron/ipc/validate.js — IPC input validation helpers.
 *
 * These are security-critical validators that protect all ipcMain.handle
 * callbacks from malicious renderer-supplied parameters.
 */
import { describe, it, expect } from 'vitest';

// validate.js is a CommonJS module, import its exports
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
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
} = require('../electron/ipc/validate');

// ─── requireString ───────────────────────────────────────────────────────────

describe('requireString', () => {
  it('returns a valid non-empty string', () => {
    expect(requireString('hello', 'test')).toBe('hello');
  });

  it('throws on empty string', () => {
    expect(() => requireString('', 'field')).toThrow('field must be a non-empty string');
  });

  it('throws on null', () => {
    expect(() => requireString(null, 'field')).toThrow('field must be a non-empty string');
  });

  it('throws on undefined', () => {
    expect(() => requireString(undefined, 'field')).toThrow('field must be a non-empty string');
  });

  it('throws on number', () => {
    expect(() => requireString(123, 'field')).toThrow('field must be a non-empty string');
  });

  it('throws on boolean', () => {
    expect(() => requireString(true, 'field')).toThrow('field must be a non-empty string');
  });

  it('throws on object', () => {
    expect(() => requireString({}, 'field')).toThrow('field must be a non-empty string');
  });

  it('throws when string exceeds maxLen', () => {
    expect(() => requireString('a'.repeat(101), 'field', 100)).toThrow('field exceeds maximum length of 100');
  });

  it('accepts string at exactly maxLen', () => {
    expect(requireString('a'.repeat(100), 'field', 100)).toBe('a'.repeat(100));
  });

  it('uses default maxLen of 10000', () => {
    const longStr = 'x'.repeat(10_000);
    expect(requireString(longStr, 'field')).toBe(longStr);
    expect(() => requireString('x'.repeat(10_001), 'field')).toThrow('exceeds maximum length');
  });
});

// ─── optionalString ──────────────────────────────────────────────────────────

describe('optionalString', () => {
  it('returns empty string for undefined', () => {
    expect(optionalString(undefined, 'field')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(optionalString(null, 'field')).toBe('');
  });

  it('returns the string as-is for valid input', () => {
    expect(optionalString('hello', 'field')).toBe('hello');
  });

  it('returns empty string for empty string input', () => {
    expect(optionalString('', 'field')).toBe('');
  });

  it('throws on non-string types', () => {
    expect(() => optionalString(123, 'field')).toThrow('field must be a string');
    expect(() => optionalString(true, 'field')).toThrow('field must be a string');
    expect(() => optionalString({}, 'field')).toThrow('field must be a string');
  });

  it('throws when string exceeds maxLen', () => {
    expect(() => optionalString('a'.repeat(51), 'field', 50)).toThrow('exceeds maximum length');
  });
});

// ─── requirePositiveInt ──────────────────────────────────────────────────────

describe('requirePositiveInt', () => {
  it('returns a valid positive integer', () => {
    expect(requirePositiveInt(1, 'field')).toBe(1);
    expect(requirePositiveInt(42, 'field')).toBe(42);
  });

  it('accepts string numeric values (coercion)', () => {
    expect(requirePositiveInt('5', 'field')).toBe(5);
  });

  it('throws on zero', () => {
    expect(() => requirePositiveInt(0, 'field')).toThrow('field must be a positive integer');
  });

  it('throws on negative numbers', () => {
    expect(() => requirePositiveInt(-1, 'field')).toThrow('field must be a positive integer');
  });

  it('throws on floating point numbers', () => {
    expect(() => requirePositiveInt(1.5, 'field')).toThrow('field must be a positive integer');
  });

  it('throws on NaN', () => {
    expect(() => requirePositiveInt(NaN, 'field')).toThrow('field must be a positive integer');
  });

  it('throws when exceeding max', () => {
    expect(() => requirePositiveInt(11, 'field', 10)).toThrow('must be a positive integer (max 10)');
  });

  it('accepts value at exactly max', () => {
    expect(requirePositiveInt(10, 'field', 10)).toBe(10);
  });
});

// ─── requireNonNegativeNumber ────────────────────────────────────────────────

describe('requireNonNegativeNumber', () => {
  it('accepts zero', () => {
    expect(requireNonNegativeNumber(0, 'field')).toBe(0);
  });

  it('accepts positive numbers', () => {
    expect(requireNonNegativeNumber(100, 'field')).toBe(100);
  });

  it('accepts floating point numbers', () => {
    expect(requireNonNegativeNumber(3.14, 'field')).toBe(3.14);
  });

  it('throws on negative numbers', () => {
    expect(() => requireNonNegativeNumber(-1, 'field')).toThrow('must be a non-negative number');
  });

  it('throws on NaN', () => {
    expect(() => requireNonNegativeNumber(NaN, 'field')).toThrow('must be a non-negative number');
  });

  it('throws when exceeding max', () => {
    expect(() => requireNonNegativeNumber(1_000_001, 'field')).toThrow('must be a non-negative number');
  });
});

// ─── requireObject ───────────────────────────────────────────────────────────

describe('requireObject', () => {
  it('accepts a plain object', () => {
    const obj = { a: 1 };
    expect(requireObject(obj, 'field')).toBe(obj);
  });

  it('accepts an empty object', () => {
    expect(requireObject({}, 'field')).toEqual({});
  });

  it('throws on null', () => {
    expect(() => requireObject(null, 'field')).toThrow('field must be a plain object');
  });

  it('throws on array', () => {
    expect(() => requireObject([], 'field')).toThrow('field must be a plain object');
  });

  it('throws on string', () => {
    expect(() => requireObject('string', 'field')).toThrow('field must be a plain object');
  });

  it('throws on number', () => {
    expect(() => requireObject(42, 'field')).toThrow('field must be a plain object');
  });
});

// ─── requireArray ────────────────────────────────────────────────────────────

describe('requireArray', () => {
  it('accepts a valid array', () => {
    expect(requireArray([1, 2, 3], 'field')).toEqual([1, 2, 3]);
  });

  it('accepts an empty array', () => {
    expect(requireArray([], 'field')).toEqual([]);
  });

  it('throws on non-array types', () => {
    expect(() => requireArray('string', 'field')).toThrow('field must be an array');
    expect(() => requireArray({}, 'field')).toThrow('field must be an array');
    expect(() => requireArray(42, 'field')).toThrow('field must be an array');
  });

  it('throws when array exceeds maxLen', () => {
    const bigArray = new Array(101).fill(0);
    expect(() => requireArray(bigArray, 'field', 100)).toThrow('exceeds maximum length');
  });
});

// ─── requireSafeRelativePath (security-critical) ─────────────────────────────

describe('requireSafeRelativePath', () => {
  it('accepts a simple filename', () => {
    expect(requireSafeRelativePath('file.json', 'path')).toBe('file.json');
  });

  it('accepts a nested relative path', () => {
    expect(requireSafeRelativePath('folder/file.json', 'path')).toBe('folder/file.json');
  });

  it('accepts a deeply nested path', () => {
    expect(requireSafeRelativePath('a/b/c/d/file.txt', 'path')).toBe('a/b/c/d/file.txt');
  });

  it('blocks path traversal with ../', () => {
    expect(() => requireSafeRelativePath('../etc/passwd', 'path')).toThrow('contains path traversal');
  });

  it('blocks path traversal with ..\\', () => {
    expect(() => requireSafeRelativePath('..\\etc\\passwd', 'path')).toThrow('contains path traversal');
  });

  it('blocks mid-path traversal', () => {
    expect(() => requireSafeRelativePath('folder/../../../etc/passwd', 'path')).toThrow('contains path traversal');
  });

  it('blocks absolute paths (Unix)', () => {
    expect(() => requireSafeRelativePath('/etc/passwd', 'path')).toThrow('must be a relative path');
  });

  it('blocks absolute paths (Windows)', () => {
    expect(() => requireSafeRelativePath('C:\\Windows\\System32', 'path')).toThrow('must be a relative path');
  });

  it('blocks null bytes', () => {
    expect(() => requireSafeRelativePath('file\0.json', 'path')).toThrow('contains null bytes');
  });

  it('blocks empty string', () => {
    expect(() => requireSafeRelativePath('', 'path')).toThrow('must be a non-empty string');
  });
});

// ─── requireDirectoryPath ────────────────────────────────────────────────────

describe('requireDirectoryPath', () => {
  it('accepts a valid directory path', () => {
    expect(requireDirectoryPath('/home/user/data', 'dir')).toBe('/home/user/data');
  });

  it('blocks null bytes', () => {
    expect(() => requireDirectoryPath('/home/\0user', 'dir')).toThrow('contains null bytes');
  });

  it('throws on empty string', () => {
    expect(() => requireDirectoryPath('', 'dir')).toThrow('must be a non-empty string');
  });
});

// ─── requireHttpMethod ───────────────────────────────────────────────────────

describe('requireHttpMethod', () => {
  it('accepts all standard HTTP methods (uppercase)', () => {
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY']) {
      expect(requireHttpMethod(m, 'method')).toBe(m);
    }
  });

  it('accepts lowercase methods', () => {
    for (const m of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'query']) {
      expect(requireHttpMethod(m, 'method')).toBe(m);
    }
  });

  it('rejects invalid methods', () => {
    expect(() => requireHttpMethod('INVALID', 'method')).toThrow('must be a valid HTTP method');
    expect(() => requireHttpMethod('TRACE', 'method')).toThrow('must be a valid HTTP method');
    expect(() => requireHttpMethod('CONNECT', 'method')).toThrow('must be a valid HTTP method');
  });
});

// ─── requireUrl ──────────────────────────────────────────────────────────────

describe('requireUrl', () => {
  it('accepts valid HTTP URLs', () => {
    expect(requireUrl('https://example.com', 'url')).toBe('https://example.com');
    expect(requireUrl('http://localhost:3000/api', 'url')).toBe('http://localhost:3000/api');
  });

  it('accepts URLs with query params and fragments', () => {
    expect(requireUrl('https://api.example.com/users?page=1&limit=10#section', 'url'))
      .toBe('https://api.example.com/users?page=1&limit=10#section');
  });

  it('rejects invalid URLs', () => {
    expect(() => requireUrl('not-a-url', 'url')).toThrow('must be a valid URL');
    expect(() => requireUrl('://missing-protocol', 'url')).toThrow('must be a valid URL');
  });

  it('rejects empty strings', () => {
    expect(() => requireUrl('', 'url')).toThrow('must be a non-empty string');
  });
});

// ─── requireOneOf ────────────────────────────────────────────────────────────

describe('requireOneOf', () => {
  it('accepts a value that is in the allowed list', () => {
    expect(requireOneOf('a', 'field', ['a', 'b', 'c'])).toBe('a');
  });

  it('rejects a value not in the allowed list', () => {
    expect(() => requireOneOf('d', 'field', ['a', 'b', 'c'])).toThrow('field must be one of: a, b, c');
  });

  it('is type-strict (number vs string)', () => {
    expect(() => requireOneOf(1, 'field', ['1', '2'])).toThrow('must be one of');
  });
});
