/**
 * Tests for src/utils/editorUtils.ts
 *
 * Covers:
 *  - isLightTheme  — determines which CodeMirror colour scheme to apply
 *  - formatJson    — pretty-prints JSON for the "Format" button in BodyEditor
 */
import { describe, it, expect } from 'vitest';
import { isLightTheme, LIGHT_THEMES, formatJson } from '../src/utils/editorUtils';

// ─── isLightTheme ─────────────────────────────────────────────────────────────

describe('isLightTheme', () => {
  // --- known light themes ---
  it.each(['light', 'ocean', 'earth', 'candy'])(
    'returns true for the "%s" theme',
    (theme) => expect(isLightTheme(theme)).toBe(true),
  );

  // --- known dark / unknown themes ---
  it.each(['dark', 'midnight', 'dracula', '', 'LIGHT', 'Light'])(
    'returns false for the "%s" theme',
    (theme) => expect(isLightTheme(theme)).toBe(false),
  );

  it('is case-sensitive (upper-case names are not light themes)', () => {
    expect(isLightTheme('Ocean')).toBe(false);
    expect(isLightTheme('OCEAN')).toBe(false);
  });
});

describe('LIGHT_THEMES (set membership)', () => {
  it('contains exactly the four built-in light themes', () => {
    expect([...LIGHT_THEMES].sort()).toEqual(['candy', 'earth', 'light', 'ocean']);
  });
});

// ─── formatJson ───────────────────────────────────────────────────────────────

describe('formatJson', () => {

  // --- pass-through cases (input returned unchanged) ---

  describe('invalid / empty input is returned unchanged', () => {
    it('returns empty string unchanged', () => {
      expect(formatJson('')).toBe('');
    });

    it('returns whitespace-only string unchanged', () => {
      expect(formatJson('   \n  ')).toBe('   \n  ');
    });

    it('returns plain text unchanged', () => {
      expect(formatJson('hello world')).toBe('hello world');
    });

    it('returns trailing-comma JSON unchanged', () => {
      const bad = '{"a":1,}';
      expect(formatJson(bad)).toBe(bad);
    });

    it('returns single-quoted JSON unchanged', () => {
      const bad = "{'key':'value'}";
      expect(formatJson(bad)).toBe(bad);
    });

    it('returns truncated JSON unchanged', () => {
      const bad = '{"key": "val';
      expect(formatJson(bad)).toBe(bad);
    });

    it('returns XML unchanged', () => {
      const xml = '<root><item/></root>';
      expect(formatJson(xml)).toBe(xml);
    });
  });

  // --- formatting: objects ---

  describe('formats valid JSON objects', () => {
    it('pretty-prints a flat object', () => {
      expect(formatJson('{"a":1,"b":"two"}')).toBe(
        '{\n  "a": 1,\n  "b": "two"\n}',
      );
    });

    it('pretty-prints a nested object', () => {
      const input = '{"outer":{"inner":42}}';
      const expected = '{\n  "outer": {\n    "inner": 42\n  }\n}';
      expect(formatJson(input)).toBe(expected);
    });

    it('uses 2-space indentation', () => {
      const result = formatJson('{"x":1}');
      expect(result).toMatch(/^{\n {2}"/);
    });

    it('is idempotent (formatting already-formatted JSON returns the same string)', () => {
      const formatted = JSON.stringify({ a: 1, b: [2, 3] }, null, 2);
      expect(formatJson(formatted)).toBe(formatted);
    });
  });

  // --- formatting: arrays ---

  describe('formats valid JSON arrays', () => {
    it('pretty-prints a flat array', () => {
      expect(formatJson('[1,2,3]')).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('pretty-prints an array of objects', () => {
      const input = '[{"id":1},{"id":2}]';
      const expected = '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]';
      expect(formatJson(input)).toBe(expected);
    });

    it('handles an empty array', () => {
      expect(formatJson('[]')).toBe('[]');
    });
  });

  // --- primitive JSON values ---

  describe('handles JSON primitives', () => {
    it('formats a JSON string primitive', () => {
      expect(formatJson('"hello"')).toBe('"hello"');
    });

    it('formats a JSON number', () => {
      expect(formatJson('42')).toBe('42');
    });

    it('formats JSON true / false / null', () => {
      expect(formatJson('true')).toBe('true');
      expect(formatJson('false')).toBe('false');
      expect(formatJson('null')).toBe('null');
    });
  });

  // --- whitespace normalisation ---

  describe('normalises whitespace in valid JSON', () => {
    it('collapses excess spaces around colons', () => {
      const result = formatJson('{ "key"  :  "value" }');
      expect(result).toBe('{\n  "key": "value"\n}');
    });

    it('strips CRLF inside a valid JSON body', () => {
      const input = '{\r\n"a":1\r\n}';
      expect(formatJson(input)).toBe('{\n  "a": 1\n}');
    });
  });

  // --- special values ---

  describe('handles special JSON values', () => {
    it('preserves unicode characters', () => {
      const input = '{"emoji":"🚀","cjk":"日本語"}';
      const result = formatJson(input);
      expect(result).toContain('"emoji": "🚀"');
      expect(result).toContain('"cjk": "日本語"');
    });

    it('handles deeply nested structures', () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      const input = JSON.stringify(deep);
      const result = formatJson(input);
      expect(result).toBe(JSON.stringify(deep, null, 2));
    });

    it('handles an empty object', () => {
      expect(formatJson('{}')).toBe('{}');
    });

    it('handles numeric string that is not JSON', () => {
      // bare unquoted identifier is not valid JSON
      const bad = 'NaN';
      expect(formatJson(bad)).toBe(bad);
    });
  });
});
