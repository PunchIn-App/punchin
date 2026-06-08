import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'

// A branded calendar picker — the popover replacement for native
// <input type="date"> (issue #229), matching the dropdowns/TimePicker. Value
// in/out is a "YYYY-MM-DD" string (local date, no timezone shift), so it drops
// into the EditEntryModal date fields unchanged.
//
// Mouse/touch users tap a day; keyboard users Tab to the grid and arrow around
// (←/→ a day, ↑/↓ a week, PageUp/PageDown a month, Enter selects) — the desktop
// answer to "let me drive it without the OS popover", parallel to the
// TimePicker's typeable fields.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const pad2 = (n) => String(n).padStart(2, '0')
const toISO = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n)
const startOfMonth = (dt) => new Date(dt.getFullYear(), dt.getMonth(), 1)
const lastDayOfMonth = (y, mo) => new Date(y, mo + 1, 0).getDate()
const sameYMD = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function parseISO(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!m) return null
  const dt = new Date(+m[1], +m[2] - 1, +m[3])
  return isNaN(dt.getTime()) ? null : dt
}

const TRIGGER_DEFAULT =
  'bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

export default function DatePicker({ value, onChange, label = 'Date', buttonClassName = '', className = 'inline-block', id }) {
  const selected = parseISO(value)
  const today = new Date()
  const { open, setOpen, wrapRef, menuRef, menuStyle } = useAnchoredPopover({ width: 280, maxHeight: 348 })

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISO(value) ?? new Date()))
  const [focusDate, setFocusDate] = useState(() => parseISO(value) ?? new Date())

  // Re-centre on the selected month (or today) each time the popover opens.
  useEffect(() => {
    if (!open) return
    const base = parseISO(value) ?? new Date()
    setViewMonth(startOfMonth(base))
    setFocusDate(base)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep DOM focus on the roving day as the keyboard cursor moves — but only
  // while the grid already holds focus, so opening (or a mouse month-flip)
  // doesn't yank focus into the calendar.
  const dayRefs = useRef(new Map())
  useEffect(() => {
    if (!open) return
    if (menuRef.current?.contains(document.activeElement)) {
      dayRefs.current.get(toISO(focusDate))?.focus()
    }
  }, [focusDate, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (dt) => { onChange(toISO(dt)); setOpen(false) }

  const moveMonth = (n) => {
    const nv = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + n, 1)
    setViewMonth(nv)
    setFocusDate((f) => new Date(nv.getFullYear(), nv.getMonth(), Math.min(f.getDate(), lastDayOfMonth(nv.getFullYear(), nv.getMonth()))))
  }

  const onGridKeyDown = (e) => {
    const byDays = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (byDays !== undefined) {
      e.preventDefault()
      const next = addDays(focusDate, byDays)
      setFocusDate(next)
      if (next.getMonth() !== viewMonth.getMonth() || next.getFullYear() !== viewMonth.getFullYear()) {
        setViewMonth(startOfMonth(next))
      }
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      moveMonth(e.key === 'PageUp' ? -1 : 1)
    }
  }

  const gridStart = addDays(viewMonth, -viewMonth.getDay()) // Sunday on/before the 1st
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const triggerText = selected
    ? `${MONTHS_SHORT[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
    : 'Select date'

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${triggerText}`}
        className={`inline-flex items-center gap-2 ${buttonClassName || TRIGGER_DEFAULT}`}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-appTextMuted" aria-hidden="true" />
        <span>{triggerText}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          style={menuStyle}
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-3"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg text-appTextMuted hover:bg-appInput hover:text-appText transition-colors">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="text-sm font-semibold text-appText" aria-live="polite">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </div>
            <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="p-1.5 rounded-lg text-appTextMuted hover:bg-appInput hover:text-appText transition-colors">
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-appTextMuted py-1" aria-hidden="true">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div role="grid" aria-label={`Choose ${label.toLowerCase()}`} className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKeyDown}>
            {cells.map((dt) => {
              const inMonth = dt.getMonth() === viewMonth.getMonth()
              const isSel = selected && sameYMD(dt, selected)
              const isToday = sameYMD(dt, today)
              const isFocus = sameYMD(dt, focusDate)
              return (
                <button
                  key={toISO(dt)}
                  ref={(el) => { if (el) dayRefs.current.set(toISO(dt), el); else dayRefs.current.delete(toISO(dt)) }}
                  type="button"
                  tabIndex={isFocus ? 0 : -1}
                  aria-label={`${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`}
                  aria-pressed={isSel || undefined}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => select(dt)}
                  className={[
                    'h-9 rounded-lg text-sm font-mono tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-appAccent/60',
                    isSel
                      ? 'bg-appAccent text-appOnAccent font-bold'
                      : inMonth ? 'text-appText hover:bg-appInput' : 'text-appTextDisabled hover:bg-appInput',
                    !isSel && isToday ? 'ring-1 ring-inset ring-appAccent/50' : '',
                  ].join(' ')}
                >
                  {dt.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
