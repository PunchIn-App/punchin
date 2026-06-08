// The PunchIn brand identity, shared by the phone header and the desktop sidebar.
//   - PunchMark: the stopwatch glyph on the accent tile (the app logo badge)
//   - Wordmark:  "PunchIn" in Noto Sans Display with the accent-tinted capital I
// The mark glyph flips white/dark via readableInk so it reads on any accent;
// the geometry mirrors src/iconSvg.js (the favicon / install-icon source).
import { readableInk } from '../utils/inkOnAccent'

// The stopwatch path geometry (crown + stem + body + clock hands), mirroring
// src/iconSvg.js. Stroke + the centre dot use `currentColor` so the colour is
// driven by the SVG's resolved text colour — set it via the `color` prop on
// StopwatchGlyph, or an inline `style`/inherited colour on PunchGlyph.
function StopwatchPaths() {
  return (
    <>
      <path d="M9.5 2.6h5" />
      <path d="M12 2.6v2.4" />
      <circle cx="12" cy="13.4" r="8.2" />
      <path d="M12 13.4V8.6" />
      <path d="M12 13.4l3 1.9" />
      <circle cx="12" cy="13.4" r="0.9" fill="currentColor" stroke="none" />
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
