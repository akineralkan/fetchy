const fs = require('fs');
const path = require('path');

/**
 * electron-builder `afterAllArtifactBuild` hook.
 *
 * Runs once, after every artifact for every configured target/arch has been
 * built. The `release/` folder used to accumulate every single build
 * artifact (installers, zips, blockmaps, update manifests, unpacked app
 * staging folders, debug logs) across every version ever built locally,
 * making it look cluttered and confusing.
 *
 * This keeps `release/` containing ONLY the installer files a user actually
 * downloads and runs:
 *   - Windows: *.exe
 *   - macOS:   *.dmg
 *
 * Everything else that electron-builder produces (zip archives, .blockmap
 * delta files, latest.yml / latest-mac.yml auto-update manifests) is moved
 * into `release/_extras/` instead — still on disk, still uploaded as
 * GitHub Release assets by CI (see .github/workflows/release-windows.yml
 * and release-mac.yml, which read from this new location), just out of the
 * way for local browsing. Nothing about the auto-update flow changes: the
 * files themselves are untouched, only their folder changed, and CI is
 * updated to upload them from their new location alongside the exe/dmg.
 *
 * The unpacked app staging directories (`mac/`, `mac-arm64/`, `win-unpacked/`)
 * are intermediate build output with no purpose after packaging, so they're
 * deleted outright rather than moved, to save disk space.
 */
module.exports = async function organizeRelease(context) {
  const outDir = context.outDir;
  const extrasDir = path.join(outDir, '_extras');

  if (!fs.existsSync(extrasDir)) {
    fs.mkdirSync(extrasDir, { recursive: true });
  }

  const KEEP_IN_ROOT = ['.exe', '.dmg'];

  const updatedPaths = [];

  for (const artifactPath of context.artifactPaths || []) {
    const ext = path.extname(artifactPath).toLowerCase();
    // Artifact paths can have compound extensions like ".dmg.blockmap" —
    // extname() only returns ".blockmap" for those, which is correct: we
    // want blockmaps moved regardless of what they're a blockmap of.
    if (KEEP_IN_ROOT.includes(ext) && !artifactPath.toLowerCase().endsWith('.blockmap')) {
      updatedPaths.push(artifactPath);
      continue;
    }

    if (!fs.existsSync(artifactPath)) {
      updatedPaths.push(artifactPath);
      continue;
    }

    const dest = path.join(extrasDir, path.basename(artifactPath));
    try {
      fs.renameSync(artifactPath, dest);
      updatedPaths.push(dest);
      console.log(`[organize-release] Moved ${path.basename(artifactPath)} -> _extras/`);
    } catch (err) {
      console.error(`[organize-release] Failed to move ${artifactPath}:`, err.message);
      updatedPaths.push(artifactPath);
    }
  }

  // Move the auto-update manifests too (latest.yml / latest-mac.yml). These
  // aren't part of context.artifactPaths — electron-builder writes them to
  // outDir directly.
  for (const manifest of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
    const src = path.join(outDir, manifest);
    if (fs.existsSync(src)) {
      const dest = path.join(extrasDir, manifest);
      try {
        fs.renameSync(src, dest);
        console.log(`[organize-release] Moved ${manifest} -> _extras/`);
      } catch (err) {
        console.error(`[organize-release] Failed to move ${manifest}:`, err.message);
      }
    }
  }

  // Delete unpacked app staging directories — intermediate build output,
  // not needed after the installer/archive has been produced.
  for (const staging of ['mac', 'mac-arm64', 'win-unpacked', 'linux-unpacked']) {
    const dir = path.join(outDir, staging);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[organize-release] Removed staging dir ${staging}/`);
      } catch (err) {
        console.error(`[organize-release] Failed to remove ${dir}:`, err.message);
      }
    }
  }

  // Tidy up electron-builder's own debug log too.
  const debugLog = path.join(outDir, 'builder-debug.yml');
  if (fs.existsSync(debugLog)) {
    try {
      fs.renameSync(debugLog, path.join(extrasDir, 'builder-debug.yml'));
    } catch {
      // Non-critical, ignore.
    }
  }

  return updatedPaths;
};
