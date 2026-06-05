import { useEffect, useRef, useState } from 'react'

// The long-running-timer threshold is a free-text number field. While the user
// is editing we keep their raw keystrokes — including a momentarily empty field
// — in local state instead of coercing on every change. The old
// `Number(value) || 60` snapped an emptied field straight back to 60, so it was
// impossible to backspace it clear and retype (issue #111).
//
// A clean, in-range value commits live (preserving the prior save-as-you-type
// behaviour); on blur an empty or zero value reads as "I don't want this
// reminder" and switches it off via `onTurnOff` — mirroring how clearing the
// last weekday turns a time-of-day reminder off. An over-max value is clamped to
// 1440 on blur.
export default function LongRunningMinutesInput({ minutes, onChange, onTurnOff, className = '' }) {
  const [draft, setDraft] = useState(String(minutes))
  const editing = useRef(false)

  // Reflect external changes (re-enable, cloud sync) only when the field isn't
  // being edited, so a live update never yanks text out from under the user.
  useEffect(() => {
    if (!editing.current) setDraft(String(minutes))
  }, [minutes])

  const commit = (raw) => {
    const n = parseInt(raw, 10)
    if (!raw.trim() || !Number.isFinite(n) || n <= 0) {
      onTurnOff()
      return
    }
    const clamped = Math.min(1440, Math.max(1, n))
    onChange(clamped)
    setDraft(String(clamped))
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min="1"
      max="1440"
      value={draft}
      onFocus={() => { editing.current = true }}
      onChange={e => {
        const raw = e.target.value
        setDraft(raw)
        // Commit a clean, in-range value as it's typed; empty / 0 / out-of-range
        // are deferred to blur so intermediate keystrokes survive.
        const n = parseInt(raw, 10)
        if (Number.isFinite(n) && n >= 1 && n <= 1440) onChange(n)
      }}
      onBlur={e => { editing.current = false; commit(e.target.value) }}
      aria-label="Minutes before a long-running timer reminder"
      className={className}
    />
  )
}
