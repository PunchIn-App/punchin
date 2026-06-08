import { Clock } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { is24Hour, formatTime } from '../../utils/time'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { Wheel, ITEM_H } from './Wheel'

// A branded clock picker — the tap-and-pick replacement for native
// <input type="time"> (issue #229). Unlike the native control, it honours the
// app's `timeFormat` setting (auto / 12h / 24h), which the OS picker owns and
// can't be told. Value in/out is a 24-hour "HH:MM" string, so it drops into
// every existing call site unchanged.
const pad2 = (n) => String(n).padStart(2, '0')
const HOURS24 = Array.from({ length: 24 }, (_, i) => i)     // 0..23
const HOURS12 = Array.from({ length: 12 }, (_, i) => i + 1)  // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i)      // 0..59

function parse(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!m) return [0, 0]
  return [Math.min(23, +m[1]), Math.min(59, +m[2])]
}

const to12 = (h) => ({ displayH: (h % 12) || 12, period: h < 12 ? 'AM' : 'PM' })
const to24 = (displayH, period) => (displayH % 12) + (period === 'PM' ? 12 : 0)
const wrap = (n, max) => ((n % max) + max) % max

const TRIGGER_DEFAULT =
  'bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

export default function TimePicker({ value, onChange, label = 'Time', buttonClassName = '', className = 'inline-block', id }) {
  const { settings } = useSettings()
  const use24 = is24Hour(settings.timeFormat)
  const [h, m] = parse(value)
  const { displayH, period } = to12(h)

  const PANEL_W = use24 ? 132 : 196
  const { open, setOpen, wrapRef, menuRef, menuStyle } = useAnchoredPopover({ width: PANEL_W, maxHeight: 120 })

  const emit = (nh, nm) => onChange(`${pad2(nh)}:${pad2(nm)}`)
  const stepHour = (d) => {
    if (use24) emit(wrap(h + d, 24), m)
    else emit(to24(wrap(displayH - 1 + d, 12) + 1, period), m)
  }
  const stepMin = (d) => emit(h, wrap(m + d, 60))
  const setPeriod = (p) => { if (p !== period) emit(to24(displayH, p), m) }

  const display = formatTime(new Date(2000, 0, 1, h, m), settings.timeFormat)

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
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
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-2"
        >
          <div className="relative flex items-center justify-center gap-1">
            {/* Centered selection band across the wheels. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 my-auto left-0 right-0 rounded-md border-y border-appAccent/40 bg-appAccent/5"
              style={{ height: ITEM_H, top: '50%', transform: 'translateY(-50%)' }}
            />
            <Wheel
              values={use24 ? HOURS24 : HOURS12}
              value={use24 ? h : displayH}
              onStep={stepHour}
              label={`Hours (${label})`}
              format={use24 ? pad2 : String}
            />
            <span aria-hidden="true" className="text-appTextMuted font-mono">:</span>
            <Wheel
              values={MINUTES}
              value={m}
              onStep={stepMin}
              label={`Minutes (${label})`}
              format={pad2}
            />
            {!use24 && (
              <div className="ml-1 flex flex-col gap-1" role="radiogroup" aria-label="AM or PM">
                {['AM', 'PM'].map(p => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={period === p}
                    onClick={() => setPeriod(p)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
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
