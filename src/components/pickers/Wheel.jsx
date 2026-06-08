import { useEffect, useRef } from 'react'

// A single scroll-snap "wheel" column — an ARIA spinbutton that touch/mouse users
// spin and keyboard users step. Extracted from the long-running-timer duration
// picker (issue #111) so the custom TimePicker reuses the exact same proven
// mechanics (scroll-snap settle, wrap-around, live carry, keyboard).
//
// The list is rendered as REPEAT stacked copies and re-centred on the middle copy
// when the value settles (it lands on identical content, so there's no visible
// jump) — that's what makes it WRAP seamlessly. `onStep(delta)` reports how many
// rows the wheel moved (+ = forward/down) once the spin settles; the parent maps
// that to a change in its value. `onLiveStep(delta)` (optional) reports the same
// delta continuously *during* the spin so a sibling wheel can preview a carry in
// real time.
export const ITEM_H = 30 // px per row
export const VISIBLE = 3 // rows shown: 1 above, the selection, 1 below
const REPEAT = 5 // copies of the list (buffer for wrap-around)
const CENTER = Math.floor(REPEAT / 2)
const PAD = (VISIBLE - 1) / 2

export function Wheel({ values, value, onStep, onLiveStep, label, format }) {
  const ref = useRef(null)
  const settle = useRef(0)
  const lastLive = useRef(0)
  const N = values.length
  const baseIdx = Math.max(0, values.indexOf(value))
  const scrollFor = (vi) => (CENTER * N + vi - PAD) * ITEM_H
  const stepsFromScroll = (el) =>
    Math.round(el.scrollTop / ITEM_H) + PAD - (CENTER * N + baseIdx)

  // Centre the current value on the middle copy (mount + external change).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = scrollFor(baseIdx)
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [baseIdx, N]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a pending settle if the wheel unmounts mid-spin.
  useEffect(() => () => clearTimeout(settle.current), [])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    // Report the in-progress delta live (once per row crossed) so the parent can
    // roll the sibling wheel over before the spin settles.
    if (onLiveStep) {
      const steps = stepsFromScroll(el)
      if (steps !== lastLive.current) {
        lastLive.current = steps
        onLiveStep(steps)
      }
    }
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      lastLive.current = 0
      const steps = stepsFromScroll(el) // el captured — safe after unmount
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
