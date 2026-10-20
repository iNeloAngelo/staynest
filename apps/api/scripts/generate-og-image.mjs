import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Open Graph-обложка по умолчанию: 1200×630. Фото — CC0 (см. docs/credits.md),
 * текст накладывается SVG, поэтому картинку можно пересобрать одной командой.
 */
const root = fileURLToPath(new URL('../../..', import.meta.url));
const source = await readFile(`${root}/scripts/demo-photos/house-lake.jpg`);
const image = await sharp(source).resize(1200, 630, { fit: 'cover' }).toBuffer();

const overlay = Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#141a17" stop-opacity="0.92"/>
      <stop offset="0.62" stop-color="#141a17" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#141a17" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <text x="72" y="210" fill="#faf7f2" font-family="Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="4">STAYNEST</text>
  <text x="72" y="340" fill="#faf7f2" font-family="Arial, sans-serif" font-size="76" font-weight="700">Дома у леса</text>
  <text x="72" y="426" fill="#faf7f2" font-family="Arial, sans-serif" font-size="76" font-weight="700">и озера</text>
  <text x="72" y="512" fill="#d8e0da" font-family="Arial, sans-serif" font-size="30">Свободные даты · честная цена · бронирование без переписок</text>
  <rect x="72" y="552" width="86" height="6" rx="3" fill="#f0a04b"/>
</svg>`);

await sharp(image)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(`${root}/apps/web/public/og-image.jpg`);

console.log('og-image.jpg готов');
