/**
 * Pure utility functions shared by CodeEditor and BodyEditor.
 * Kept separate so they can be unit-tested without a DOM environment.
 */

/** Themes whose background (--input-bg) is light-coloured. */
export const LIGHT_THEMES = new Set(['light', 'ocean', 'earth', 'candy']);

/** Returns true when the given theme name uses a light editor background. */
export function isLightTheme(theme: string): boolean {
  return LIGHT_THEMES.has(theme);
}

/**
 * Pretty-print a JSON string with 2-space indentation.
 * Returns the original string unchanged if it is not valid JSON,
 * or is empty / whitespace-only.
 */
export function formatJson(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export interface JsonValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a JSON string, substituting any `<<variable>>` template tokens
 * with placeholder values so they don't produce false-positive errors.
 */
export function validateJson(raw: string): JsonValidationResult {
  if (!raw || !raw.trim()) return { valid: false, error: 'Body is empty' };
  // Replace already-quoted variables: "<<var>>" → "__var__"
  let sanitized = raw.replace(/"<<[^>]+>>"/g, '"__var__"');
  // Replace bare (unquoted) variables: <<var>> → "__var__"
  sanitized = sanitized.replace(/<<[^>]+>>/g, '"__var__"');
  try {
    JSON.parse(sanitized);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof SyntaxError ? e.message : 'Invalid JSON',
    };
  }
}
