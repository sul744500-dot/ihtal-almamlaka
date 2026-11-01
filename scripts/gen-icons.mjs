// يولّد أيقونات PWA بصيغة PNG من public/favicon.svg
// الاستخدام: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const svg = await readFile(join(pub, 'favicon.svg'));

const plain = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of plain) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(pub, name));
  console.log('✓', name);
}

// الأيقونة القابلة للقص (maskable): الشعار داخل منطقة آمنة 80% مع خلفية كاملة
const inner = await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b1736' } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(join(pub, 'pwa-maskable-512.png'));
console.log('✓ pwa-maskable-512.png');
