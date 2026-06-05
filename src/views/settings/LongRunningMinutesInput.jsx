import { useEffect, useRef } from 'react'

// 24-hour duration wheel for the long-running-timer threshold (issue #111).
//
// Native <input type="time"> is the obvious control, but its 12h/24h display is
// owned by the OS/browser locale and CAN'T be forced — on a 12-hour device it
// shows AM/PM, meaningless for a *duration* (MDN: "create a custom time input").
// So this is that: two scroll-snap "wheels" (hours + minutes), always 24h, no
// AM/PM, on every device. Each wheel is an ARIA spinbutton (keyboard + screen
// reader); touch/mouse users spin it. The stored value stays a minute count
// (h*60 + m); landing on 0h 0m switches the reminder off.
//
// The wheels WRAP: each value list is rendered as several stacked copies and,
// after a spin settles, the scroll position is silently recentered onto the
// middle copy (it lands on identical content, so there's no visible jump) — an
// endless wheel without an actual infinite list. Arrow keys wrap modularly.
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55 (5-min grid)
const MAX_MINUTES = 23 * 60 + 55
const ITEM_H = 30 // px per row
const VISIBLE = 3 // rows shown: 1 above, the selection, 1 below
const REPEAT = 5 // copies of the list (buffer for wrap-around)
const CENTER = Math.floor(REPEAT / 2)
const PAD = (VISIBLE - 1) / 2

function Wheel({ values, value, onChange, label, format }) {
  const ref = useRef(null)
  const settle = useRef(0)
  const N = values.length

  // scrollTop that centres `valueIndex` on the middle copy.
  const scrollFor = (vi) => (CENTER * N + vi - PAD) * ITEM_H

  // Centre the current value on the middle copy (mount + external/keyboard change).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = scrollFor(Math.max(0, values.indexOf(value)))
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [value, N]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const flat = Math.round(el.scrollTop / ITEM_H) + PAD
      const vi = ((flat % N) + N) % N
      // Recentre onto the middle copy — identical content, so it's invisible.
      el.scrollTop = scrollFor(vi)
      if (values[vi] !== value) onChange(values[vi])
    }, 110)
  }

  const wrap = (delta) => {
    const vi = (((values.indexOf(value) + delta) % N) + N) % N
    onChange(values[vi])
  }
  const onKeyDown = (e) => {
    const by = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 }[e.key]
    if (by !== undefined) { e.preventDefault(); wrap(by) }
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={values[0]}
      aria-valuemax={values[N - 1]}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className="wheel-col font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-appAccent/50"
      style={{ height: VISIBLE * ITEM_H, width: '2.25rem' }}
    >
      {Array.from({ length: REPEAT * N }, (_, k) => values[k % N]).map((v, k) => (
        <div
          key={k}
          aria-hidden="true"
          className="flex items-center justify-center text-appText"
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
        >
          {format(v)}
        </div>
      ))}
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
