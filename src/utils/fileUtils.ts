/**
 * Pure utility helpers for file handling across the import UI.
 *
 * Keeping these as standalone functions makes them easy to unit-test without a
 * DOM or React environment, and avoids duplicating the acceptance logic between
 * the <input> file picker and the drag-and-drop handler.
 */

/**
 * Returns `true` when `fileName` ends with at least one of the extensions
 * listed in `accept`.
 *
 * `accept` mirrors the HTML `<input accept="...">` format: a comma-separated
 * list of file extensions (e.g. `".json,.yaml,.yml"`) or MIME types.
 * MIME-type entries (those that do not start with ".") are ignored here
 * because drag-and-drop validation uses the file name, not the MIME type.
 *
 * @example
 * isFileTypeAccepted('spec.yaml', '.json,.yaml,.yml') // true
 * isFileTypeAccepted('image.png', '.json,.yaml,.yml') // false
 */
export function isFileTypeAccepted(fileName: string, accept: string): boolean {
  if (!fileName || !accept) return false;

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const ext = fileName.slice(dotIndex).toLowerCase();

  const accepted = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.startsWith('.')); // ignore MIME types

  return accepted.includes(ext);
}

/**
 * Extracts the first dropped file from a DataTransfer-like object.
 * Returns `null` when the transfer carries no files.
 *
 * Accepting a structural subtype (`Pick<DataTransfer, 'files'>`) rather than
 * the full `DataTransfer` makes the function easy to call in tests with a
 * plain object.
 */
export function getFirstDroppedFile(
  dataTransfer: Pick<DataTransfer, 'files'>
): File | null {
  return dataTransfer.files?.[0] ?? null;
}
