// The PunchIn brand identity, shared by the phone header and the desktop sidebar.
//   - PunchMark: the stopwatch glyph on the accent tile (the app logo badge)
//   - Wordmark:  "PunchIn" in Noto Sans Display with the accent-tinted capital I
// The mark glyph flips white/dark via readableInk so it reads on any accent; the
// geometry comes from src/stopwatchGeometry.js (shared with the SVG-string renderer
// src/iconSvg.js — the favicon / install-icon source — so the two can't drift).
import { readableInk } from '../utils/inkOnAccent'
import { STOPWATCH_ELEMENTS } from '../stopwatchGeometry'

// The stopwatch path geometry (crown + stem + body + clock hands + centre dot),
// rendered from the shared STOPWATCH_ELEMENTS. Strokes + the filled centre dot use
// `currentColor`, so the colour is driven by the SVG's resolved text colour — set
// it via the `color` prop on StopwatchGlyph, or an inherited colour on PunchGlyph.
function StopwatchPaths() {
  return (
    <>
      {STOPWATCH_ELEMENTS.map((el, i) =>
        el.d
          ? <path key={i} d={el.d} />
          : <circle key={i} cx={el.cx} cy={el.cy} r={el.r} {...(el.fill ? { fill: 'currentColor', stroke: 'none' } : null)} />
      )}
    </>
  )
}

// The stopwatch glyph (crown + stem + body + clock hands), stroked in `color`.
export function StopwatchGlyph({ className = 'w-4 h-4', color }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color }}
      aria-hidden="true"
    >
      <StopwatchPaths />
    </svg>
  )
}

// A Lucide-compatible adapter that draws the PunchIn stopwatch mark, so the brand
// can be used anywhere a labor-type glyph is rendered (chip, tag, picker). Like a
// Lucide icon it strokes in `currentColor` and accepts `className` / `strokeWidth`
// / passthrough props (e.g. `style={{ color }}`, `aria-hidden`).
export function PunchGlyph({ className = 'w-4 h-4', strokeWidth = 2, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <StopwatchPaths />
    </svg>
  )
}

// The accent tile holding the stopwatch mark (the app logo badge). `className`
// carries the size + rounding so callers can use it small (header) or large
// (empty states); it defaults to the header badge.
export function PunchMark({ accent, className = 'w-7 h-7 rounded-lg', glyphClassName = 'w-4 h-4' }) {
  return (
    <div
      className={`${className} bg-appAccent flex items-center justify-center`}
      aria-hidden="true"
    >
      <StopwatchGlyph className={glyphClassName} color={readableInk(accent)} />
    </div>
  )
}

// The PunchIn wordmark — Noto Sans Display, capital I tinted with the accent.
export function Wordmark({ className = '' }) {
  return (
    <span
      className={`font-display font-bold text-appText tracking-tight ${className}`}
      aria-hidden="true"
    >
      Punch<span className="text-appAccent">I</span>n
    </span>
  )
}
