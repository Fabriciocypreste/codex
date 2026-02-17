const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '..', 'public', 'logored.png');
const base = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const sizes = [
  { dir: 'mipmap-mdpi',    px: 48 },
  { dir: 'mipmap-hdpi',    px: 72 },
  { dir: 'mipmap-xhdpi',   px: 96 },
  { dir: 'mipmap-xxhdpi',  px: 144 },
  { dir: 'mipmap-xxxhdpi', px: 192 },
];

async function generate() {
  for (const s of sizes) {
    const dir = path.join(base, s.dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const logoPx = Math.round(s.px * 0.65);
    const logo = await sharp(src)
      .resize(logoPx, logoPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const offset = Math.round((s.px - logoPx) / 2);

    const bg = { r: 11, g: 11, b: 15, alpha: 255 };

    await sharp({ create: { width: s.px, height: s.px, channels: 4, background: bg } })
      .png()
      .composite([{ input: logo, left: offset, top: offset }])
      .toFile(path.join(dir, 'ic_launcher.png'));

    await sharp({ create: { width: s.px, height: s.px, channels: 4, background: bg } })
      .png()
      .composite([{ input: logo, left: offset, top: offset }])
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Foreground for adaptive icon (108dp safe zone)
    const fgPx = Math.round(s.px * 108 / 48);
    const fgLogoPx = Math.round(fgPx * 0.45);
    const fgLogo = await sharp(src)
      .resize(fgLogoPx, fgLogoPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const fgOffset = Math.round((fgPx - fgLogoPx) / 2);

    await sharp({ create: { width: fgPx, height: fgPx, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .composite([{ input: fgLogo, left: fgOffset, top: fgOffset }])
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log('OK: ' + s.dir + ' (' + s.px + 'px, fg=' + fgPx + 'px)');
  }
  console.log('All icons generated!');
}

generate().catch(e => { console.error(e); process.exit(1); });
