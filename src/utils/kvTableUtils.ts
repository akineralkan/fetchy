/**
 * Utilities for the key-value editor table in RequestPanel.
 */

/** Minimum width of the Key column in pixels. */
export const KV_KEY_COL_MIN_PX = 80;
/** Maximum width of the Key column in pixels. */
export const KV_KEY_COL_MAX_PX = 320;
/** Approximate pixel width of one character at text-sm, used for column sizing. */
export const KV_CHAR_WIDTH_PX = 7.5;
/** Horizontal padding (both sides combined) inside each Key cell (p-2 = 8 px each side). */
export const KV_KEY_CELL_PADDING_PX = 16;

/**
 * Compute the pixel width for the Key column so it is just wide enough to
 * display the longest key without truncation, while leaving the rest of the
 * available width to the Value column.
 *
 * @param keys - All key strings currently in the table.
 * @returns Width in pixels, clamped to [KV_KEY_COL_MIN_PX, KV_KEY_COL_MAX_PX].
 */
export function computeKeyColWidth(keys: string[]): number {
  const longestKey = keys.reduce((max, key) => Math.max(max, key.length), 3);
  const raw = longestKey * KV_CHAR_WIDTH_PX + KV_KEY_CELL_PADDING_PX;
  return Math.min(Math.max(raw, KV_KEY_COL_MIN_PX), KV_KEY_COL_MAX_PX);
}
