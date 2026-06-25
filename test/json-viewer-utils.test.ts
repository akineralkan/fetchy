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
  isLargeIntegerString,
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

// ─── isLargeIntegerString ─────────────────────────────────────────────────────

describe('isLargeIntegerString', () => {
  it('returns false for normal small integers', () => {
    expect(isLargeIntegerString('42')).toBe(false);
  });

  it('returns false for Number.MAX_SAFE_INTEGER itself', () => {
    expect(isLargeIntegerString('9007199254740991')).toBe(false);
  });

  it('returns true for MAX_SAFE_INTEGER + 1', () => {
    expect(isLargeIntegerString('9007199254740992')).toBe(true);
  });

  it('returns true for a typical 19-digit ID', () => {
    expect(isLargeIntegerString('3901845657631065159')).toBe(true);
  });

  it('returns true for a negative 19-digit value', () => {
    expect(isLargeIntegerString('-3901845657631065159')).toBe(true);
  });

  it('returns false for a negative safe integer', () => {
    expect(isLargeIntegerString('-9007199254740991')).toBe(false);
  });

  it('returns false for a decimal string', () => {
    expect(isLargeIntegerString('3901845657631065159.5')).toBe(false);
  });

  it('returns false for a non-numeric string', () => {
    expect(isLargeIntegerString('hello')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isLargeIntegerString('')).toBe(false);
  });
});

// ─── parseJsonSafely – large integer preservation ────────────────────────────

describe('parseJsonSafely – large integer preservation', () => {
  it('preserves a top-level large integer as a string', () => {
    const result = parseJsonSafely('3901845657631065159') as string;
    expect(result).toBe('3901845657631065159');
  });

  it('preserves large integer values inside an object', () => {
    const result = parseJsonSafely('{"id":3901845657631065159}') as { id: string };
    expect(result.id).toBe('3901845657631065159');
  });

  it('preserves multiple large integers in an array', () => {
    const result = parseJsonSafely('[3901845657631065159,3901845780842939464]') as string[];
    expect(result[0]).toBe('3901845657631065159');
    expect(result[1]).toBe('3901845780842939464');
  });

  it('does not alter a safe integer', () => {
    const result = parseJsonSafely('{"count":42}') as { count: number };
    expect(result.count).toBe(42);
    expect(typeof result.count).toBe('number');
  });

  it('does not alter MAX_SAFE_INTEGER itself (stays a number)', () => {
    const result = parseJsonSafely('9007199254740991');
    expect(result).toBe(9007199254740991);
    expect(typeof result).toBe('number');
  });

  it('preserves a negative large integer', () => {
    const result = parseJsonSafely('{"id":-3901845657631065159}') as { id: string };
    expect(result.id).toBe('-3901845657631065159');
  });

  it('does not corrupt large integers that appear inside existing string values', () => {
    const result = parseJsonSafely('{"note":"id is 3901845657631065159"}') as { note: string };
    // The number inside the string must remain verbatim, unquoted-wrapped
    expect(result.note).toBe('id is 3901845657631065159');
  });

  it('parses a real-world hosts response preserving all large IDs', () => {
    const json = `{
      "hosts": [
        { "id": "3901845657631065159", "gatewayId": "3901845657631065159" },
        { "id": "3924950067986826317", "gatewayId": "3901845657631065159" }
      ]
    }`;
    // IDs are already strings in this fixture – they must be unchanged
    const result = parseJsonSafely(json) as { hosts: { id: string; gatewayId: string }[] };
    expect(result.hosts[0].id).toBe('3901845657631065159');
    expect(result.hosts[1].id).toBe('3924950067986826317');
  });

  it('parses a payload where IDs are bare numbers and preserves them', () => {
    const json = `{
      "hosts": [
        { "id": 3901845657631065159, "gatewayId": 3901845657631065159 },
        { "id": 3924950067986826317, "gatewayId": 3901845657631065159 }
      ]
    }`;
    const result = parseJsonSafely(json) as { hosts: { id: string; gatewayId: string }[] };
    expect(result.hosts[0].id).toBe('3901845657631065159');
    expect(result.hosts[1].id).toBe('3924950067986826317');
  });

  it('handles floats without treating their integer part as a large int', () => {
    const result = parseJsonSafely('{"ratio":1.7976931348623157e+308}') as { ratio: number };
    expect(typeof result.ratio).toBe('number');
  });
});

