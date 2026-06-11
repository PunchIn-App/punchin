import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
} from 'date-fns'

/** @typedef {import('../db').Entry} Entry */

/** @param {number} ms @returns {string} */
export function formatElapsed(ms) {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

/** @param {number} ms @returns {string} */
export function formatDurationHM(ms) {
  const total = Math.floor(Math.abs(ms) / 60000)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Decimal-hours string for billing display, e.g. 5_400_000 → "1.50 h" (issue
 * #208). Two decimals match the invoice/CSV convention.
 * @param {number} ms @returns {string}
 */
export function formatDecimalHours(ms) {
  return `${(Math.abs(ms) / 3600000).toFixed(2)} h`
}

/**
 * A duration in the user's chosen display format: decimal hours ("1.50 h") when
 * `decimal` is set, otherwise the compact "Xh Ym" form (issue #208).
 * @param {number} ms @param {boolean} [decimal] @returns {string}
 */
export function formatDuration(ms, decimal) {
  return decimal ? formatDecimalHours(ms) : formatDurationHM(ms)
}

/**
 * Round a worked DURATION (milliseconds) to a billing increment of `minutes` —
 * the per-task billing model (issue #274). `mode` is 'nearest' (default — the
 * standard "round to the nearest 15 min") or 'up' (round each task UP, so a short
 * task is never lost). Rounding OFF (`minutes` 0/undefined) or a sub-minute
 * duration passes through unchanged, so a ~0-duration entry isn't inflated to a
 * full increment. Rounding DURATIONS (not start/end times) means two independent
 * entries can never double-count a shared task-switch boundary — and per-entry
 * rounded hours stay correct when each task bills at its own rate.
 * @param {number} ms @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {number} ms
 */
export function roundDurationMs(ms, minutes, mode = 'nearest') {
  if (!minutes || ms < 60000) return ms
  const inc = minutes * 60000
  return (mode === 'up' ? Math.ceil(ms / inc) : Math.round(ms / inc)) * inc
}

/** @param {Entry} entry @returns {number} milliseconds */
export function getEntryDuration(entry) {
  const end = entry.punchOut ? new Date(entry.punchOut) : new Date()
  return end.getTime() - new Date(entry.punchIn).getTime()
}

// The device's 12h/24h preference, used when timeFormat is 'auto' (the default).
// Resolve the hour cycle from the device's FULLY-resolved locale: on Android
// Chrome the OS "use 24-hour time" toggle surfaces as a `-u-hc-h23` Unicode
// extension on navigator.languages[0], so prefer that over the bare runtime
// default. Read `hourCycle` (h11/h12 = 12-hour, h23/h24 = 24-hour) rather than
// `hour12`, which several engines leave `undefined` (the old `?? true` then wrongly
// defaulted everyone to 12-hour — issue #264). NB: iOS Safari does not expose the
// OS clock override to JS, so 'auto' there can only follow the locale convention.
function deviceHour12() {
  try {
    const loc = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || undefined
    const hc = new Intl.DateTimeFormat(loc, { hour: 'numeric' }).resolvedOptions().hourCycle
    return hc === 'h11' || hc === 'h12'
  } catch {
    return true
  }
}

/**
 * Whether to render clock time in 24-hour form for the given preference.
 * `'auto'` (and any non-`'12h'`/`'24h'` value) falls back to the device's
 * locale preference. Shared by formatTime and the custom TimePicker so the
 * branded picker honours the same 12/24h choice the native input couldn't.
 * @param {'auto'|'12h'|'24h'} [fmt] @returns {boolean}
 */
export function is24Hour(fmt = 'auto') {
  return fmt === '24h' || (fmt !== '12h' && !deviceHour12())
}

/** @param {Date|string|number} date @param {'auto'|'12h'|'24h'} [fmt] @returns {string} */
export function formatTime(date, fmt = 'auto') {
  return format(new Date(date), is24Hour(fmt) ? 'HH:mm' : 'h:mm a')
}

/** @param {Date|string|number} date @returns {string} */
export function formatDate(date) {
  return format(new Date(date), 'EEE, MMM d')
}

/** @param {Date} [date] @returns {{ start: Date, end: Date }} */
export function getDayRange(date = new Date()) {
  return { start: startOfDay(date), end: endOfDay(date) }
}

/** @param {Date} [date] @param {boolean} [weekStartsMonday] @returns {{ start: Date, end: Date }} */
export function getWeekRange(date = new Date(), weekStartsMonday = true) {
  const weekStartsOn = weekStartsMonday ? 1 : 0
  return {
    start: startOfWeek(date, { weekStartsOn }),
    end:   endOfWeek(date,   { weekStartsOn }),
  }
}

/** @param {Date} [date] @param {boolean} [weekStartsMonday] @returns {Date[]} */
export function getWeekDays(date = new Date(), weekStartsMonday = true) {
  const { start, end } = getWeekRange(date, weekStartsMonday)
  return eachDayOfInterval({ start, end })
}

/** @param {Entry} entry @param {Date} start @param {Date} end @returns {boolean} */
export function isEntryInRange(entry, start, end) {
  const d = new Date(entry.punchIn)
  return d >= start && d <= end
}

/**
 * Whether an entry's worked interval [punchIn, punchOut|now] overlaps [start,
 * end] at all — so it's counted for that window even if it began before it or
 * ends after it. Unlike {@link isEntryInRange} (punchIn-only), this catches the
 * morning half of an overnight shift and entries that span a period boundary
 * (issue #136).
 * @param {Entry} entry @param {Date} start @param {Date} end @returns {boolean}
 */
export function entryOverlapsRange(entry, start, end) {
  const entryStart = new Date(entry.punchIn).getTime()
  const entryEnd   = entry.punchOut ? new Date(entry.punchOut).getTime() : Date.now()
  return entryStart <= end.getTime() && entryEnd >= start.getTime()
}

/**
 * Milliseconds of an entry that actually fall inside [start, end], clipped to
 * the window so a cross-midnight or cross-period entry contributes only its
 * in-window portion instead of having its whole duration attributed to one day
 * (issue #136). Running entries use `now` (ms epoch, default `Date.now()`) as the
 * end — pass a ticking value to recompute live (issue #265). Returns 0 when there
 * is no overlap.
 * @param {Entry} entry @param {Date} start @param {Date} end @param {number} [now] @returns {number} milliseconds
 */
export function getEntryDurationInRange(entry, start, end, now = Date.now()) {
  const entryStart = new Date(entry.punchIn).getTime()
  const entryEnd   = entry.punchOut ? new Date(entry.punchOut).getTime() : now
  const lo = Math.max(entryStart, start.getTime())
  const hi = Math.min(entryEnd, end.getTime())
  return Math.max(0, hi - lo)
}

/** @param {Entry[]} entries @returns {number} milliseconds */
export function sumDurations(entries) {
  return entries.reduce((acc, e) => acc + getEntryDuration(e), 0)
}

/**
 * Billable total for a window: completed entries only — running timers are
 * excluded so on-screen totals agree with CSV/print/Analytics (issue #137) —
 * each clipped to [start, end] so cross-period time isn't over-counted (#136).
 * @param {Entry[]} entries @param {Date} start @param {Date} end @returns {number} milliseconds
 */
export function sumDurationsInRange(entries, start, end) {
  return entries.reduce(
    (acc, e) => (e.punchOut ? acc + getEntryDurationInRange(e, start, end) : acc),
    0,
  )
}

/**
 * An entry's BILLED duration within [start, end]: a COMPLETED entry's clipped
 * duration rounded per the billing policy (`minutes` increment + `mode`,
 * issue #274); a RUNNING entry's clipped duration is returned live and UNrounded
 * (it's still accruing, so rounding it would make it jump in steps — issue #265).
 * @param {Entry} entry @param {Date} start @param {Date} end @param {number} now @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {number} milliseconds
 */
export function billedDurationInRange(entry, start, end, now = Date.now(), minutes, mode) {
  const dur = getEntryDurationInRange(entry, start, end, now)
  return entry.punchOut ? roundDurationMs(dur, minutes, mode) : dur
}

/**
 * Billable on-screen total for a window: each completed entry's clipped duration
 * rounded per the policy, plus running timers live and unrounded (issues
 * #274/#265). Per-entry rounding (not a rounded total) keeps per-job/per-rate
 * sums correct, and rows sum exactly to this. Exports/print filter to completed
 * entries; the UI warns when a running timer makes the screen and an export differ.
 * @param {Entry[]} entries @param {Date} start @param {Date} end @param {number} now @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {number} milliseconds
 */
export function sumBilledInRange(entries, start, end, now = Date.now(), minutes, mode) {
  return entries.reduce((acc, e) => acc + billedDurationInRange(e, start, end, now, minutes, mode), 0)
}
