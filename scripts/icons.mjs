// Generates the PWA install-icon sets (issue #228).
//
// The mark mirrors the in-app logo (src/components/Layout.jsx): a lucide-style
// Clock glyph on the accent square with a dark navy stroke (#0F1117), so the
// installed icon matches the header badge.
//
// Two things are produced under app/public/ (Vite copies that dir to dist/ root):
//   1. The DEFAULT (blue) set at the root — icon-192/512/512-maskable + the iOS
//      apple-touch-icon — referenced by the canonical manifest and index.html.
//   2. A per-accent "crayon box": for every colour in src/iconPalette.js, a set
//      under app/public/icons/<key>/ (icon-192/512/512-maskable + a copy of the
//      manifest pointing at them). The app swaps <link rel="manifest"> to the
//      nearest swatch at install time so the Android/desktop home-screen icon
//      matches the chosen accent. (iOS gets the exact colour client-side, so the
//      palette needs no per-colour apple-touch-icon.)
//
// Run from the project root:
//   npm install --no-save sharp && node scripts/icons.mjs
// (sharp is intentionally not a committed dependency — like Playwright for
// screenshots, it is only needed to regenerate these static assets.)

import { mkdir, rm, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { ICON_PALETTE, paletteKey } from '../src/iconPalette.js'
import { iconSvg } from '../src/iconSvg.js'
import { manifest } from '../config/manifest.base.js'

const DEFAULT_ACCENT = '#2D5BF5'
const publicDir = fileURLToPath(new URL('../app/public/', import.meta.url))
const iconsDir = publicDir + 'icons/'

async function render(dir, name, size, accent, opts) {
  const svg = Buffer.from(iconSvg(size, accent, opts))
  await sharp(svg).png().toFile(dir + name)
}

// The three icons the manifest references, for one accent, into `dir`.
async function renderManifestIcons(dir, accent) {
  await mkdir(dir, { recursive: true })
  await render(dir, 'icon-192.png', 192, accent, {})
  await render(dir, 'icon-512.png', 512, accent, {})
  // Maskable: fill the whole canvas (no corner radius); the glyph stays within
  // the central safe zone so Android's adaptive-icon mask never clips it.
  await render(dir, 'icon-512-maskable.png', 512, accent, { pad: 0, radius: 0 })
}

console.log(`Writing default icons → ${publicDir}`)
await renderManifestIcons(publicDir, DEFAULT_ACCENT)
await render(publicDir, 'apple-touch-icon.png', 180, DEFAULT_ACCENT, {})

// Per-accent palette. Wipe the folder first so removed swatches don't linger.
await rm(iconsDir, { recursive: true, force: true })
console.log(`Writing ${ICON_PALETTE.length} palette sets → ${iconsDir}`)
for (const hex of ICON_PALETTE) {
  const dir = `${iconsDir}${paletteKey(hex)}/`
  await renderManifestIcons(dir, hex)
  // Manifest copy: relative icon srcs resolve to this folder's icons.
  await writeFile(dir + 'manifest.webmanifest', JSON.stringify(manifest, null, 2))
}
console.log(`Done — default set + ${ICON_PALETTE.length} accent sets.`)
