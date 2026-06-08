// The PunchIn stopwatch brand mark as ONE ordered list of geometry primitives in
// the Lucide 24×24 coordinate space: crown bar + stem + body circle + two clock
// hands + centre dot. Shared so the SVG-string renderer (src/iconSvg.js → build
// PNGs + the Cloudflare Worker) and the in-app React renderer
// (src/components/BrandMark.jsx) can't drift — tweak the geometry once, both update.
// Pure data / no React or DOM, so it's importable from the worker and node too.
//
// Order is significant (SVG paints in order): everything is STROKED except the
// final centre dot, which is FILLED in the resolved ink and must draw last.
// An element with `d` is a <path>; otherwise it's a <circle> (cx/cy/r), and
// `fill: true` marks the filled centre dot.
export const STOPWATCH_ELEMENTS = [
  { d: 'M9.5 2.6h5' },                       // crown bar
  { d: 'M12 2.6v2.4' },                      // stem
  { cx: 12, cy: 13.4, r: 8.2 },              // body (stroked circle)
  { d: 'M12 13.4V8.6' },                     // minute hand
  { d: 'M12 13.4l3 1.9' },                   // hour hand
  { cx: 12, cy: 13.4, r: 0.9, fill: true },  // centre dot (filled in ink)
]
