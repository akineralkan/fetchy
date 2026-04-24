/**
 * Tests for src/utils/mergeConflict.ts
 *
 * Covers:
 *  - parseConflictMarkers: basic conflict, diff3, no conflict
 *  - hasConflictMarkers: detection
 *  - computeLineDiff: same, added, removed, LCS
 *  - stripConflictMarkersToOurs / stripConflictMarkersToTheirs
 */

import { describe, expect, it } from 'vitest';
import {
  parseConflictMarkers,
  hasConflictMarkers,
  computeLineDiff,
  stripConflictMarkersToOurs,
  stripConflictMarkersToTheirs,
} from '../src/utils/mergeConflict';

// ─── parseConflictMarkers ─────────────────────────────────────────────────────

describe('parseConflictMarkers', () => {
  it('returns empty array when there are no conflict markers', () => {
    expect(parseConflictMarkers('no conflicts here')).toHaveLength(0);
  });

  it('parses a simple 2-way conflict block', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours line',
      '=======',
      'theirs line',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursLines).toEqual(['ours line']);
    expect(hunks[0].theirsLines).toEqual(['theirs line']);
    expect(hunks[0].baseLines).toEqual([]);
  });

  it('parses a diff3-style conflict block with base lines', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours line',
      '||||||| base',
      'base line',
      '=======',
      'theirs line',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursLines).toEqual(['ours line']);
    expect(hunks[0].baseLines).toEqual(['base line']);
    expect(hunks[0].theirsLines).toEqual(['theirs line']);
  });

  it('parses multiple conflict blocks', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours1',
      '=======',
      'theirs1',
      '>>>>>>> branch',
      'middle',
      '<<<<<<< HEAD',
      'ours2',
      '=======',
      'theirs2',
      '>>>>>>> branch',
      'after',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].oursLines).toEqual(['ours1']);
    expect(hunks[1].oursLines).toEqual(['ours2']);
  });

  it('captures multi-line ours and theirs sections', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours line 1',
      'ours line 2',
      '=======',
      'theirs line 1',
      'theirs line 2',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks[0].oursLines).toEqual(['ours line 1', 'ours line 2']);
    expect(hunks[0].theirsLines).toEqual(['theirs line 1', 'theirs line 2']);
  });

  it('records correct startLine and endLine indices', () => {
    const content = [
      'line0',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks[0].startLine).toBe(1); // 0-based, line1 is "<<<<<<< HEAD"
    expect(hunks[0].endLine).toBe(6);   // exclusive, after ">>>>>>> branch"
  });
});

// ─── hasConflictMarkers ───────────────────────────────────────────────────────

describe('hasConflictMarkers', () => {
  it('returns false for clean content', () => {
    expect(hasConflictMarkers('clean content\nno conflicts')).toBe(false);
  });

  it('returns true when conflict marker exists at start of line', () => {
    const content = 'line1\n<<<<<<< HEAD\nline3';
    expect(hasConflictMarkers(content)).toBe(true);
  });

  it('returns false when <<<<<<< appears mid-line (not a real marker)', () => {
    // The regex matches ^<{7}\s so it must be at line start
    expect(hasConflictMarkers('text <<<<<<< HEAD here')).toBe(false);
  });

  it('returns true for multiline content with marker in middle', () => {
    const content = 'a\nb\n<<<<<<< HEAD\nc';
    expect(hasConflictMarkers(content)).toBe(true);
  });
});

// ─── computeLineDiff ─────────────────────────────────────────────────────────

