import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

// Shared Settings primitives, extracted from the SettingsView monolith so each
// panel can compose them (issue #144).

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export function Toggle({ value, onChange, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border-2
        ${value ? 'bg-appAccent border-appAccent' : 'bg-appInput border-gray-500/60'}`}
    >
      <span className={`absolute top-[1px] left-[1px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform
        ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export function SettingsRow({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 text-appTextMuted flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-appText font-medium">{title}</p>
          {subtitle && <p className="text-xs text-appTextMuted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

// A reminder sub-option: a labelled toggle row with an optional control area
// (time / minutes / weekday) revealed when the toggle is on (issue #54).
export function ReminderRow({ icon: Icon, title, subtitle, enabled, onToggle, children }) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-appText font-medium">{title}</p>
            {subtitle && <p className="text-xs text-appTextMuted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <Toggle value={enabled} onChange={onToggle} ariaLabel={title} />
      </div>
      {enabled && children && <div className="mt-3 pl-7 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// Seven toggle chips (Sun–Sat) letting a time-of-day reminder fire only on the
// chosen weekdays. `value` is an array of weekday numbers (0=Sun … 6=Sat);
// undefined is treated as every day so pre-existing reminders are unaffected.
// `weekStartsMonday` rotates the DISPLAY order only (Mon-first); the stored
// values stay absolute weekday indices (0=Sun … 6=Sat), so reminder day arrays
// are unaffected by the display preference.
export function WeekdayPicker({ value, onChange, label, weekStartsMonday }) {
  const days = Array.isArray(value) ? value : ALL_DAYS
  const order = weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : ALL_DAYS
  const toggle = (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b)
    onChange(next)
  }
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {order.map((d) => {
        const on = days.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={on}
            aria-label={WEEKDAYS[d]}
            className={`w-7 h-7 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-appAccent/50
              ${on ? 'bg-appAccent text-appOnAccent' : 'bg-appBg text-appText border border-appBorder hover:bg-appInput'}`}
          >
            {WEEKDAY_INITIALS[d]}
          </button>
        )
      })}
    </div>
  )
}

// A tappable category row on the Settings root list. Drilling in shows that
// category's own sub-page (iOS-style master → detail), replacing the former
// single-open accordion so nothing collapses underfoot (issue #60).
export function CategoryRow({ icon: Icon, title, subtitle, badge, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full flex items-center justify-between gap-3 px-4 py-4 transition-colors text-left first:rounded-t-xl last:rounded-b-xl
        ${active ? 'bg-appInput' : 'hover:bg-appInput'}`}
    >
      {/* Accent rail marks the selected category in the desktop master-detail rail. */}
      {active && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-appAccent" />}
      <span className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-appAccent' : 'text-appTextMuted'}`} aria-hidden="true" />}
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-appText">{title}</span>
            {badge && <span className="w-2 h-2 rounded-full bg-appAccent flex-shrink-0" aria-hidden="true" />}
          </span>
          {subtitle && <span className="block text-xs text-appTextMuted mt-0.5">{subtitle}</span>}
        </span>
      </span>
      {/* Chevron implies drill-in (mobile); the desktop rail selects in place. */}
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-appTextMuted lg:hidden" aria-hidden="true" />
    </button>
  )
}

// A drilled-in sub-page: an iOS-style back affordance ("‹ Settings") plus the
// category title, then the section's content. The Back button unwinds the
// pushed history entry so the hardware/gesture Back gesture composes with it.
export function Panel({ title, onBack, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1 lg:hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 -ml-1.5 pr-2 py-1 rounded-lg text-appAccent text-sm font-medium hover:bg-appInput transition-colors"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          Settings
        </button>
      </div>
      <h2 className="text-xl font-display font-extrabold text-appText mb-3 px-1">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// A labelled group within a sub-page (used inside Data &amp; Sync to keep
// Backup / Sync / Transfer / Danger Zone visually distinct).
export function PanelGroup({ title, danger, children, collapsible, defaultCollapsed }) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed)
  const titleCls = `text-xs font-semibold uppercase tracking-wide ${danger ? 'text-red-400' : 'text-appTextMuted'}`
  if (!collapsible) {
    return (
      <div>
        <h3 className={`${titleCls} px-1 mb-2`}>{title}</h3>
        {children}
      </div>
    )
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className={`${titleCls} flex items-center gap-1 px-1 mb-2 hover:opacity-80 transition-opacity`}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
        {title}
      </button>
      {!collapsed && children}
    </div>
  )
}
