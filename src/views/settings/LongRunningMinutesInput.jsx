import { useEffect, useRef } from 'react'

// 24-hour duration wheel for the long-running-timer threshold (issue #111).
//
// Native <input type="time"> is the obvious control, but its 12h/24h display is
// owned by the OS/browser locale and CAN'T be forced — on a 12-hour device it
// shows AM/PM, which is meaningless for a *duration* (MDN: "you would need to
// create a custom time input solution"). So this is that custom control: two
// scroll-snap "wheels" (hours + minutes), always 24h, no AM/PM, on every device.
// Each wheel is an ARIA spinbutton so it's keyboard- and screen-reader-operable;
// touch/mouse users spin it. The stored value stays a minute count (h*60 + m);
// landing on 0h 0m switches the reminder off (the original "0 = off" request).
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55 (5-min grid)
const MAX_MINUTES = 23 * 60 + 55 // 23h55m — the top of the 5-min grid
const ITEM_H = 30 // px per row
const VISIBLE = 5 // odd; the middle row is the selection

function Wheel({ values, value, onChange, label, format }) {
  const ref = useRef(null)
  const settle = useRef(0)

  // Keep the wheel scrolled to the current value (mount + external change),
  // unless the user's own scroll already has it there.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = Math.max(0, values.indexOf(value)) * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [value, values])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)))
      if (values[idx] !== value) onChange(values[idx])
    }, 90)
  }

  const move = (delta) => {
    const idx = Math.max(0, Math.min(values.length - 1, values.indexOf(value) + delta))
    if (values[idx] !== value) onChange(values[idx])
  }
  const onKeyDown = (e) => {
    const by = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key]
    if (by !== undefined) { e.preventDefault(); move(by) }
    else if (e.key === 'Home') { e.preventDefault(); onChange(values[0]) }
    else if (e.key === 'End') { e.preventDefault(); onChange(values[values.length - 1]) }
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM_H
  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className="wheel-col font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-appAccent/50"
      style={{ height: VISIBLE * ITEM_H, width: '2.25rem' }}
    >
      <div style={{ height: pad }} aria-hidden="true" />
      {values.map((v) => (
        <div
          key={v}
          aria-hidden="true"
          className={`flex items-center justify-center ${v === value ? 'text-appText' : 'text-appTextMuted opacity-50'}`}
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
        >
          {format(v)}
        </div>
      ))}
      <div style={{ height: pad }} aria-hidden="true" />
    </div>
  )
}

const hourLabel = (v) => String(v)
const minLabel = (v) => String(v).padStart(2, '0')

export default function LongRunningMinutesInput({ minutes, onChange, onTurnOff }) {
  const raw = Number.isFinite(minutes) ? Math.round(minutes) : 60
  // Snap to the 5-min grid so a legacy off-grid value still lands on a wheel row.
  const total = Math.max(0, Math.min(MAX_MINUTES, Math.round(raw / 5) * 5))
  const h = Math.floor(total / 60)
  const m = total % 60

  const commit = (nh, nm) => {
    const t = nh * 60 + nm
    if (t <= 0) onTurnOff()
    else onChange(t)
  }

  return (
    <div role="group" aria-label="Notify after" className="relative inline-flex items-center gap-1">
      {/* Centered selection band across both wheels. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md border-y border-appAccent/40 bg-appAccent/5"
        style={{ height: ITEM_H }}
      />
      <Wheel
        values={HOURS}
        value={h}
        onChange={(nh) => commit(nh, m)}
        label="Hours before a long-running timer reminder"
        format={hourLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">h</span>
      <Wheel
        values={MINUTES}
        value={m}
        onChange={(nm) => commit(h, nm)}
        label="Minutes before a long-running timer reminder"
        format={minLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">m</span>
    </div>
  )
}
