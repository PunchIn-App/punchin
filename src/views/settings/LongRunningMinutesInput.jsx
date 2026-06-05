// Duration picker for the long-running-timer threshold (issue #111).
//
// The reporter asked for a *picker*, not a free-text box. We use two native
// <select>s (hours + minutes) rather than <input type="time"> on purpose:
// type="time" shows AM/PM in 12-hour locales — meaningless for a *duration* and
// not reliably suppressible across browsers/OSes. On mobile each <select> opens
// the native wheel/spinner, giving the same picker feel as the time-of-day
// fields without the AM/PM nonsense. The stored value stays a minute count
// (h*60 + m). Picking 0h 0m switches the reminder off, matching the original
// "0 = off" request.
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const MAX_MINUTES = 23 * 60 + 59;

export default function LongRunningMinutesInput({ minutes, onChange, onTurnOff, className = '' }) {
  const total = Number.isFinite(minutes)
    ? Math.max(0, Math.min(MAX_MINUTES, Math.round(minutes)))
    : 60;
  const h = Math.floor(total / 60);
  const m = total % 60;

  const commit = (nh, nm) => {
    const t = nh * 60 + nm;
    if (t <= 0) onTurnOff();
    else onChange(t);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label="Hours before a long-running timer reminder"
        value={h}
        onChange={(e) => commit(Number(e.target.value), m)}
        className={className}
      >
        {HOURS.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span aria-hidden="true">h</span>
      <select
        aria-label="Minutes before a long-running timer reminder"
        value={m}
        onChange={(e) => commit(h, Number(e.target.value))}
        className={className}
      >
        {MINUTES.map((o) => (
          <option key={o} value={o}>{String(o).padStart(2, '0')}</option>
        ))}
      </select>
      <span aria-hidden="true">m</span>
    </span>
  );
}
