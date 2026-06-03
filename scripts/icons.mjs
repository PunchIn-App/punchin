// Generates the PWA icon set referenced by the manifest (config/vite.config.js)
// and the iOS home-screen icon linked from app/index.html.
//
// The mark mirrors the in-app logo (src/components/Layout.jsx): a lucide-style
// Clock glyph on the brand accent square (#1f6feb) with a dark navy stroke
// (#0F1117), so the installed icon matches the header badge.
//
// Outputs to app/public/ (Vite copies that dir to dist/ root, where the
// manifest's relative `src` values resolve):
//   icon-192.png            192×192  standard
//   icon-512.png            512×512  standard
//   icon-512-maskable.png   512×512  full-bleed with safe-zone padding
//   apple-touch-icon.png    180×180  iOS home screen
//
// Run from the project root:
//   npm install --no-save sharp && node scripts/icons.mjs
// (sharp is intentionally not a committed dependency — like Playwright for
// screenshots, it is only needed to regenerate these static assets.)

import { mkdir, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const ACCENT = '#1f6feb'
const DARK   = '#0F1117'
const outDir = fileURLToPath(new URL('../app/public/', import.meta.url))

// A lucide "clock" glyph (24×24 viewBox: circle + two hands) centered and
// scaled into `size`. `pad` is the fraction of the canvas kept empty around
// the rounded square (used for the maskable safe zone). `radius` is the corner
// radius as a fraction of the square's side (0 = square, for maskable).
function iconSvg(size, { pad = 0, radius = 0.22 } = {}) {
  const inset = size * pad
  const side = size - inset * 2
  const x = inset
  const r = side * radius

  // Clock glyph occupies ~58% of the square, centered.
  const glyph = side * 0.58
  const gx = x + (side - glyph) / 2
  const stroke = glyph / 12 // matches lucide strokeWidth≈2 at 24px scaled up
  const scale = glyph / 24
  const cx = gx + glyph / 2
  const cy = x + side / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${x}" y="${x}" width="${side}" height="${side}" rx="${r}" ry="${r}" fill="${ACCENT}"/>
  <g transform="translate(${gx} ${x + (side - glyph) / 2}) scale(${scale})" fill="none" stroke="${DARK}" stroke-width="${stroke / scale}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </g>
</svg>`
}

async function render(name, size, opts) {
  const svg = Buffer.from(iconSvg(size, opts))
  await sharp(svg).png().toFile(outDir + name)
  console.log(`  ${name}  (${size}×${size})`)
}

await mkdir(outDir, { recursive: true })
console.log(`Writing icons → ${outDir}`)
await render('icon-192.png', 192, {})
await render('icon-512.png', 512, {})
// Maskable: fill the whole canvas (no corner radius) and keep the glyph within
// the central ~80% safe zone so Android's adaptive-icon mask never clips it.
await render('icon-512-maskable.png', 512, { pad: 0.0, radius: 0 })
await render('apple-touch-icon.png', 180, {})
console.log('Done.')
