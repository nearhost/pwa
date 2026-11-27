// Renders the app icons in static/icons/ from the landing's mark on dark:
// landing/brand/nearhost-mark-on-dark.svg (the mark on the dark ground, #0F1210).
// Run with `node scripts/icons.mjs` after the mark changes, and commit the PNGs.
//
// The SVG is inlined here, so the script runs without a landing checkout. Each icon is the mark
// centred on a square of the dark ground. The plain icons give the mark 70% of the square, like
// the landing's favicon art; the maskable icon keeps it inside the 80% safe zone at 56%, so a
// circular or squircle mask never clips it. The apple-touch-icon is opaque (iOS fills
// transparency with black) and iOS rounds its corners itself.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ground = '#0F1210';
const arch = '#D6F26B';
const dot = '#ECEFE8';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');

const icons = [
  { file: 'apple-touch-icon-180.png', size: 180, mark: 0.7 },
  { file: 'icon-192.png', size: 192, mark: 0.7 },
  { file: 'icon-512.png', size: 512, mark: 0.7 },
  { file: 'icon-maskable-512.png', size: 512, mark: 0.56 },
];

function svg(size, markShare) {
  const mark = size * markShare;
  const offset = (size - mark) / 2;
  const scale = mark / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ground}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M14 56V32a18 18 0 0 1 36 0v24" fill="none" stroke="${arch}" stroke-width="11" stroke-linecap="round"/>
    <circle cx="32" cy="48" r="6" fill="${dot}"/>
  </g>
</svg>`;
}

await mkdir(out, { recursive: true });
for (const icon of icons) {
  const png = new Resvg(svg(icon.size, icon.mark)).render().asPng();
  await writeFile(join(out, icon.file), png);
  console.log(`static/icons/${icon.file} (${icon.size}×${icon.size})`);
}
