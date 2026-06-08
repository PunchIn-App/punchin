import { useEffect, useState } from 'react'
import { Wheel, ITEM_H } from '../../components/pickers/Wheel'

// 24-hour duration wheel for the long-running-timer threshold (issue #111).
//
// Native <input type="time"> is the obvious control, but its 12h/24h display is
// owned by the OS/browser locale and CAN'T be forced — on a 12-hour device it
// shows AM/PM, meaningless for a *duration* (MDN: "create a custom time input").
// So this is that: two scroll-snap wheels (hours + minutes), always 24h, no
// AM/PM, on every device. The wheel mechanics (scroll-snap, wrap, keyboard)
// live in the shared `Wheel` component.
//
// The picker value is a single TOTAL minute count (mod a 24h cycle). Each wheel
// reports a step delta — the minutes wheel moves the total by ±5, the hours wheel
// by ±60 — so rolling the minutes past 55→00 carries into the hours automatically
// (and 00→55 borrows back). The carry is LIVE: the minutes wheel also reports its
// in-progress delta on every scroll frame (`onLiveStep`), so the hours wheel rolls
// over the instant you cross 55↔00 mid-spin, not only on release. Landing on
// 0h 0m switches the reminder off.
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55 (5-min grid)
const CYCLE = 24 * 60 // total wraps within a 24h cycle; minutes carry into hours

const hourLabel = (v) => String(v)
const minLabel = (v) => String(v).padStart(2, '0')

const norm = (t) => (((t % CYCLE) + CYCLE) % CYCLE)

export default function LongRunningMinutesInput({ minutes, onChange, onTurnOff }) {
  const raw = Number.isFinite(minutes) ? Math.round(minutes) : 60
  // Snap to the 5-min grid so a legacy off-grid value still lands on a wheel row.
  const total = norm(Math.round(raw / 5) * 5)

  // Live minute delta while the *minutes* wheel is mid-spin. The hours wheel reads
  // it so it carries over in real time; the committed value is untouched until the
  // spin settles. Cleared once the committed total catches up (keeps the hours
  // wheel from flicking back to the old hour on release).
  const [liveMin, setLiveMin] = useState(0)
  useEffect(() => { setLiveMin(0) }, [total])

  const m = total % 60
  const liveH = Math.floor(norm(total + liveMin) / 60)

  const commit = (newTotal) => {
    const t = norm(newTotal)
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
        value={liveH}
        onStep={(d) => commit(total + d * 60)}
        label="Hours before a long-running timer reminder"
        format={hourLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">h</span>
      <Wheel
        values={MINUTES}
        value={m}
        onStep={(d) => commit(total + d * 5)}
        onLiveStep={(d) => setLiveMin(d * 5)}
        label="Minutes before a long-running timer reminder"
        format={minLabel}
      />
      <span aria-hidden="true" className="text-xs text-appTextMuted">m</span>
    </div>
  )
}
