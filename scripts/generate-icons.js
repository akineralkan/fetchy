const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.join(__dirname, '..', 'build', 'icon.jpg');
const BUILD_DIR = path.join(__dirname, '..', 'build');
const ICONS_DIR = path.join(BUILD_DIR, 'icons');
const PNG_DIR = path.join(ICONS_DIR, 'png');
const WIN_DIR = path.join(ICONS_DIR, 'win');
const MAC_DIR = path.join(ICONS_DIR, 'mac');

// Standard icon sizes
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function ensureDirectories() {
  const dirs = [BUILD_DIR, ICONS_DIR, PNG_DIR, WIN_DIR, MAC_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

async function generatePngIcons() {
  console.log('Generating PNG icons...');

  const { Jimp } = await import('jimp');
  const sourceImage = await Jimp.read(SOURCE_IMAGE);

  for (const size of PNG_SIZES) {
    const outputPath = path.join(PNG_DIR, `${size}x${size}.png`);
    const resized = sourceImage.clone().resize({ w: size, h: size });
    await resized.write(outputPath);
    console.log(`  Created: ${size}x${size}.png`);
  }

  // Note: build/icon.jpg is the source image, no need to regenerate it
  console.log(`  Source icon: build/icon.jpg (already exists)`);
}

async function generateWindowsIco() {
  console.log('Generating Windows ICO...');

  const pngToIco = (await import('png-to-ico')).default;

  // ICO needs PNG files with specific sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of icoSizes) {
    const pngPath = path.join(PNG_DIR, `${size}x${size}.png`);
    pngBuffers.push(pngPath);
  }

  const icoBuffer = await pngToIco(pngBuffers);
  const icoPath = path.join(WIN_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  Created: icon.ico`);
}

async function generateMacIcns() {
  console.log('Generating Mac ICNS...');

  const icnsPath = path.join(MAC_DIR, 'icon.icns');

  try {
    // Create iconset structure for Mac (macOS iconutil can convert this)
    const iconsetDir = path.join(MAC_DIR, 'icon.iconset');
    if (!fs.existsSync(iconsetDir)) {
      fs.mkdirSync(iconsetDir, { recursive: true });
    }

    const { Jimp } = await import('jimp');
    const sourceImage = await Jimp.read(SOURCE_IMAGE);

    // Mac iconset naming convention
    const iconsetSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' },
    ];

    for (const { size, name } of iconsetSizes) {
      const outputPath = path.join(iconsetDir, name);
      const resized = sourceImage.clone().resize({ w: size, h: size });
      await resized.write(outputPath);
    }
    console.log(`  Created: icon.iconset directory`);

    // Read the 1024x1024 png and use it to create basic icns
    const png1024 = path.join(PNG_DIR, '1024x1024.png');

    // ICNS magic number and TOC
    // This is a simplified ICNS that may not work on all systems
    // For best results, use iconutil on macOS
    const icnsHeader = Buffer.from([0x69, 0x63, 0x6e, 0x73]); // 'icns'
    const ic10Type = Buffer.from([0x69, 0x63, 0x31, 0x30]); // 'ic10' - 1024x1024 PNG

    const pngData = fs.readFileSync(png1024);
    const ic10Size = 8 + pngData.length;
    const totalSize = 8 + ic10Size;

    const icnsBuffer = Buffer.alloc(totalSize);
    let offset = 0;

    // ICNS header
    icnsHeader.copy(icnsBuffer, offset);
    offset += 4;
    icnsBuffer.writeUInt32BE(totalSize, offset);
    offset += 4;

    // ic10 entry (1024x1024 PNG)
    ic10Type.copy(icnsBuffer, offset);
    offset += 4;
    icnsBuffer.writeUInt32BE(ic10Size, offset);
    offset += 4;
    pngData.copy(icnsBuffer, offset);

    fs.writeFileSync(icnsPath, icnsBuffer);
    console.log(`  Created: icon.icns (simplified format)`);
    console.log(`  Note: For best Mac compatibility, run 'iconutil -c icns ${iconsetDir}' on macOS`);

  } catch (error) {
    console.log(`  Warning: Could not create full ICNS: ${error.message}`);
    // Fallback: copy the largest PNG
    const fallbackPng = path.join(PNG_DIR, '1024x1024.png');
    fs.copyFileSync(fallbackPng, icnsPath);
    console.log(`  Created: icon.icns (PNG fallback)`);
  }
}

async function main() {
  console.log('===========================================');
  console.log('Icon Generation Script');
  console.log('===========================================');
  console.log(`Source: ${SOURCE_IMAGE}`);
  console.log(`Output: ${ICONS_DIR}`);
  console.log('');

  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error(`Error: Source image not found: ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  await ensureDirectories();
  await generatePngIcons();
  await generateWindowsIco();
  await generateMacIcns();

  console.log('');
  console.log('===========================================');
  console.log('Icon generation complete!');
  console.log('===========================================');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
