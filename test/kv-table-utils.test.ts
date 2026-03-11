/**
 * Tests for src/utils/kvTableUtils.ts
 *
 * Covers the Key-column width calculation used by the key-value editor in
 * RequestPanel (Headers / Params tabs).  The column is sized to the longest
 * key so the Value column gets the maximum usable space.
 */
import { describe, it, expect } from 'vitest';
import {
  computeKeyColWidth,
  KV_KEY_COL_MIN_PX,
  KV_KEY_COL_MAX_PX,
  KV_CHAR_WIDTH_PX,
  KV_KEY_CELL_PADDING_PX,
} from '../src/utils/kvTableUtils';

// ─── Exported constants ───────────────────────────────────────────────────────

describe('exported constants', () => {
  it('KV_KEY_COL_MIN_PX is 80', () => {
    expect(KV_KEY_COL_MIN_PX).toBe(80);
  });

  it('KV_KEY_COL_MAX_PX is 320', () => {
    expect(KV_KEY_COL_MAX_PX).toBe(320);
  });

  it('KV_CHAR_WIDTH_PX is 7.5', () => {
    expect(KV_CHAR_WIDTH_PX).toBe(7.5);
  });

  it('KV_KEY_CELL_PADDING_PX is 16', () => {
    expect(KV_KEY_CELL_PADDING_PX).toBe(16);
  });
});

// ─── computeKeyColWidth ───────────────────────────────────────────────────────

describe('computeKeyColWidth', () => {
  // Helper: the expected raw (unclipped) width for a key of given length.
  const raw = (len: number) => len * KV_CHAR_WIDTH_PX + KV_KEY_CELL_PADDING_PX;

  describe('returns minimum when keys are very short', () => {
    it('empty array → minimum width', () => {
      expect(computeKeyColWidth([])).toBe(KV_KEY_COL_MIN_PX);
    });

    it('all empty-string keys → minimum width (floor charCount = 3)', () => {
      expect(computeKeyColWidth(['', '', ''])).toBe(KV_KEY_COL_MIN_PX);
    });

    it('single 1-char key → minimum width (raw < min)', () => {
      expect(raw(1)).toBeLessThan(KV_KEY_COL_MIN_PX);
      expect(computeKeyColWidth(['x'])).toBe(KV_KEY_COL_MIN_PX);
    });

    it('single 3-char key → minimum width (floor is 3)', () => {
      // raw(3) = 3*7.5+16 = 38.5 — still below 80, so min wins
      expect(computeKeyColWidth(['key'])).toBe(KV_KEY_COL_MIN_PX);
    });
  });

  describe('returns computed width for typical keys', () => {
    it('single key whose raw width exceeds minimum', () => {
      // 'Authorization' is 13 chars → raw = 13*7.5+16 = 113.5
      const expected = raw(13); // 113.5
      expect(computeKeyColWidth(['Authorization'])).toBe(expected);
      expect(expected).toBeGreaterThan(KV_KEY_COL_MIN_PX);
    });

    it('uses the longest key across multiple rows', () => {
      const keys = ['id', 'Authorization', 'Content-Type'];
      // 'Authorization' (13) > 'Content-Type' (12) > 'id' (2)
      expect(computeKeyColWidth(keys)).toBe(raw(13));
    });

    it('is stable when duplicates exist', () => {
      expect(computeKeyColWidth(['foo', 'foo', 'foo'])).toBe(computeKeyColWidth(['foo']));
    });
  });

  describe('returns maximum when keys are very long', () => {
    it('key with 41 chars → exactly at max', () => {
      // raw(41) = 41*7.5+16 = 323.5 → clamped to 320
      const longKey = 'x'.repeat(41);
      expect(computeKeyColWidth([longKey])).toBe(KV_KEY_COL_MAX_PX);
    });

    it('key with 100 chars → clamped to max', () => {
      expect(computeKeyColWidth(['x'.repeat(100)])).toBe(KV_KEY_COL_MAX_PX);
    });

    it('mix of short and very long keys → max', () => {
      expect(computeKeyColWidth(['a', 'x'.repeat(50), 'short'])).toBe(KV_KEY_COL_MAX_PX);
    });
  });

  describe('boundary: raw width that lands exactly on min and max', () => {
    it('raw width exactly equal to min returns min', () => {
      // Solve: len*7.5+16 = 80  →  len ≈ 8.53 → not an integer, test floor instead
      // Use a key length where raw > 80: len=9 → raw=83.5
      const nineCharKey = 'x'.repeat(9);
      expect(computeKeyColWidth([nineCharKey])).toBe(raw(9));
      expect(raw(9)).toBeGreaterThan(KV_KEY_COL_MIN_PX);
    });

    it('result is always within [min, max] for any input', () => {
      const cases = [[], [''], ['a'], ['x'.repeat(20)], ['x'.repeat(40)], ['x'.repeat(200)]];
      for (const keys of cases) {
        const width = computeKeyColWidth(keys);
        expect(width).toBeGreaterThanOrEqual(KV_KEY_COL_MIN_PX);
        expect(width).toBeLessThanOrEqual(KV_KEY_COL_MAX_PX);
      }
    });
  });
});
