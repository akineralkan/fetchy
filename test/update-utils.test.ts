/**
 * Tests for src/utils/updateUtils.ts
 *
 * Covers:
 *  - compareVersions  — determines whether a newer release is available
 *  - parseReleaseEntries — normalises the various release-notes shapes from
 *    electron-updater and the GitHub Releases API into a flat ReleaseEntry list
 */
import { describe, it, expect } from 'vitest';
import { compareVersions, parseReleaseEntries } from '../src/utils/updateUtils';

// ─── compareVersions ─────────────────────────────────────────────────────────

describe('compareVersions', () => {
  // --- newer ---
  it('returns true when latest has a newer patch version', () => {
    expect(compareVersions('1.5.33', '1.5.34')).toBe(true);
  });

  it('returns true when latest has a newer minor version', () => {
    expect(compareVersions('1.4.9', '1.5.0')).toBe(true);
  });

  it('returns true when latest has a newer major version', () => {
    expect(compareVersions('1.9.9', '2.0.0')).toBe(true);
  });

  it('returns true for a large multi-version skip (e.g. v3 → v6)', () => {
    expect(compareVersions('1.5.3', '1.5.38')).toBe(true);
  });

  // --- not newer ---
  it('returns false when versions are identical', () => {
    expect(compareVersions('1.5.33', '1.5.33')).toBe(false);
  });

  it('returns false when current is a newer patch', () => {
    expect(compareVersions('1.5.34', '1.5.33')).toBe(false);
  });

  it('returns false when current is a newer minor', () => {
    expect(compareVersions('1.6.0', '1.5.9')).toBe(false);
  });

  // --- v-prefix handling ---
  it('strips leading "v" from both arguments', () => {
    expect(compareVersions('v1.5.33', 'v1.5.34')).toBe(true);
    expect(compareVersions('v1.5.33', 'v1.5.33')).toBe(false);
  });

  it('handles mixed prefix (one with v, one without)', () => {
    expect(compareVersions('1.5.33', 'v1.5.34')).toBe(true);
    expect(compareVersions('v1.5.34', '1.5.33')).toBe(false);
  });

  // --- segment count edge cases ---
  it('treats a missing segment as 0 (1.5 vs 1.5.1 → newer)', () => {
    expect(compareVersions('1.5', '1.5.1')).toBe(true);
  });

  it('treats a missing segment as 0 (1.5.1 vs 1.5 → not newer)', () => {
    expect(compareVersions('1.5.1', '1.5')).toBe(false);
  });
});

// ─── parseReleaseEntries ──────────────────────────────────────────────────────

describe('parseReleaseEntries', () => {

  // --- null / empty input ---

  describe('when releaseNotes is absent', () => {
    it('returns [] for null', () => {
      expect(parseReleaseEntries(null)).toEqual([]);
    });

    it('returns [] for undefined', () => {
      expect(parseReleaseEntries(undefined)).toEqual([]);
    });

    it('returns [] for an empty string', () => {
      expect(parseReleaseEntries('')).toEqual([]);
    });
  });

  // --- plain string (single-version update) ---

  describe('when releaseNotes is a plain string', () => {
    it('returns a single entry with the note and stripped version', () => {
      const result = parseReleaseEntries('Bug fixes and performance improvements', {
        version: '1.5.34',
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        version: '1.5.34',
        note: 'Bug fixes and performance improvements',
      });
    });

    it('strips a leading "v" from the version option', () => {
      const result = parseReleaseEntries('Some note', { version: 'v1.5.34' });
      expect(result[0].version).toBe('1.5.34');
    });

    it('includes releaseName when provided', () => {
      const result = parseReleaseEntries('note', {
        version: '1.5.34',
        releaseName: 'Summer Drop',
      });
      expect(result[0].releaseName).toBe('Summer Drop');
    });

    it('includes releaseDate when provided', () => {
      const result = parseReleaseEntries('note', {
        version: '1.5.34',
        releaseDate: '2026-03-11T00:00:00Z',
      });
      expect(result[0].releaseDate).toBe('2026-03-11T00:00:00Z');
    });

    it('uses empty string for version when opts is omitted', () => {
      const result = parseReleaseEntries('standalone note');
      expect(result[0].version).toBe('');
      expect(result[0].note).toBe('standalone note');
    });
  });

  // --- string + intermediateReleases (browser dev mode multi-version) ---

  describe('when releaseNotes is a string with intermediateReleases', () => {
    const intermediates = [
      { version: '1.5.32', note: 'v32 fixes' },
      { version: '1.5.31', note: 'v31 fixes' },
    ];

    it('prepends the latest entry before the intermediates', () => {
      const result = parseReleaseEntries('v34 changes', {
        version: '1.5.34',
        intermediateReleases: intermediates,
      });
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ version: '1.5.34', note: 'v34 changes' });
      expect(result[1]).toMatchObject({ version: '1.5.32', note: 'v32 fixes' });
      expect(result[2]).toMatchObject({ version: '1.5.31', note: 'v31 fixes' });
    });

    it('returns only the latest entry when intermediateReleases is empty', () => {
      const result = parseReleaseEntries('v34 changes', {
        version: '1.5.34',
        intermediateReleases: [],
      });
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('1.5.34');
    });
  });

  // --- { version, note }[] array (electron-updater multi-skip format) ---

  describe('when releaseNotes is an array (electron-updater format)', () => {
    it('maps the array to ReleaseEntry[], newest first', () => {
      const raw = [
        { version: 'v1.5.38', note: '## v38 changes\n- Added X' },
        { version: 'v1.5.37', note: '## v37 changes\n- Fixed Y' },
        { version: 'v1.5.36', note: '## v36 changes\n- Improved Z' },
      ];
      const result = parseReleaseEntries(raw);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ version: '1.5.38', note: '## v38 changes\n- Added X' });
      expect(result[1]).toMatchObject({ version: '1.5.37', note: '## v37 changes\n- Fixed Y' });
      expect(result[2]).toMatchObject({ version: '1.5.36', note: '## v36 changes\n- Improved Z' });
    });

    it('strips leading "v" from every version in the array', () => {
      const raw = [{ version: 'v2.0.0', note: 'major release' }];
      expect(parseReleaseEntries(raw)[0].version).toBe('2.0.0');
    });

    it('handles a single-element array', () => {
      const raw = [{ version: '1.5.34', note: 'one release' }];
      const result = parseReleaseEntries(raw);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ version: '1.5.34', note: 'one release' });
    });

    it('uses empty string for note when note is missing', () => {
      const raw = [{ version: '1.5.34' }] as any;
      expect(parseReleaseEntries(raw)[0].note).toBe('');
    });

    it('uses empty string for version when version is missing', () => {
      const raw = [{ note: 'orphan note' }] as any;
      expect(parseReleaseEntries(raw)[0].version).toBe('');
    });

    it('handles plain-string array elements (graceful fallback)', () => {
      // electron-updater occasionally returns bare strings in older versions
      const raw = ['plain note one', 'plain note two'] as any;
      const result = parseReleaseEntries(raw);
      expect(result[0].note).toBe('plain note one');
      expect(result[0].version).toBe('');
      expect(result[1].note).toBe('plain note two');
    });
  });
});
