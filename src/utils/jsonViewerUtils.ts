/**
 * Pure utility functions extracted from JSONViewer.tsx so they can be unit-tested
 * in a Node environment without a DOM or React renderer.
 */

/** Maximum characters to display for a single string value in the tree. */
export const STRING_TRUNCATE_MAX = 500;

/**
 * Attempt to parse a JSON string.
 * Returns the parsed value on success, or `null` on any parse error.
 */
export function parseJsonSafely(data: string): unknown {
  try {
    return JSON.parse(data);
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
