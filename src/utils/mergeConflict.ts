/**
 * Merge conflict parser and diff utilities.
 *
 * Provides helpers to:
 *  – Parse conflict markers from a working-copy file
 *  – Compute a simple line-level diff between two texts
 *  – Generate an initial merged result from base/ours/theirs
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Represents a single conflict hunk inside a file */
export interface ConflictHunk {
  /** 0-based start line index in the original (merged) file */
  startLine: number;
  /** 0-based end line index (exclusive) */
  endLine: number;
  /** Lines from our side */
  oursLines: string[];
  /** Lines from their side */
  theirsLines: string[];
  /** Lines from the common ancestor (if available from diff3 markers) */
  baseLines: string[];
}

export type DiffLineType = 'same' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  type: DiffLineType;
  /** Line number in the left side (1-based). null if the line only exists on right side. */
  leftLineNo: number | null;
  /** Line number in the right side (1-based). null if the line only exists on left side. */
  rightLineNo: number | null;
  /** Text of the left line (undefined for 'added' lines) */
  leftText?: string;
  /** Text of the right line (undefined for 'removed' lines) */
  rightText?: string;
}

// ── Conflict Parsing ────────────────────────────────────────────────────────

const MARKER_OURS = /^<{7}\s/;
const MARKER_BASE = /^\|{7}\s/;
const MARKER_SEPARATOR = /^={7}$/;
const MARKER_THEIRS = /^>{7}\s/;

/**
 * Parse a file content string that contains Git conflict markers and return
 * the list of conflict hunks.
 */
export function parseConflictMarkers(content: string): ConflictHunk[] {
  const lines = content.split('\n');
  const hunks: ConflictHunk[] = [];
  let i = 0;

  while (i < lines.length) {
    if (MARKER_OURS.test(lines[i])) {
      const startLine = i;
      const oursLines: string[] = [];
      const baseLines: string[] = [];
      const theirsLines: string[] = [];
      let section: 'ours' | 'base' | 'theirs' = 'ours';
      i++;

      while (i < lines.length) {
        if (MARKER_BASE.test(lines[i])) {
          section = 'base';
          i++;
          continue;
        }
        if (MARKER_SEPARATOR.test(lines[i])) {
          section = 'theirs';
          i++;
          continue;
        }
        if (MARKER_THEIRS.test(lines[i])) {
          // End of conflict block
          hunks.push({
            startLine,
            endLine: i + 1,
            oursLines,
            theirsLines,
            baseLines,
          });
          i++;
          break;
        }

        if (section === 'ours') oursLines.push(lines[i]);
        else if (section === 'base') baseLines.push(lines[i]);
        else theirsLines.push(lines[i]);
        i++;
      }
    } else {
      i++;
    }
  }

  return hunks;
}

/**
 * Check if a string contains Git conflict markers.
 */
export function hasConflictMarkers(content: string): boolean {
  return MARKER_OURS.test(content);
}

// ── Line-Level Diff ─────────────────────────────────────────────────────────

/**
 * Simple line-level diff between two texts.
 * Uses a basic LCS (Longest Common Subsequence) approach.
 */
export function computeLineDiff(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');

  // Build LCS table
  const m = leftLines.length;
  const n = rightLines.length;

  // For very large files, use a simplified approach to avoid memory issues
  if (m * n > 1_000_000) {
    return computeSimpleDiff(leftLines, rightLines);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      stack.push({
        type: 'same',
        leftLineNo: i,
        rightLineNo: j,
        leftText: leftLines[i - 1],
        rightText: rightLines[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: 'added',
        leftLineNo: null,
        rightLineNo: j,
        rightText: rightLines[j - 1],
      });
      j--;
    } else {
      stack.push({
        type: 'removed',
        leftLineNo: i,
        rightLineNo: null,
        leftText: leftLines[i - 1],
      });
      i--;
    }
  }

  // Reverse to get proper order
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]);
  }

  return result;
}

/**
 * Simplified diff for very large files — line-by-line comparison only.
 */
function computeSimpleDiff(leftLines: string[], rightLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLen; i++) {
    const leftLine = i < leftLines.length ? leftLines[i] : undefined;
    const rightLine = i < rightLines.length ? rightLines[i] : undefined;

    if (leftLine !== undefined && rightLine !== undefined) {
      if (leftLine === rightLine) {
        result.push({
          type: 'same',
          leftLineNo: i + 1,
          rightLineNo: i + 1,
          leftText: leftLine,
          rightText: rightLine,
        });
      } else {
        result.push({
          type: 'modified',
          leftLineNo: i + 1,
          rightLineNo: i + 1,
          leftText: leftLine,
          rightText: rightLine,
        });
      }
    } else if (leftLine !== undefined) {
      result.push({
        type: 'removed',
        leftLineNo: i + 1,
        rightLineNo: null,
        leftText: leftLine,
      });
    } else if (rightLine !== undefined) {
      result.push({
        type: 'added',
        leftLineNo: null,
        rightLineNo: i + 1,
        rightText: rightLine,
      });
    }
  }

  return result;
}

/**
 * Strip all Git conflict markers from a file and return just the "ours" version,
 * useful as a starting point for manual editing.
 */
export function stripConflictMarkersToOurs(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skip = false;

  for (const line of lines) {
    if (MARKER_OURS.test(line)) {
      // Start of ours section — include lines after this
      skip = false;
      continue;
    }
    if (MARKER_BASE.test(line)) {
      // Base section — skip until separator or theirs marker
      skip = true;
      continue;
    }
    if (MARKER_SEPARATOR.test(line)) {
      // Separator between ours and theirs — skip theirs lines
      skip = true;
      continue;
    }
    if (MARKER_THEIRS.test(line)) {
      // End of theirs section — stop skipping
      skip = false;
      continue;
    }

    if (!skip) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Strip all Git conflict markers and keep only "theirs" version.
 */
export function stripConflictMarkersToTheirs(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skip = true;
  let inTheirs = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (MARKER_OURS.test(line)) {
      skip = true;
      inTheirs = false;
      continue;
    }
    if (MARKER_BASE.test(line)) {
      skip = true;
      inTheirs = false;
      continue;
    }
    if (MARKER_SEPARATOR.test(line)) {
      skip = false;
      inTheirs = true;
      continue;
    }
    if (MARKER_THEIRS.test(line)) {
      skip = false;
      inTheirs = false;
      continue;
    }

    // Outside any conflict block — include unconditionally
    if (!inTheirs && !skip) {
      result.push(line);
    } else if (inTheirs && !skip) {
      result.push(line);
    } else if (!MARKER_OURS.test(line) && !skip) {
      result.push(line);
    }
  }

  return result.join('\n');
}
