const fs = require('fs');
const path = require('path');

/**
 * Move electron-builder update manifests after the build has completely
 * finished. `afterAllArtifactBuild` runs before electron-builder writes
 * latest.yml/latest-mac.yml, so those files cannot be moved reliably from
 * the hook in scripts/organize-release.js.
 */
function finalizeRelease(outDir = path.resolve(__dirname, '..', 'release')) {
  const extrasDir = path.join(outDir, '_extras');
  fs.mkdirSync(extrasDir, { recursive: true });

  for (const manifest of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
    const source = path.join(outDir, manifest);
    if (!fs.existsSync(source)) continue;

    const destination = path.join(extrasDir, manifest);
    try {
      fs.rmSync(destination, { force: true });
      fs.renameSync(source, destination);
      console.log(`[finalize-release] Moved ${manifest} -> _extras/`);
    } catch (error) {
      console.error(`[finalize-release] Failed to move ${manifest}:`, error.message);
      throw error;
    }
  }
}

if (require.main === module) {
  finalizeRelease();
}

module.exports = finalizeRelease;
