// Renders the PunchIn brand mark (a Clock on a rounded accent square) to a PNG
// data URL and installs it as the browser-tab favicon, so the tab icon tracks
// the user's chosen accent color.
//
// Scope note: this only affects the in-browser favicon. The installed
// PWA/home-screen icon is baked from the manifest at install time and cannot
// follow the accent afterwards — that's a platform constraint, not a bug.

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

  // Accent rounded square (matches the in-app logo badge).
  ctx.fillStyle = hex
  roundRectPath(ctx, 0, 0, size, size, size * 0.22)
  ctx.fill()

  // Clock glyph in the dark brand ink, mirroring the lucide Clock used in-app.
  const c = size / 2
  const r = size * 0.28
  ctx.strokeStyle = '#0F1117'
  ctx.lineWidth = size * 0.075
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(c, c)
  ctx.lineTo(c, c - r * 0.55)          // hand → 12
  ctx.moveTo(c, c)
  ctx.lineTo(c + r * 0.5, c + r * 0.22) // hand → ~4
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

// Draws the favicon for `hex` and installs it as the document's icon link,
// replacing any static icon links on first run. No-op if canvas is unsupported.
export function updateFavicon(hex) {
  try {
    const url = drawFaviconDataUrl(hex)
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
    link.href = url
  } catch {
    /* canvas unsupported — keep whatever static favicon is present */
  }
}
