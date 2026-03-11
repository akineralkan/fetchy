export interface ReleaseEntry {
  version: string;
  note: string;
  releaseName?: string;
  releaseDate?: string;
}

/**
 * Returns true if `latest` is a strictly newer semver than `current`.
 * Handles an optional leading "v" on either argument.
 */
export function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

/**
 * Normalises release-notes data into a flat list of ReleaseEntry records,
 * newest first.
 *
 * Handles the three shapes that can arrive:
 *  - null / undefined / empty string → []
 *  - `{ version, note }[]` array (electron-updater multi-skip) → mapped directly
 *  - plain string → single entry (with optional intermediateReleases appended)
 */
export function parseReleaseEntries(
  releaseNotes: string | { version: string; note: string }[] | null | undefined,
  opts?: {
    version?: string;
    releaseName?: string;
    releaseDate?: string;
    intermediateReleases?: ReleaseEntry[];
  },
): ReleaseEntry[] {
  if (!releaseNotes) return [];

  if (Array.isArray(releaseNotes)) {
    return releaseNotes.map((n: any) => ({
      version: (n.version ?? '').replace(/^v/, ''),
      note: typeof n === 'string' ? n : (n.note ?? ''),
    }));
  }

  const latest: ReleaseEntry = {
    version: (opts?.version ?? '').replace(/^v/, ''),
    note: releaseNotes,
    releaseName: opts?.releaseName,
    releaseDate: opts?.releaseDate,
  };
  return opts?.intermediateReleases?.length
    ? [latest, ...opts.intermediateReleases]
    : [latest];
}