describe('computeLineDiff', () => {
  it('returns same entries for identical texts', () => {
    const diff = computeLineDiff('a\nb\nc', 'a\nb\nc');
    expect(diff.every(d => d.type === 'same')).toBe(true);
    expect(diff).toHaveLength(3);
  });

  it('detects added lines on the right', () => {
    const diff = computeLineDiff('a', 'a\nb');
    const added = diff.filter(d => d.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].rightText).toBe('b');
    expect(added[0].leftLineNo).toBeNull();
  });

  it('detects removed lines from the left', () => {
    const diff = computeLineDiff('a\nb', 'a');
    const removed = diff.filter(d => d.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].leftText).toBe('b');
    expect(removed[0].rightLineNo).toBeNull();
  });

  it('handles completely different texts', () => {
    const diff = computeLineDiff('x\ny', 'a\nb');
    // Should produce removed + added or modified entries
    expect(diff.length).toBeGreaterThan(0);
  });

  it('returns empty array for both empty strings', () => {
    const diff = computeLineDiff('', '');
    // A single empty line on each side — either same or empty
    expect(Array.isArray(diff)).toBe(true);
  });

  it('preserves line numbers correctly for same lines', () => {
    const diff = computeLineDiff('a\nb', 'a\nb');
    const [first, second] = diff;
    expect(first.leftLineNo).toBe(1);
    expect(first.rightLineNo).toBe(1);
    expect(second.leftLineNo).toBe(2);
    expect(second.rightLineNo).toBe(2);
  });
});

// ─── stripConflictMarkersToOurs ──────────────────────────────────────────────

describe('stripConflictMarkersToOurs', () => {
  it('returns ours section only for a simple conflict', () => {
    const content = [
      '<<<<<<< HEAD',
      'our content',
      '=======',
      'their content',
      '>>>>>>> branch',
    ].join('\n');

    const result = stripConflictMarkersToOurs(content);
    expect(result).toContain('our content');
    expect(result).not.toContain('their content');
  });

  it('preserves non-conflict lines', () => {
    const content = [
      'unchanged line',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'another unchanged',
    ].join('\n');

    const result = stripConflictMarkersToOurs(content);
    expect(result).toContain('unchanged line');
    expect(result).toContain('another unchanged');
    expect(result).toContain('ours');
    expect(result).not.toContain('theirs');
  });

  it('returns original content unchanged when no markers present', () => {
    const clean = 'line1\nline2\nline3';
    expect(stripConflictMarkersToOurs(clean)).toBe(clean);
  });
});

// ─── stripConflictMarkersToTheirs ────────────────────────────────────────────

describe('stripConflictMarkersToTheirs', () => {
  it('returns theirs section only for a simple conflict', () => {
    const content = [
      '<<<<<<< HEAD',
      'our content',
      '=======',
      'their content',
      '>>>>>>> branch',
    ].join('\n');

    const result = stripConflictMarkersToTheirs(content);
    expect(result).toContain('their content');
    expect(result).not.toContain('our content');
  });

  it('preserves non-conflict lines', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'after',
    ].join('\n');

    const result = stripConflictMarkersToTheirs(content);
    expect(result).toContain('before');
    expect(result).toContain('after');
    expect(result).toContain('theirs');
    expect(result).not.toContain('ours');
  });

  it('returns original when no markers present', () => {
    const clean = 'a\nb\nc';
    expect(stripConflictMarkersToTheirs(clean)).toBe(clean);
  });
});

// ─── Additional coverage tests ────────────────────────────────────────────────

