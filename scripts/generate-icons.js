const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const ICONS_DIR = path.join(BUILD_DIR, 'icons');
const PNG_DIR = path.join(ICONS_DIR, 'png');
const WIN_DIR = path.join(ICONS_DIR, 'win');
const MAC_DIR = path.join(ICONS_DIR, 'mac');

// Prefer PNG source (supports transparency) over JPG
const SOURCE_PNG = path.join(BUILD_DIR, 'icon.png');
const SOURCE_JPG = path.join(BUILD_DIR, 'icon.jpg');

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

/**
 * Returns the path to a transparent PNG source.
 * Prefers build/icon.png. If only build/icon.jpg exists, converts it by
 * detecting the background color from the image corners and making those
 * pixels transparent (handles JPEG compression artifacts within a tolerance).
 */
async function resolveSourceImage() {
  const { Jimp } = await import('jimp');

  if (fs.existsSync(SOURCE_PNG)) {
    console.log(`Using PNG source (with transparency): ${SOURCE_PNG}`);
    return SOURCE_PNG;
  }

  if (!fs.existsSync(SOURCE_JPG)) {
    throw new Error(
      `No source icon found. Place a transparent build/icon.png (recommended) or build/icon.jpg in: ${BUILD_DIR}`
    );
  }

  console.log('PNG source not found. Converting icon.jpg → icon.png with background removal...');

  const img = await Jimp.read(SOURCE_JPG);
  const width  = img.bitmap.width;
  const height = img.bitmap.height;
  const data   = img.bitmap.data; // raw RGBA buffer

  // Helper to read RGB at (x, y) directly from bitmap data
  const pixelRGB = (x, y) => {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };

  // Sample the four corners to detect the background color
  const corners = [
    pixelRGB(0, 0),
    pixelRGB(width - 1, 0),
    pixelRGB(0, height - 1),
    pixelRGB(width - 1, height - 1),
  ];

  const bgR = Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length);
  const bgG = Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length);
  const bgB = Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length);

  console.log(`  Detected background color: rgb(${bgR}, ${bgG}, ${bgB})`);

  // Tolerance accounts for JPEG compression artifacts
  const TOLERANCE = 40;

  img.scan(0, 0, width, height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist <= TOLERANCE) {
      this.bitmap.data[idx + 3] = 0; // transparent
    }
  });

  await img.write(SOURCE_PNG);
  console.log(`  Created: build/icon.png (background removed)`);
  return SOURCE_PNG;
}

async function generatePngIcons(sourcePath) {
  console.log('\nGenerating PNG icons...');
  const { Jimp } = await import('jimp');

  const sourceImage = await Jimp.read(sourcePath);

  for (const size of PNG_SIZES) {
    const outputPath = path.join(PNG_DIR, `${size}x${size}.png`);
    const resized = sourceImage.clone().resize({ w: size, h: size });
    await resized.write(outputPath);
    console.log(`  Created: ${size}x${size}.png`);
  }
}

async function generateWindowsIco() {
  console.log('\nGenerating Windows ICO...');

  const pngToIco = (await import('png-to-ico')).default;

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = icoSizes.map(size => path.join(PNG_DIR, `${size}x${size}.png`));

  const icoBuffer = await pngToIco(pngPaths);
  const icoPath = path.join(WIN_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  Created: icon.ico`);
}

async function generateMacIcns() {
  console.log('\nGenerating Mac ICNS...');

  const icnsPath = path.join(MAC_DIR, 'icon.icns');
  const iconsetDir = path.join(MAC_DIR, 'icon.iconset');

  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  const iconsetSizes = [
    { size: 16,   name: 'icon_16x16.png' },
    { size: 32,   name: 'icon_16x16@2x.png' },
    { size: 32,   name: 'icon_32x32.png' },
    { size: 64,   name: 'icon_32x32@2x.png' },
    { size: 128,  name: 'icon_128x128.png' },
    { size: 256,  name: 'icon_128x128@2x.png' },
    { size: 256,  name: 'icon_256x256.png' },
    { size: 512,  name: 'icon_256x256@2x.png' },
    { size: 512,  name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  for (const { size, name } of iconsetSizes) {
    const src = path.join(PNG_DIR, `${size}x${size}.png`);
    const dest = path.join(iconsetDir, name);
    fs.copyFileSync(src, dest);
  }
  console.log(`  Created: icon.iconset directory`);

  // Build a minimal ICNS container around the 1024×1024 transparent PNG
  const png1024 = path.join(PNG_DIR, '1024x1024.png');
  const icnsHeader = Buffer.from([0x69, 0x63, 0x6e, 0x73]); // 'icns'
  const ic10Type  = Buffer.from([0x69, 0x63, 0x31, 0x30]);  // 'ic10' – 1024×1024 PNG
  const pngData   = fs.readFileSync(png1024);
  const ic10Size  = 8 + pngData.length;
  const totalSize = 8 + ic10Size;
  const icnsBuffer = Buffer.alloc(totalSize);
  let offset = 0;
  icnsHeader.copy(icnsBuffer, offset); offset += 4;
  icnsBuffer.writeUInt32BE(totalSize, offset); offset += 4;
  ic10Type.copy(icnsBuffer, offset);   offset += 4;
  icnsBuffer.writeUInt32BE(ic10Size, offset); offset += 4;
  pngData.copy(icnsBuffer, offset);
  fs.writeFileSync(icnsPath, icnsBuffer);
  console.log(`  Created: icon.icns`);
  console.log(`  Note: For best Mac compatibility run 'iconutil -c icns ${iconsetDir}' on macOS`);
}

async function main() {
  console.log('===========================================');
  console.log('Icon Generation Script');
  console.log('===========================================');

  await ensureDirectories();
  const sourcePath = await resolveSourceImage();
  await generatePngIcons(sourcePath);
  await generateWindowsIco();
  await generateMacIcns();

  console.log('\n===========================================');
  console.log('Icon generation complete!');
  console.log('===========================================');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
