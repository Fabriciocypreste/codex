#!/usr/bin/env node
// Gera versões WebP do banner TV (16:9) para drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}
// Uso: node scripts/generate-tv-drawables.js /caminho/para/banner.webp
// Requer: npm i sharp

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = {
  'drawable-mdpi': { w: 320, h: 180 },
  'drawable-hdpi': { w: 480, h: 270 },
  'drawable-xhdpi': { w: 640, h: 360 },
  'drawable-xxhdpi': { w: 960, h: 540 },
  'drawable-xxxhdpi': { w: 1280, h: 720 }
};

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node scripts/generate-tv-drawables.js /path/to/banner.webp');
    process.exit(2);
  }

  const projectRoot = process.cwd();
  const resBase = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(input)) {
    console.error('Input file not found:', input);
    process.exit(2);
  }

  for (const folder of Object.keys(sizes)) {
    const { w, h } = sizes[folder];
    const outDir = path.join(resBase, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'tv_banner.webp');
    console.log(`Generating ${outPath} (${w}x${h})`);
    await sharp(input)
      .resize(w, h, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(outPath);
  }

  // Also write a fallback in drawable/ (no-density)
  const fallbackDir = path.join(resBase, 'drawable');
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  const fallbackPath = path.join(fallbackDir, 'tv_banner.webp');
  console.log(`Generating fallback ${fallbackPath} (1280x720)`);
  await sharp(input).resize(1280, 720, { fit: 'cover' }).webp({ quality: 85 }).toFile(fallbackPath);

  console.log('All drawables generated.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
