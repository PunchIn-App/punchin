// The PunchIn brand mark as an SVG string: a stopwatch glyph (Lucide-language —
// crown + stem + body circle + clock hands) on a rounded accent square. This is
// the SVG-string renderer, shared by the build-time generator (scripts/icons.mjs)
// and the on-demand Cloudflare Worker renderer (worker/iconRender.js, issue #228).
// The glyph *geometry* lives in src/stopwatchGeometry.js (shared with the in-app
// React renderer, src/components/BrandMark.jsx, so the two can't drift). The glyph
// flips between white and dark ink via readableInk so it stays legible on any
// accent (incl. light pastels).
//
// `accent` is the square fill (#rrggbb). `pad` keeps the canvas empty around the
// square (the maskable safe zone); `radius` is the corner-radius fraction.
import { readableInk } from './utils/inkOnAccent.js'
import { STOPWATCH_ELEMENTS } from './stopwatchGeometry.js'

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

  const inner = STOPWATCH_ELEMENTS.map(el =>
    el.d
      ? `<path d="${el.d}"/>`
      : el.fill
        ? `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${ink}" stroke="none"/>`
        : `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}"/>`
  ).join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${x}" y="${x}" width="${side}" height="${side}" rx="${r}" ry="${r}" fill="${accent}"/>
  <g transform="translate(${gx} ${x + (side - glyph) / 2}) scale(${scale})" fill="none" stroke="${ink}" stroke-width="${stroke / scale}" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>`
}
