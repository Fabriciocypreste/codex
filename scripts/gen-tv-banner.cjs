const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Imagem fornecida pelo usuário — retangular para Smart TV launcher
const src = path.join(__dirname, '..', 'Generated Image February 14, 2026 - 7_12PM.webp');
const resBase = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android TV Leanback banner: 320x180 dp
// Cada densidade tem um multiplicador diferente
const DENSITIES = [
  { dir: 'drawable-mdpi',    w: 320, h: 180 },
  { dir: 'drawable-hdpi',    w: 480, h: 270 },
  { dir: 'drawable-xhdpi',   w: 640, h: 360 },
  { dir: 'drawable-xxhdpi',  w: 960, h: 540 },
  { dir: 'drawable',         w: 640, h: 360 }, // fallback default = xhdpi
];

async function generate() {
  if (!fs.existsSync(src)) {
    console.error('Imagem fonte não encontrada:', src);
    process.exit(1);
  }

  for (const density of DENSITIES) {
    const dir = path.join(resBase, density.dir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(src)
      .resize(density.w, density.h, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'tv_banner.png'));

    console.log(`OK: ${density.dir}/tv_banner.png (${density.w}x${density.h})`);
  }

  console.log('All TV banners generated!');
}

generate().catch(e => { console.error(e); process.exit(1); });
