// Renders the app icons in static/icons/ from the landing's prompt mark (scripts/logo.mjs there):
// a chevron in the accent and a dot in the text colour, full-bleed on the surface colour (#19171C).
// Run with `node scripts/icons.mjs` after the mark changes, and commit the PNGs.
//
// The SVG is inlined here, so the script runs without a landing checkout. Each icon is the mark
// centred on a square of the surface colour. The mark's painted box is 44.5 by 38.5 units of its 64
// grid, centred on (31.25, 32.25). The plain icons give that box 56% of the square's width, like the
// landing's logo files; the maskable icon gives it 50%, which keeps its corners inside the circle of
// the 80% safe zone, so a circular or squircle mask never clips it. The apple-touch-icon is opaque (iOS fills
// transparency with black) and iOS rounds its corners itself.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ground = '#19171C';
const chevron = '#FF70C8';
const dot = '#F4EEF2';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');

const icons = [
  { file: 'apple-touch-icon-180.png', size: 180, mark: 0.56 },
  { file: 'icon-192.png', size: 192, mark: 0.56 },
  { file: 'icon-512.png', size: 512, mark: 0.56 },
  { file: 'icon-maskable-512.png', size: 512, mark: 0.5 },
];

function svg(size, markShare) {
  const scale = (size * markShare) / 44.5;
  const x = size / 2 - 31.25 * scale;
  const y = size / 2 - 32.25 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ground}"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})">
    <path d="M13 17l15 15-15 15" fill="none" stroke="${chevron}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="46" cy="44" r="7.5" fill="${dot}"/>
  </g>
</svg>`;
}

await mkdir(out, { recursive: true });
for (const icon of icons) {
  const png = new Resvg(svg(icon.size, icon.mark)).render().asPng();
  await writeFile(join(out, icon.file), png);
  console.log(`static/icons/${icon.file} (${icon.size}×${icon.size})`);
}
