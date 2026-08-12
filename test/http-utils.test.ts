/**
 * Tests for src/utils/httpUtils.ts — HTTP formatting utilities.
 *
 * Pure helper functions for formatting bytes, time, JSON validation,
 * and HTTP method/status styling.
 */
import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatTime,
  getMethodColor,
  getMethodBgColor,
  getStatusColor,
  prettyPrintJson,
  isValidJson,
} from '../src/utils/httpUtils';
import type { HttpMethod } from '../src/types';

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('formats fractional values with up to 2 decimal places', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

// ─── formatTime ──────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats sub-second times in ms', () => {
    expect(formatTime(500)).toBe('500ms');
    expect(formatTime(0)).toBe('0ms');
    expect(formatTime(999)).toBe('999ms');
  });

  it('formats times >= 1s in seconds', () => {
    expect(formatTime(1000)).toBe('1.00s');
    expect(formatTime(2500)).toBe('2.50s');
  });
});

// ─── getMethodColor ──────────────────────────────────────────────────────────

describe('getMethodColor', () => {
  it('returns green for GET', () => {
    expect(getMethodColor('GET')).toContain('green');
  });

  it('returns yellow for POST', () => {
    expect(getMethodColor('POST')).toContain('yellow');
  });

  it('returns red for DELETE', () => {
    expect(getMethodColor('DELETE')).toContain('red');
  });

  it('returns teal for QUERY', () => {
    expect(getMethodColor('QUERY')).toBe('text-teal-400');
  });

  it('returns a color for every standard method', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY'];
    methods.forEach(method => {
      expect(getMethodColor(method)).toBeTruthy();
    });
  });
});

// ─── getMethodBgColor ────────────────────────────────────────────────────────

describe('getMethodBgColor', () => {
  it('returns a CSS class for each standard method', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY'];
    methods.forEach(method => {
      const cls = getMethodBgColor(method);
      expect(cls).toMatch(/^method-/);
    });
  });

  it('returns the QUERY badge class', () => {
    expect(getMethodBgColor('QUERY')).toBe('method-query');
  });
});

// ─── getStatusColor ──────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green for 2xx status codes', () => {
    expect(getStatusColor(200)).toContain('green');
    expect(getStatusColor(201)).toContain('green');
    expect(getStatusColor(204)).toContain('green');
  });

  it('returns blue for 3xx status codes', () => {
    expect(getStatusColor(301)).toContain('blue');
    expect(getStatusColor(304)).toContain('blue');
  });

  it('returns yellow for 4xx status codes', () => {
    expect(getStatusColor(400)).toContain('yellow');
    expect(getStatusColor(404)).toContain('yellow');
    expect(getStatusColor(401)).toContain('yellow');
  });

  it('returns red for 5xx status codes', () => {
    expect(getStatusColor(500)).toContain('red');
    expect(getStatusColor(503)).toContain('red');
  });

  it('returns gray for 1xx status codes', () => {
    expect(getStatusColor(100)).toContain('gray');
  });
});

// ─── prettyPrintJson ─────────────────────────────────────────────────────────

describe('prettyPrintJson', () => {
  it('formats compact JSON with indentation', () => {
    const result = prettyPrintJson('{"a":1,"b":"hello"}');
    expect(result).toBe('{\n  "a": 1,\n  "b": "hello"\n}');
  });

  it('returns original string for invalid JSON', () => {
    expect(prettyPrintJson('not json')).toBe('not json');
  });

  it('handles already-formatted JSON', () => {
    const input = '{\n  "a": 1\n}';
    const result = prettyPrintJson(input);
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it('formats JSON arrays', () => {
    const result = prettyPrintJson('[1,2,3]');
    expect(result).toBe('[\n  1,\n  2,\n  3\n]');
  });
});

// ─── isValidJson ─────────────────────────────────────────────────────────────

describe('isValidJson', () => {
  it('returns true for valid JSON object', () => {
    expect(isValidJson('{"key": "value"}')).toBe(true);
  });

  it('returns true for valid JSON array', () => {
    expect(isValidJson('[1, 2, 3]')).toBe(true);
  });

  it('returns true for JSON primitives', () => {
    expect(isValidJson('"hello"')).toBe(true);
    expect(isValidJson('42')).toBe(true);
    expect(isValidJson('true')).toBe(true);
    expect(isValidJson('null')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(isValidJson('not json')).toBe(false);
    expect(isValidJson('{key: value}')).toBe(false);
    expect(isValidJson("{'key': 'value'}")).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidJson('')).toBe(false);
  });
});
