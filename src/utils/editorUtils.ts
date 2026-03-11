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
