// Hex-colour helpers. External colour values (the accent, per-job/labor colours)
// are expected to be 6-digit `#rrggbb`, but a 3-digit / short / garbage value
// would otherwise yield `NaN` RGB (App accent) or an invalid 8-digit alpha hex
// (the labor tints). Normalise once here so every boundary is safe regardless of
// caller. Pure JS / no DOM, so it's importable from the app and the build scripts.

const HEX6 = /^#?([0-9a-fA-F]{6})$/
const HEX3 = /^#?([0-9a-fA-F]{3})$/

// Return a guaranteed `#rrggbb`. Valid 6-digit input passes through byte-for-byte
// (case preserved), `#abc` expands to `#aabbcc`, and anything else falls back to
// `fallback` (which is assumed to be a valid 6-digit hex; defaults to black).
export function normalizeHex(hex, fallback = '#000000') {
  const s = String(hex ?? '').trim()
  const m6 = s.match(HEX6)
  if (m6) return `#${m6[1]}`
  const m3 = s.match(HEX3)
  if (m3) { const c = m3[1]; return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}` }
  const fb = String(fallback).match(HEX6)
  return fb ? `#${fb[1]}` : '#000000'
}

// Space-separated `"r g b"` (0–255) for the `--accent-rgb` custom property, so
// Tailwind's `rgb(var(--accent-rgb) / <alpha>)` opacity modifiers work.
export function hexToRgb(hex) {
  const h = normalizeHex(hex)
  return `${parseInt(h.slice(1, 3), 16)} ${parseInt(h.slice(3, 5), 16)} ${parseInt(h.slice(5, 7), 16)}`
}

// Append an 8-bit alpha (2 hex digits, e.g. '38' ≈ 22%, '6B' ≈ 42%) to a colour
// as `#rrggbbaa`. Normalises the base first so a short/invalid hex can't produce
// a malformed value.
export function withAlpha(hex, alphaHex) {
  return `${normalizeHex(hex)}${alphaHex}`
}
