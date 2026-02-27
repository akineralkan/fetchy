const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// This script can be run standalone to set the icon on an already-built exe.
// For build-time icon setting, see after-pack.js (used by electron-builder's afterPack hook).

const logFile = path.join(__dirname, '..', 'set-icon.log');
const log = (msg) => {
  fs.appendFileSync(logFile, msg + '\n');
  console.log(msg);
};

// Clear log file
fs.writeFileSync(logFile, '');

const exePath = path.join(__dirname, '..', 'release', 'win-unpacked', 'Fetchy.exe');
const iconPath = path.join(__dirname, '..', 'build', 'icons', 'win', 'icon.ico');
const rceditBin = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

log('Starting set-icon script...');
log('Exe path: ' + exePath);
log('Icon path: ' + iconPath);
log('rcedit binary: ' + rceditBin);

// Check if files exist
if (!fs.existsSync(exePath)) {
  log('Executable not found: ' + exePath);
  process.exit(0);
}

if (!fs.existsSync(iconPath)) {
  log('Icon not found: ' + iconPath);
  process.exit(1);
}

if (!fs.existsSync(rceditBin)) {
  log('rcedit binary not found: ' + rceditBin);
  process.exit(1);
}

log('All files exist, running rcedit...');

try {
  const cmd = `"${rceditBin}" "${exePath}" --set-icon "${iconPath}"`;
  log('Command: ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
  log('Icon set successfully!');
} catch (err) {
  log('Error: ' + err.message);
  process.exit(1);
}


