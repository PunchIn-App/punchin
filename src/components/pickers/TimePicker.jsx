import { useState } from 'react'
import { Clock } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { is24Hour, formatTime } from '../../utils/time'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { Wheel } from './Wheel'

// A branded clock picker — the tap-and-pick (and type!) replacement for native
// <input type="time"> (issue #229). Unlike the native control it honours the
// app's `timeFormat` (auto / 12h / 24h), which the OS picker owns and can't be
// told. Every value in/out is a 24-hour "HH:MM" string, so it drops into each
// existing call site unchanged.
//
// The popover offers BOTH ways to set a time, always, on every device: type into
// the big H/M fields (the desktop-keyboard answer to issue #229's "I can't just
// type the numbers") or spin the wheels (great on touch). Both edit the same
// value and stay in sync — no device sniffing, no mode toggle.
const pad2 = (n) => String(n).padStart(2, '0')
const HOURS24 = Array.from({ length: 24 }, (_, i) => i)     // 0..23
const HOURS12 = Array.from({ length: 12 }, (_, i) => i + 1)  // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i)      // 0..59
const WHEEL_ITEM_H = 34 // roomier than the shared 30px default

function parse(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!m) return [0, 0]
  return [Math.min(23, +m[1]), Math.min(59, +m[2])]
}

const to12 = (h) => ({ displayH: (h % 12) || 12, period: h < 12 ? 'AM' : 'PM' })
const to24 = (displayH, period) => (displayH % 12) + (period === 'PM' ? 12 : 0)
const wrap = (n, max) => ((n % max) + max) % max
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

const TRIGGER_DEFAULT =
  'bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

// A big, always-typeable H/M field that lives directly above its wheel. Typing
// commits live (so closing the popover keeps what you typed); ↑/↓ step the value.
// Enter confirms — it closes the popover and hands focus back to the trigger.
// `type="text"` + inputMode numeric on purpose — `type="number"` reports an ARIA
// spinbutton role that would collide with the wheel's.
function Segment({ value, min, max, onCommit, onStep, onConfirm, label }) {
  const [draft, setDraft] = useState(null) // raw text while focused; null = show canonical

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      aria-label={label}
      value={draft != null ? draft : pad2(value)}
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

export default function TimePicker({ value, onChange, label = 'Time', buttonClassName = '', className = 'inline-block', id }) {
  const { settings } = useSettings()
  const use24 = is24Hour(settings.timeFormat)
  const [h, m] = parse(value)
  const { displayH, period } = to12(h)

  const PANEL_W = use24 ? 152 : 200
  const { open, setOpen, wrapRef, menuRef, triggerRef, menuStyle } = useAnchoredPopover({ width: PANEL_W, maxHeight: 200 })

  // Confirm-and-close: drop focus back on the trigger before the panel unmounts
  // so it never falls to <body> (WCAG 2.4.3). The trigger node stays mounted.
  const confirm = () => { setOpen(false); triggerRef.current?.focus() }

  const emit = (nh, nm) => onChange(`${pad2(nh)}:${pad2(nm)}`)
  const stepHour = (d) => {
    if (use24) emit(wrap(h + d, 24), m)
    else emit(to24(wrap(displayH - 1 + d, 12) + 1, period), m)
  }
  const stepMin = (d) => emit(h, wrap(m + d, 60))
  const setPeriod = (p) => { if (p !== period) emit(to24(displayH, p), m) }
  const commitHour = (val) => (use24 ? emit(val, m) : emit(to24(val, period), m))
  const commitMin = (val) => emit(h, val)

  const display = formatTime(new Date(2000, 0, 1, h, m), settings.timeFormat)

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${display}`}
        className={`inline-flex items-center gap-2 ${buttonClassName || TRIGGER_DEFAULT}`}
      >
        <Clock className="w-3.5 h-3.5 flex-shrink-0 text-appTextMuted" aria-hidden="true" />
        <span className="font-mono">{display}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          style={menuStyle}
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-3"
        >
          <div className="flex items-stretch justify-center gap-2">
            {/* Type or spin — same value, aligned columns: each field sits over its wheel. */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Segment label="Hour" value={use24 ? h : displayH} min={use24 ? 0 : 1} max={use24 ? 23 : 12} onCommit={commitHour} onStep={stepHour} onConfirm={confirm} />
                <span aria-hidden="true" className="w-2 text-center text-lg font-mono text-appTextMuted">:</span>
                <Segment label="Minute" value={m} min={0} max={59} onCommit={commitMin} onStep={stepMin} onConfirm={confirm} />
              </div>
              <div className="relative flex items-center gap-1.5">
                {/* Centered selection band across the wheels. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 rounded-md border-y border-appAccent/40 bg-appAccent/5"
                  style={{ height: WHEEL_ITEM_H, top: '50%', transform: 'translateY(-50%)' }}
                />
                <Wheel
                  values={use24 ? HOURS24 : HOURS12}
                  value={use24 ? h : displayH}
                  onStep={stepHour}
                  label={`Hours (${label})`}
                  format={use24 ? pad2 : String}
                  itemH={WHEEL_ITEM_H}
                  width="2.75rem"
                />
                <span aria-hidden="true" className="w-2 text-center text-appTextMuted font-mono">:</span>
                <Wheel
                  values={MINUTES}
                  value={m}
                  onStep={stepMin}
                  label={`Minutes (${label})`}
                  format={pad2}
                  itemH={WHEEL_ITEM_H}
                  width="2.75rem"
                />
              </div>
            </div>

            {!use24 && (
              <div className="flex flex-col justify-center gap-1" role="radiogroup" aria-label="AM or PM">
                {['AM', 'PM'].map(p => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={period === p}
                    onClick={() => setPeriod(p)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      period === p ? 'bg-appAccent text-appOnAccent' : 'text-appTextMuted hover:bg-appInput'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
