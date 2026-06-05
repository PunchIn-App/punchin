import { useEffect, useRef } from 'react'

// 24-hour duration wheel for the long-running-timer threshold (issue #111).
//
// Native <input type="time"> is the obvious control, but its 12h/24h display is
// owned by the OS/browser locale and CAN'T be forced — on a 12-hour device it
// shows AM/PM, meaningless for a *duration* (MDN: "create a custom time input").
// So this is that: two scroll-snap "wheels" (hours + minutes), always 24h, no
// AM/PM, on every device. Each wheel is an ARIA spinbutton (keyboard + screen
// reader); touch/mouse users spin it.
//
// The picker value is a single TOTAL minute count (mod a 24h cycle). Each wheel
// reports a step delta — the minutes wheel moves the total by ±5, the hours wheel
// by ±60 — so rolling the minutes past 55→00 carries into the hours automatically
// (and 00→55 borrows back). The wheels also WRAP: each list is rendered as REPEAT
// stacked copies and re-centred on the middle copy when the value settles (it
// lands on identical content, so there's no visible jump). Landing on 0h 0m
// switches the reminder off.
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55 (5-min grid)
const CYCLE = 24 * 60 // total wraps within a 24h cycle; minutes carry into hours
const ITEM_H = 30 // px per row
const VISIBLE = 3 // rows shown: 1 above, the selection, 1 below
const REPEAT = 5 // copies of the list (buffer for wrap-around)
const CENTER = Math.floor(REPEAT / 2)
const PAD = (VISIBLE - 1) / 2

// `onStep(delta)` reports how many rows the wheel moved (+ = forward/up); the
// parent maps that to a change in the total.
function Wheel({ values, value, onStep, label, format }) {
  const ref = useRef(null)
  const settle = useRef(0)
  const N = values.length
  const baseIdx = Math.max(0, values.indexOf(value))
  const scrollFor = (vi) => (CENTER * N + vi - PAD) * ITEM_H

  // Centre the current value on the middle copy (mount + external change).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = scrollFor(baseIdx)
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [baseIdx, N]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const flat = Math.round(el.scrollTop / ITEM_H) + PAD
      const steps = flat - (CENTER * N + baseIdx)
      if (steps !== 0) onStep(steps)
      else el.scrollTop = scrollFor(baseIdx) // re-snap exactly to centre
    }, 110)
  }

  const onKeyDown = (e) => {
    const by = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 }[e.key]
    if (by !== undefined) { e.preventDefault(); onStep(by) }
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
  const total = ((((Math.round(raw / 5) * 5) % CYCLE) + CYCLE) % CYCLE)
  const h = Math.floor(total / 60)
  const m = total % 60

  const commit = (newTotal) => {
    const t = (((newTotal % CYCLE) + CYCLE) % CYCLE)
    if (t === 0) onTurnOff()
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
        onStep={(d) => commit(total + d * 60)}
        label="Hours before a long-running timer reminder"
        format={hourLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">h</span>
      <Wheel
        values={MINUTES}
        value={m}
        onStep={(d) => commit(total + d * 5)}
        label="Minutes before a long-running timer reminder"
        format={minLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">m</span>
    </div>
  )
}
