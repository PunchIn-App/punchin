// The PunchIn brand mark as an SVG string: a lucide "clock" glyph (circle + two
// hands) on a rounded accent square with a dark navy stroke. Single source of
// truth for the mark, shared by the build-time generator (scripts/icons.mjs) and
// the on-demand Cloudflare Worker renderer (worker/iconRender.js, issue #228).
//
// `accent` is the square fill (#rrggbb). `pad` keeps the canvas empty around the
// square (the maskable safe zone); `radius` is the corner-radius fraction.
const DARK = '#0F1117'

export function iconSvg(size, accent, { pad = 0, radius = 0.22 } = {}) {
  const inset = size * pad
  const side = size - inset * 2
  const x = inset
  const r = side * radius
  const glyph = side * 0.58
  const gx = x + (side - glyph) / 2
  const stroke = glyph / 12
  const scale = glyph / 24

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${x}" y="${x}" width="${side}" height="${side}" rx="${r}" ry="${r}" fill="${accent}"/>
  <g transform="translate(${gx} ${x + (side - glyph) / 2}) scale(${scale})" fill="none" stroke="${DARK}" stroke-width="${stroke / scale}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </g>
</svg>`
}
