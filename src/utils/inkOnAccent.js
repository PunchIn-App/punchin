// Pick a foreground "ink" that stays legible on a given accent colour. The brand
// mark glyph is white on the accent tile by default and flips to dark ink on
// light/pastel accents (where white would wash out). Pure JS / no DOM, so it's
// importable from the browser, the Cloudflare Worker, and the Node build scripts.
//
// Rule: keep white while it has at least the WCAG 3:1 graphic-contrast ratio
// against the accent; below that, use the dark ink. This matches the design
// reference tiles (#2D5BF5 / #7C5CFF → white; #FFD66B / #9FE5C5 / pastels → ink).

export const DARK_INK = '#0F1117' // the app's on-accent dark ink (same as button text)
const WHITE_INK = '#FFFFFF'

// sRGB channel (0–255) -> linearised component for relative luminance.
function lin(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

// WCAG relative luminance of a #rrggbb (leading # and case optional).
function luminance(hex) {
  const h = String(hex).trim().replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(l1, l2) {
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// White by default; dark ink once white drops below 3:1 graphic contrast.
export function readableInk(hex) {
  return contrast(1, luminance(hex)) >= 3 ? WHITE_INK : DARK_INK
}
