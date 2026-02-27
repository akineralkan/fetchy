const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * electron-builder afterPack hook.
 * Runs AFTER the app is packaged into win-unpacked but BEFORE the NSIS installer is created.
 * This ensures the custom icon is embedded in the .exe that gets bundled into the installer.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, productFilename + '.exe');
  const iconPath = path.join(__dirname, '..', 'build', 'icons', 'win', 'icon.ico');
  const rceditBin = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

  console.log('[after-pack] Setting custom icon on executable...');
  console.log('[after-pack] Exe:', exePath);
  console.log('[after-pack] Icon:', iconPath);

  if (!fs.existsSync(exePath)) {
    console.error('[after-pack] Executable not found:', exePath);
    return;
  }

  if (!fs.existsSync(iconPath)) {
    console.error('[after-pack] Icon file not found:', iconPath);
    return;
  }

  if (!fs.existsSync(rceditBin)) {
    console.error('[after-pack] rcedit binary not found:', rceditBin);
    return;
  }

  try {
    execSync('"' + rceditBin + '" "' + exePath + '" --set-icon "' + iconPath + '"', { stdio: 'inherit' });
    console.log('[after-pack] Custom icon set successfully!');
  } catch (err) {
    console.error('[after-pack] Failed to set icon:', err.message);
  }
};
