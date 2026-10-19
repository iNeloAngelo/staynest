// Генератор иконок PWA без внешних зависимостей: рисует домик и кодирует PNG.
// Запуск: pnpm icons:generate
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'apps/web/public/icons');

const PRIMARY = [0x1f, 0x5f, 0x4a];
const SURFACE = [0xfa, 0xf7, 0xf2];
const ACCENT = [0xe0, 0x8a, 0x2e];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(size, colorAt) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = colorAt(x, y);
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedSquare(px, py, radius) {
  const left = radius;
  const right = 1 - radius;
  if (px >= left && px <= right) return true;
  if (py >= left && py <= right) return true;

  const centerX = px < left ? left : right;
  const centerY = py < left ? left : right;
  return Math.hypot(px - centerX, py - centerY) <= radius;
}

function houseColor(px, py) {
  const roof = py >= 0.28 && py <= 0.5 && Math.abs(px - 0.5) <= (py - 0.28) * 1.09;
  const body = px >= 0.3 && px <= 0.7 && py >= 0.46 && py <= 0.78;
  const door = px >= 0.44 && px <= 0.56 && py >= 0.6 && py <= 0.78;
  const sun = Math.hypot(px - 0.72, py - 0.28) <= 0.06;

  if (roof || body) return door ? PRIMARY : SURFACE;
  if (sun) return ACCENT;
  return null;
}

function iconColor(px, py, maskable) {
  if (!maskable && !inRoundedSquare(px, py, 0.22)) return [0, 0, 0, 0];

  const house = houseColor(px, py);
  const color = house ?? PRIMARY;
  return [...color, 255];
}

function renderIcon(size, { maskable = false } = {}) {
  const samples = 3;
  return png(size, (x, y) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;

    for (let sy = 0; sy < samples; sy += 1) {
      for (let sx = 0; sx < samples; sx += 1) {
        const [cr, cg, cb, ca] = iconColor(
          (x + (sx + 0.5) / samples) / size,
          (y + (sy + 0.5) / samples) / size,
          maskable,
        );
        r += cr * ca;
        g += cg * ca;
        b += cb * ca;
        a += ca;
      }
    }

    const count = samples * samples;
    if (a === 0) return [0, 0, 0, 0];
    return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / count)];
  });
}

mkdirSync(outDir, { recursive: true });

const files = [
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  ['icon-maskable-512.png', renderIcon(512, { maskable: true })],
  ['apple-touch-icon.png', renderIcon(180, { maskable: true })],
  ['favicon-32.png', renderIcon(32)],
];

for (const [name, buffer] of files) {
  writeFileSync(resolve(outDir, name), buffer);
  console.log(`${name} — ${buffer.length} bytes`);
}
