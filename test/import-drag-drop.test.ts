/**
 * Tests for the drag-and-drop file-handling utilities introduced in
 * ImportModal.tsx (Feature: drag & drop onto the file upload zone).
 *
 * All helpers live in src/utils/fileUtils.ts so they can be exercised in the
 * pure-Node Vitest environment without a DOM or React tree.
 */
import { describe, it, expect } from 'vitest';
import { isFileTypeAccepted, getFirstDroppedFile } from '../src/utils/fileUtils';

// ---------------------------------------------------------------------------
// isFileTypeAccepted
// ---------------------------------------------------------------------------

describe('isFileTypeAccepted', () => {
  // ── JSON import sources ────────────────────────────────────────────────
  describe('JSON-only sources (Postman / Hoppscotch / Postman-env / Hoppscotch-env)', () => {
    const accept = '.json';

    it('accepts a .json file', () => {
      expect(isFileTypeAccepted('collection.json', accept)).toBe(true);
    });

    it('rejects a .yaml file', () => {
      expect(isFileTypeAccepted('spec.yaml', accept)).toBe(false);
    });

    it('rejects a .bru file', () => {
      expect(isFileTypeAccepted('env.bru', accept)).toBe(false);
    });

    it('rejects a plain text file', () => {
      expect(isFileTypeAccepted('readme.txt', accept)).toBe(false);
    });

    it('is case-insensitive for the extension', () => {
      expect(isFileTypeAccepted('COLLECTION.JSON', accept)).toBe(true);
    });
  });

  // ── OpenAPI sources (.json / .yaml / .yml) ────────────────────────────
  describe('OpenAPI sources (.json,.yaml,.yml)', () => {
    const accept = '.json,.yaml,.yml';

    it('accepts a .json file', () => {
      expect(isFileTypeAccepted('openapi.json', accept)).toBe(true);
    });

    it('accepts a .yaml file', () => {
      expect(isFileTypeAccepted('openapi.yaml', accept)).toBe(true);
    });

    it('accepts a .yml file', () => {
      expect(isFileTypeAccepted('openapi.yml', accept)).toBe(true);
    });

    it('rejects a .bru file', () => {
      expect(isFileTypeAccepted('request.bru', accept)).toBe(false);
    });

    it('rejects a .xml file', () => {
      expect(isFileTypeAccepted('schema.xml', accept)).toBe(false);
    });

    it('handles extra spaces around the comma-separated extensions', () => {
      expect(isFileTypeAccepted('api.yml', ' .json , .yaml , .yml ')).toBe(true);
    });
  });

  // ── Bruno sources (.json / .bru) ──────────────────────────────────────
  describe('Bruno sources (.json,.bru)', () => {
    const accept = '.json,.bru';

    it('accepts a .json file', () => {
      expect(isFileTypeAccepted('collection.json', accept)).toBe(true);
    });

    it('accepts a .bru file', () => {
      expect(isFileTypeAccepted('request.bru', accept)).toBe(true);
    });

    it('rejects a .yaml file', () => {
      expect(isFileTypeAccepted('spec.yaml', accept)).toBe(false);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('returns false for an empty file name', () => {
      expect(isFileTypeAccepted('', '.json')).toBe(false);
    });

    it('returns false for an empty accept string', () => {
      expect(isFileTypeAccepted('file.json', '')).toBe(false);
    });

    it('returns false for a file name with no extension', () => {
      expect(isFileTypeAccepted('Makefile', '.json')).toBe(false);
    });

    it('ignores MIME-type entries in the accept string', () => {
      // MIME types don't start with '.' so they are skipped;
      // the file should still be rejected.
      expect(isFileTypeAccepted('image.png', 'application/json')).toBe(false);
    });

    it('correctly handles dotfiles (hidden files) with no real extension', () => {
      // ".gitignore" — the leading dot is the whole extension segment,
      // not a known import type.
      expect(isFileTypeAccepted('.gitignore', '.json')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getFirstDroppedFile
// ---------------------------------------------------------------------------

describe('getFirstDroppedFile', () => {
  /**
   * Minimal File-like object sufficient for the tests.
   * The Node test environment has no DOM global, so we use a plain object
   * satisfying the structural contract of `File` (`name` property).
   */
  const makeFile = (name: string) => ({ name } as File);

  it('returns the first file from a populated files list', () => {
    const file = makeFile('collection.json');
    const dataTransfer = { files: [file] as unknown as FileList };

    expect(getFirstDroppedFile(dataTransfer)).toBe(file);
  });

  it('returns the first file when multiple files are dragged', () => {
    const first = makeFile('first.json');
    const second = makeFile('second.json');
    const dataTransfer = { files: [first, second] as unknown as FileList };

    expect(getFirstDroppedFile(dataTransfer)).toBe(first);
  });

  it('returns null when the files list is empty', () => {
    const dataTransfer = { files: [] as unknown as FileList };

    expect(getFirstDroppedFile(dataTransfer)).toBeNull();
  });

  it('returns null when files is undefined', () => {
    const dataTransfer = { files: undefined as unknown as FileList };

    expect(getFirstDroppedFile(dataTransfer)).toBeNull();
  });
});
