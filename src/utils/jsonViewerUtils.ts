/**
 * Pure utility functions extracted from JSONViewer.tsx so they can be unit-tested
 * in a Node environment without a DOM or React renderer.
 */

/** Maximum characters to display for a single string value in the tree. */
export const STRING_TRUNCATE_MAX = 500;

/**
 * String representation of Number.MAX_SAFE_INTEGER (9007199254740991).
 * Used for string-comparison-based overflow detection without BigInt.
 */
const MAX_SAFE_DIGITS = '9007199254740991'; // 16 digits

/**
 * Matches either a quoted JSON string literal (group 1 undefined) OR a bare
 * integer token (captured in group 1).  The negative lookahead prevents
 * matching the integer part of a float like 1.5 or 2e10.
 */
const LARGE_INT_RE = /"(?:[^"\\]|\\.)*"|(-?\d+)(?![.eE\d])/g;

/**
 * Returns true when `value` is a digit-only string (optionally negative)
 * whose absolute value exceeds Number.MAX_SAFE_INTEGER.  Such strings are
 * produced by `parseJsonSafely` to avoid IEEE-754 precision loss.
 */
export function isLargeIntegerString(value: string): boolean {
  if (!/^-?\d+$/.test(value)) return false;
  const digits = value.startsWith('-') ? value.slice(1) : value;
  return (
    digits.length > MAX_SAFE_DIGITS.length ||
    (digits.length === MAX_SAFE_DIGITS.length && digits > MAX_SAFE_DIGITS)
  );
}

/**
 * Pre-processes raw JSON text so that integer literals whose absolute value
 * exceeds Number.MAX_SAFE_INTEGER are converted to JSON string literals before
 * `JSON.parse` runs.  This prevents the silent rounding that IEEE-754 doubles
 * impose on 64-bit IDs and similar large numbers.
 *
 * Quoted strings in the source are matched and skipped unchanged, so numbers
 * that happen to appear inside existing string values are never touched.
 */
function preserveLargeIntegers(text: string): string {
  // Reset lastIndex because the regex is stateful (flag `g`).
  LARGE_INT_RE.lastIndex = 0;
  return text.replace(LARGE_INT_RE, (match, number?: string) => {
    if (number === undefined) return match; // matched a quoted string – leave it alone
    const digits = number.startsWith('-') ? number.slice(1) : number;
    if (
      digits.length > MAX_SAFE_DIGITS.length ||
      (digits.length === MAX_SAFE_DIGITS.length && digits > MAX_SAFE_DIGITS)
    ) {
      return `"${number}"`;
    }
    return match;
  });
}

/**
 * Attempt to parse a JSON string.
 * Large integers (beyond Number.MAX_SAFE_INTEGER) are preserved as strings so
 * they can be displayed and copied with full precision.
 * Returns the parsed value on success, or `null` on any parse error.
 */
export function parseJsonSafely(data: string): unknown {
  try {
    return JSON.parse(preserveLargeIntegers(data));
  } catch {
    return null;
  }
}

/**
 * Truncates a string value for display in the JSON tree.
 * Strings longer than `maxLength` are cut and suffixed with "...".
 */
export function truncateJsonString(value: string, maxLength = STRING_TRUNCATE_MAX): string {
  return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}