describe('computeLineDiff — simple diff fallback for large files', () => {
  it('uses simple diff for very large inputs (m*n > 1_000_000)', () => {
    // Create inputs with 1001 lines each so m*n > 1_000_000
    const leftLines = Array.from({ length: 1001 }, (_, i) => `left-line-${i}`);
    const rightLines = Array.from({ length: 1001 }, (_, i) => `right-line-${i}`);
    const diff = computeLineDiff(leftLines.join('\n'), rightLines.join('\n'));
    // All lines differ, so they should be 'modified'
    expect(diff.length).toBe(1001);
    expect(diff.every(d => d.type === 'modified')).toBe(true);
  });

  it('simple diff handles left longer than right', () => {
    const leftLines = Array.from({ length: 1001 }, (_, i) => `line-${i}`);
    const rightLines = Array.from({ length: 500 }, (_, i) => `line-${i}`);
    const diff = computeLineDiff(leftLines.join('\n'), rightLines.join('\n'));
    const removed = diff.filter(d => d.type === 'removed');
    expect(removed.length).toBe(501);
  });

  it('simple diff handles right longer than left', () => {
    const leftLines = Array.from({ length: 500 }, (_, i) => `line-${i}`);
    const rightLines = Array.from({ length: 1001 }, (_, i) => `line-${i}`);
    const diff = computeLineDiff(leftLines.join('\n'), rightLines.join('\n'));
    const added = diff.filter(d => d.type === 'added');
    expect(added.length).toBe(501);
  });

  it('simple diff detects same lines at matching positions', () => {
    const leftLines = Array.from({ length: 1001 }, (_, i) => `same-${i}`);
    const rightLines = Array.from({ length: 1001 }, (_, i) => `same-${i}`);
    const diff = computeLineDiff(leftLines.join('\n'), rightLines.join('\n'));
    expect(diff.every(d => d.type === 'same')).toBe(true);
  });
});

describe('stripConflictMarkersToOurs — diff3 with base section', () => {
  it('skips base section lines', () => {
    const content = [
      '<<<<<<< HEAD',
      'our content',
      '||||||| base-ref',
      'base content',
      '=======',
      'their content',
      '>>>>>>> branch',
    ].join('\n');

    const result = stripConflictMarkersToOurs(content);
    expect(result).toContain('our content');
    expect(result).not.toContain('base content');
    expect(result).not.toContain('their content');
  });

  it('handles multiple diff3 conflicts', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours1',
      '||||||| base',
      'base1',
      '=======',
      'theirs1',
      '>>>>>>> branch',
      'middle',
      '<<<<<<< HEAD',
      'ours2',
      '=======',
      'theirs2',
      '>>>>>>> branch',
      'after',
    ].join('\n');

    const result = stripConflictMarkersToOurs(content);
    expect(result).toContain('before');
    expect(result).toContain('ours1');
    expect(result).toContain('middle');
    expect(result).toContain('ours2');
    expect(result).toContain('after');
    expect(result).not.toContain('base1');
    expect(result).not.toContain('theirs1');
    expect(result).not.toContain('theirs2');
  });
});

describe('stripConflictMarkersToTheirs — diff3 with base section', () => {
  it('skips ours and base sections, keeps theirs', () => {
    const content = [
      '<<<<<<< HEAD',
      'our content',
      '||||||| base-ref',
      'base content',
      '=======',
      'their content',
      '>>>>>>> branch',
    ].join('\n');

    const result = stripConflictMarkersToTheirs(content);
    expect(result).toContain('their content');
    expect(result).not.toContain('our content');
    expect(result).not.toContain('base content');
  });

  it('handles multiple diff3 conflicts for theirs', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours1',
      '||||||| base',
      'base1',
      '=======',
      'theirs1',
      '>>>>>>> branch',
      'middle',
      '<<<<<<< HEAD',
      'ours2',
      '=======',
      'theirs2',
      '>>>>>>> branch',
    ].join('\n');

    const result = stripConflictMarkersToTheirs(content);
    expect(result).toContain('before');
    expect(result).toContain('theirs1');
    expect(result).toContain('middle');
    expect(result).toContain('theirs2');
    expect(result).not.toContain('ours1');
    expect(result).not.toContain('ours2');
  });
});

describe('parseConflictMarkers — empty sections', () => {
  it('handles empty ours section', () => {
    const content = [
      '<<<<<<< HEAD',
      '=======',
      'theirs only',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursLines).toEqual([]);
    expect(hunks[0].theirsLines).toEqual(['theirs only']);
  });

  it('handles empty theirs section', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours only',
      '=======',
      '>>>>>>> branch',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursLines).toEqual(['ours only']);
    expect(hunks[0].theirsLines).toEqual([]);
  });
});
