// The PunchIn brand mark as an SVG string: a stopwatch glyph (Lucide-language —
// crown + stem + body circle + clock hands) on a rounded accent square. Single
// source of truth for the mark, shared by the build-time generator
// (scripts/icons.mjs) and the on-demand Cloudflare Worker renderer
// (worker/iconRender.js, issue #228). The glyph flips between white and dark ink
// via readableInk so it stays legible on any accent (incl. light pastels).
//
// `accent` is the square fill (#rrggbb). `pad` keeps the canvas empty around the
// square (the maskable safe zone); `radius` is the corner-radius fraction.
import { readableInk } from './utils/inkOnAccent.js'

export function iconSvg(size, accent, { pad = 0, radius = 0.22 } = {}) {
  const inset = size * pad
  const side = size - inset * 2
  const x = inset
  const r = side * radius
  const glyph = side * 0.58
  const gx = x + (side - glyph) / 2
  const stroke = glyph / 12
  const scale = glyph / 24
  const ink = readableInk(accent)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${x}" y="${x}" width="${side}" height="${side}" rx="${r}" ry="${r}" fill="${accent}"/>
  <g transform="translate(${gx} ${x + (side - glyph) / 2}) scale(${scale})" fill="none" stroke="${ink}" stroke-width="${stroke / scale}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.5 2.6h5"/>
    <path d="M12 2.6v2.4"/>
    <circle cx="12" cy="13.4" r="8.2"/>
    <path d="M12 13.4V8.6"/>
    <path d="M12 13.4l3 1.9"/>
    <circle cx="12" cy="13.4" r="0.9" fill="${ink}" stroke="none"/>
  </g>
</svg>`
}
