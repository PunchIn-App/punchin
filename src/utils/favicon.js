// Renders the PunchIn brand mark (a stopwatch on a rounded accent square) to a
// PNG data URL and installs it as the browser-tab favicon, so the tab icon
// tracks the user's chosen accent color. Mirrors the stopwatch geometry in
// src/iconSvg.js; the glyph flips white/dark-ink via readableInk for contrast.
//
// Scope note: this only affects the in-browser favicon. The installed
// PWA/home-screen icon is baked from the manifest at install time and cannot
// follow the accent afterwards — that's a platform constraint, not a bug.
import { readableInk } from './inkOnAccent'

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

// Returns a PNG data URL of the favicon in `hex`, or null if canvas 2D is
// unavailable (e.g. jsdom without the canvas package).
export function drawFaviconDataUrl(hex, size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Accent rounded square (matches the in-app logo badge). Keep this the last
  // fillStyle set — the glyph is stroked, not filled — so the tile colour stands.
  ctx.fillStyle = hex
  roundRectPath(ctx, 0, 0, size, size, size * 0.22)
  ctx.fill()

  // Stopwatch glyph, mapped from the 24×24 mark geometry (src/iconSvg.js). The
  // ink flips white/dark so it reads on any accent. The tiny centre pip is
  // omitted at favicon scale (and to keep the tile fillStyle intact).
  const g = (size * 0.58) / 24            // unit scale: 24-space → px
  const o = (size - 24 * g) / 2           // centre the 24×24 glyph box
  const X = (u) => o + u * g
  const Y = (u) => o + u * g
  ctx.strokeStyle = readableInk(hex)
  ctx.lineWidth = 2 * g
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(X(9.5), Y(2.6)); ctx.lineTo(X(14.5), Y(2.6)) // crown bar
  ctx.moveTo(X(12), Y(2.6));  ctx.lineTo(X(12), Y(5))      // stem
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(X(12), Y(13.4), 8.2 * g, 0, Math.PI * 2)         // body
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(X(12), Y(13.4)); ctx.lineTo(X(12), Y(8.6))    // minute hand
  ctx.moveTo(X(12), Y(13.4)); ctx.lineTo(X(15), Y(15.3))   // second hand
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

// Draws the favicon for `hex` and installs it as the document's icon link,
// replacing any static icon links on first run. No-op if canvas is unsupported.
export function updateFavicon(hex) {
  try {
    // Render larger than a tab icon and declare the size, so when this single
    // dynamic icon replaces the author's multi-resolution set the browser still
    // has enough pixels to downscale crisply on high-DPI displays (issue #164).
    const SIZE = 96
    const url = drawFaviconDataUrl(hex, SIZE)
    if (!url) return
    let link = document.getElementById('dynamic-favicon')
    if (!link) {
      document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove())
      link = document.createElement('link')
      link.id = 'dynamic-favicon'
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.setAttribute('sizes', `${SIZE}x${SIZE}`)
    link.href = url
  } catch {
    /* canvas unsupported — keep whatever static favicon is present */
  }
}
