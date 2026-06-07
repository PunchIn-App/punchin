// The PunchIn brand identity, shared by the phone header and the desktop sidebar.
//   - PunchMark: the stopwatch glyph on the accent tile (the app logo badge)
//   - Wordmark:  "PunchIn" in Noto Sans Display with the accent-tinted capital I
// The mark glyph flips white/dark via readableInk so it reads on any accent;
// the geometry mirrors src/iconSvg.js (the favicon / install-icon source).
import { readableInk } from '../utils/inkOnAccent'

// The stopwatch glyph (crown + stem + body + clock hands), stroked in `color`.
export function StopwatchGlyph({ className = 'w-4 h-4', color }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 2.6h5" />
      <path d="M12 2.6v2.4" />
      <circle cx="12" cy="13.4" r="8.2" />
      <path d="M12 13.4V8.6" />
      <path d="M12 13.4l3 1.9" />
      <circle cx="12" cy="13.4" r="0.9" fill={color} stroke="none" />
    </svg>
  )
}

// The accent tile holding the stopwatch mark (the app logo badge).
export function PunchMark({ accent, className = 'w-7 h-7', glyphClassName = 'w-4 h-4' }) {
  return (
    <div
      className={`${className} rounded-lg bg-appAccent flex items-center justify-center`}
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
