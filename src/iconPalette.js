// The "crayon box" of accent colours we pre-render install-icon sets for
// (issue #228).
//
// Why a fixed palette instead of rendering the user's exact colour: Android's
// installed (WebAPK) icon is baked by Google's minting server, which fetches the
// manifest's icon URLs itself — it never sees anything the app renders locally,
// so a custom hex can't be produced on the fly the way the iOS apple-touch-icon
// can. We therefore pre-render this palette at build time (scripts/icons.mjs) and
// snap any chosen accent to the nearest swatch for the Android/desktop manifest.
// iOS still gets the exact colour via a client-rendered data-URL.
//
// Shared by scripts/icons.mjs (to render the sets) and src/utils/installIcon.js
// (to snap a colour to its set) so the two can never drift.
import { ACCENT_PRESETS } from './accentPresets.js'

// HSL (h 0–360, s/l 0–100) -> '#rrggbb'.
function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Hue-dense across the saturation/lightness band real accents live in, plus the
// named UI presets (so a chosen preset is an EXACT match, not a near-snap).
const HUES = 20
const LEVELS = [
  { s: 85, l: 57 }, // vivid
  { s: 80, l: 45 }, // deep
  { s: 78, l: 67 }, // bright
]

function buildPalette() {
  const seen = new Set()
  const out = []
  const add = (hex) => {
    const k = hex.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(k) }
  }
  for (const p of ACCENT_PRESETS) add(p.hex)
  for (let i = 0; i < HUES; i++) {
    const h = Math.round((360 / HUES) * i)
    for (const { s, l } of LEVELS) add(hslToHex(h, s, l))
  }
  return out
}

// Lowercased '#rrggbb' values; the per-colour asset folder key is the hex
// without the leading '#'.
export const ICON_PALETTE = buildPalette()

export function paletteKey(hex) {
  return String(hex).trim().toLowerCase().replace('#', '')
}

function hexToRgb(hex) {
  const h = String(hex).trim().replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// "redmean" — a cheap, better-than-plain-RGB perceptual colour distance.
function distance(a, b) {
  const rm = (a[0] + b[0]) / 2
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

// The palette key whose colour is closest to `hex`. A palette colour returns
// itself, so presets are exact.
export function nearestPaletteKey(hex) {
  const rgb = hexToRgb(hex)
  let best = ICON_PALETTE[0]
  let bestD = Infinity
  for (const c of ICON_PALETTE) {
    const d = distance(rgb, hexToRgb(c))
    if (d < bestD) { bestD = d; best = c }
  }
  return paletteKey(best)
}
