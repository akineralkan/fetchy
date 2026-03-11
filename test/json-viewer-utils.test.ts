/**
 * Tests for src/utils/jsonViewerUtils.ts
 *
 * Covers every exported symbol:
 *  - parseJsonSafely     — safe JSON.parse wrapper
 *  - truncateJsonString  — 500-char display cap
 *  - STRING_TRUNCATE_MAX — exported constant sanity check
 */
import { describe, it, expect } from 'vitest';
import {
  parseJsonSafely,
  truncateJsonString,
  STRING_TRUNCATE_MAX,
} from '../src/utils/jsonViewerUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('STRING_TRUNCATE_MAX is 500', () => {
    expect(STRING_TRUNCATE_MAX).toBe(500);
  });
});

// ─── parseJsonSafely ─────────────────────────────────────────────────────────

describe('parseJsonSafely', () => {
  describe('valid JSON returns parsed value', () => {
    it('parses a flat object', () => {
      expect(parseJsonSafely('{"a":1}')).toEqual({ a: 1 });
    });

    it('parses a nested object', () => {
      expect(parseJsonSafely('{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
    });

    it('parses an array', () => {
      expect(parseJsonSafely('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('parses a nested array', () => {
      expect(parseJsonSafely('[[1,2],[3,4]]')).toEqual([[1, 2], [3, 4]]);
    });

    it('parses an empty object', () => {
      expect(parseJsonSafely('{}')).toEqual({});
    });

    it('parses an empty array', () => {
      expect(parseJsonSafely('[]')).toEqual([]);
    });

    it('parses a string literal', () => {
      expect(parseJsonSafely('"hello"')).toBe('hello');
    });

    it('parses a number literal', () => {
      expect(parseJsonSafely('42')).toBe(42);
    });

    it('parses true', () => {
      expect(parseJsonSafely('true')).toBe(true);
    });

    it('parses false', () => {
      expect(parseJsonSafely('false')).toBe(false);
    });

    it('parses null literal', () => {
      expect(parseJsonSafely('null')).toBeNull();
    });

    it('parses pretty-printed JSON', () => {
      const pretty = JSON.stringify({ id: 1, name: 'test' }, null, 2);
      expect(parseJsonSafely(pretty)).toEqual({ id: 1, name: 'test' });
    });

    it('parses JSON with unicode characters', () => {
      expect(parseJsonSafely('{"emoji":"\\uD83D\\uDE00"}')).toEqual({ emoji: '😀' });
    });
  });

  describe('invalid JSON returns null', () => {
    it('returns null for empty string', () => {
      expect(parseJsonSafely('')).toBeNull();
    });

    it('returns null for plain text', () => {
      expect(parseJsonSafely('hello world')).toBeNull();
    });

    it('returns null for trailing-comma object', () => {
      expect(parseJsonSafely('{"a":1,}')).toBeNull();
    });

    it('returns null for single-quoted JSON', () => {
      expect(parseJsonSafely("{'a':1}")).toBeNull();
    });

    it('returns null for truncated JSON', () => {
      expect(parseJsonSafely('{"a":1')).toBeNull();
    });

    it('returns null for XML', () => {
      expect(parseJsonSafely('<root><item/></root>')).toBeNull();
    });

    it('returns null for NaN literal (not valid JSON)', () => {
      expect(parseJsonSafely('NaN')).toBeNull();
    });

    it('returns null for undefined literal (not valid JSON)', () => {
      expect(parseJsonSafely('undefined')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(parseJsonSafely('   \n  ')).toBeNull();
    });
  });
});

// ─── truncateJsonString ──────────────────────────────────────────────────────

describe('truncateJsonString', () => {
  it('returns string unchanged when shorter than max', () => {
    expect(truncateJsonString('hello')).toBe('hello');
  });

  it('returns empty string unchanged', () => {
    expect(truncateJsonString('')).toBe('');
  });

  it('returns string unchanged when exactly at max length', () => {
    const str = 'a'.repeat(STRING_TRUNCATE_MAX);
    expect(truncateJsonString(str)).toBe(str);
  });

  it('truncates string that exceeds max and appends "..."', () => {
    const str = 'a'.repeat(STRING_TRUNCATE_MAX + 1);
    const result = truncateJsonString(str);
    expect(result).toBe('a'.repeat(STRING_TRUNCATE_MAX) + '...');
  });

  it('truncated result has length max + 3 (for "...")', () => {
    const str = 'x'.repeat(600);
    const result = truncateJsonString(str);
    expect(result).toHaveLength(STRING_TRUNCATE_MAX + 3);
  });

  it('preserves content up to the truncation point', () => {
    const str = 'abcdef'.repeat(100); // 600 chars
    const result = truncateJsonString(str);
    expect(result.startsWith(str.substring(0, STRING_TRUNCATE_MAX))).toBe(true);
    expect(result.endsWith('...')).toBe(true);
  });

  it('accepts a custom maxLength', () => {
    expect(truncateJsonString('hello world', 5)).toBe('hello...');
  });

  it('custom maxLength: returns unchanged when string fits', () => {
    expect(truncateJsonString('hi', 5)).toBe('hi');
  });

  it('custom maxLength: exact boundary is not truncated', () => {
    expect(truncateJsonString('hello', 5)).toBe('hello');
  });
});

