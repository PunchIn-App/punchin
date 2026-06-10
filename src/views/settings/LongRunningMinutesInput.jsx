import { useState, useEffect } from 'react'
import { Hourglass } from 'lucide-react'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { Wheel } from '../../components/pickers/Wheel'

// Long-running-timer threshold picker (issue #111) — now a branded popover that
// matches the other reminder controls (issue #229): tap the trigger to open a
// panel where you can TYPE the hours/minutes or SPIN the wheels, both editing the
// same value. It's a DURATION (not a clock time), so it's always 24h with no
// AM/PM — `<input type="time">` can't be forced out of its locale's 12h display,
// which is meaningless for a duration (MDN: "create a custom time input").
//
// The value is a single TOTAL minute count (mod a 24h cycle). Each wheel reports a
// step delta — minutes ±5, hours ±60 — so rolling the minutes past 55→00 carries
// into the hours (and 00→55 borrows back), and the hours wrap 23→0. The carry is
// LIVE: the minutes wheel reports its in-progress delta every scroll frame
// (`onLiveStep` → a `liveMin` preview the hours wheel reads), so the hour rolls
// over the instant you cross 55↔00 mid-spin, not only on release. Landing on
// 0h 0m switches the reminder off.
const HOURS = Array.from({ length: 24 }, (_, i) => i)       // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55 (5-min grid)
const CYCLE = 24 * 60
const WHEEL_ITEM_H = 34 // matches the TimePicker wheels

const pad2 = (n) => String(n).padStart(2, '0')
const norm = (t) => (((t % CYCLE) + CYCLE) % CYCLE)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round5 = (n) => Math.round(n / 5) * 5
const hourLabel = (v) => String(v)
const minLabel = (v) => pad2(v)

function formatDuration(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const TRIGGER_DEFAULT =
  'bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

// A big, always-typeable H/M field that lives above its wheel (mirrors the
// TimePicker's). Enter confirms — it closes the popover and hands focus back to
// the trigger. `type="text"` + inputMode numeric on purpose — `type="number"`
// reports an ARIA spinbutton role that would collide with the wheel's.
function Segment({ value, min, max, pad, onCommit, onStep, onConfirm, label }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      aria-label={label}
      value={draft != null ? draft : (pad ? pad2(value) : String(value))}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2)
        setDraft(v)
        if (v !== '') onCommit(clamp(parseInt(v, 10), min, max))
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); setDraft(null); onConfirm() }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onStep(1) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onStep(-1) }
      }}
      className="w-11 h-10 rounded-lg bg-appInput border border-appBorder text-appText text-center text-lg font-mono font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-appAccent/60"
    />
  )
}

export default function LongRunningMinutesInput({ minutes, onChange, onTurnOff, buttonClassName = '', label = 'Long-running threshold' }) {
  const raw = Number.isFinite(minutes) ? Math.round(minutes) : 60
  // Snap to the 5-min grid so a legacy off-grid value still lands on a wheel row.
  const total = norm(round5(raw))

  // Live minute delta while the minutes wheel is mid-spin (so the hour carries
  // over in real time); the committed value is untouched until the spin settles.
  const [liveMin, setLiveMin] = useState(0)
  useEffect(() => { setLiveMin(0) }, [total])

  const m = total % 60
  const liveH = Math.floor(norm(total + liveMin) / 60)

  const { open, setOpen, wrapRef, menuRef, triggerRef, menuStyle } = useAnchoredPopover({ width: 168, maxHeight: 200 })

  // Confirm-and-close: drop focus back on the trigger before the panel unmounts
  // so it never falls to <body> (WCAG 2.4.3). The trigger node stays mounted.
  const confirm = () => { setOpen(false); triggerRef.current?.focus() }

  const commit = (newTotal) => {
    const t = norm(newTotal)
    if (t === 0) onTurnOff()
    else onChange(t)
  }
  const commitHour = (h) => commit(h * 60 + (total % 60))
  const commitMin = (mm) => commit(Math.floor(total / 60) * 60 + round5(mm))

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatDuration(total)}`}
        className={`inline-flex items-center gap-2 ${buttonClassName || TRIGGER_DEFAULT}`}
      >
        <Hourglass className="w-3.5 h-3.5 flex-shrink-0 text-appTextMuted" aria-hidden="true" />
        <span className="font-mono">{formatDuration(total)}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Choose how long before reminding"
          style={menuStyle}
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-3"
        >
          <div className="flex flex-col items-center gap-2">
            {/* Type it… */}
            <div className="flex items-center gap-1.5">
              <Segment label="Hours" value={liveH} min={0} max={23} pad={false} onCommit={commitHour} onStep={(d) => commit(total + d * 60)} onConfirm={confirm} />
              <span aria-hidden="true" className="w-3 text-center text-sm font-mono text-appTextMuted">h</span>
              <Segment label="Minutes" value={m} min={0} max={55} pad onCommit={commitMin} onStep={(d) => commit(total + d * 5)} onConfirm={confirm} />
              <span aria-hidden="true" className="w-3 text-center text-sm font-mono text-appTextMuted">m</span>
            </div>
            {/* …or spin it. */}
            <div className="relative flex items-center gap-1.5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 rounded-md border-y border-appAccent/40 bg-appAccent/5"
                style={{ height: WHEEL_ITEM_H, top: '50%', transform: 'translateY(-50%)' }}
              />
              <Wheel
                values={HOURS}
                value={liveH}
                onStep={(d) => commit(total + d * 60)}
                label="Hours before a long-running timer reminder"
                format={hourLabel}
                itemH={WHEEL_ITEM_H}
                width="2.75rem"
              />
              <span aria-hidden="true" className="w-3 text-center text-xs text-appTextMuted">h</span>
              <Wheel
                values={MINUTES}
                value={m}
                onStep={(d) => commit(total + d * 5)}
                onLiveStep={(d) => setLiveMin(d * 5)}
                label="Minutes before a long-running timer reminder"
                format={minLabel}
                itemH={WHEEL_ITEM_H}
                width="2.75rem"
              />
              <span aria-hidden="true" className="w-3 text-center text-xs text-appTextMuted">m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
