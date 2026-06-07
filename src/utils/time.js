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

// Round a Date to a local clock increment (in minutes). `dir` is 'floor' or
// 'ceil'. Works in local minutes-of-day (with fractional seconds) so 15/30-min
// increments land on the wall-clock :00/:15/:30/:45 boundaries the user expects,
// independent of time zone, and `setMinutes` handles the hour/day rollover.
function roundLocalTime(date, increment, dir) {
  const d = new Date(date)
  const minutesOfDay =
    d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000
  const rounded =
    dir === 'ceil'
      ? Math.ceil(minutesOfDay / increment) * increment
      : Math.floor(minutesOfDay / increment) * increment
  d.setHours(0, 0, 0, 0)
  d.setMinutes(rounded)
  return d
}

/**
 * Round a completed entry's worked interval "in the user's favour" for billing
 * (issue #208): floor punchIn down and ceil punchOut up to `roundingMinutes`, so
 * e.g. an 8:07 → 8:20 entry billed to the quarter hour becomes 8:00 → 8:30. A
 * `roundingMinutes` of 0 (off) or a still-running entry is returned unchanged.
 * Returns a shallow copy with adjusted punchIn/punchOut, so every duration/clip
 * helper above works on it without change.
 * @param {Entry} entry @param {number} [roundingMinutes] @returns {Entry}
 */
export function roundEntry(entry, roundingMinutes) {
  // No rounding when it's off, the entry is still running, or it's under a minute
  // ("0m"): flooring punch-in and ceiling punch-out would inflate a ~0-duration
  // entry up to a full increment (e.g. 0m → 0.25 h), which is a bug, not a favour.
  if (!roundingMinutes || !entry.punchOut || getEntryDuration(entry) < 60000) return entry
  return {
    ...entry,
    punchIn:  roundLocalTime(entry.punchIn,  roundingMinutes, 'floor'),
    punchOut: roundLocalTime(entry.punchOut, roundingMinutes, 'ceil'),
  }
}

/** @param {Entry} entry @returns {number} milliseconds */
export function getEntryDuration(entry) {
  const end = entry.punchOut ? new Date(entry.punchOut) : new Date()
  return end.getTime() - new Date(entry.punchIn).getTime()
}

// The device's 12h/24h preference, used when timeFormat is 'auto' (the default).
function deviceHour12() {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true
  } catch {
    return true
  }
}

/** @param {Date|string|number} date @param {'auto'|'12h'|'24h'} [fmt] @returns {string} */
export function formatTime(date, fmt = 'auto') {
  const use24 = fmt === '24h' || (fmt !== '12h' && !deviceHour12())
  return format(new Date(date), use24 ? 'HH:mm' : 'h:mm a')
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
 * (issue #136). Running entries use `now` as the end. Returns 0 when there is no
 * overlap.
 * @param {Entry} entry @param {Date} start @param {Date} end @returns {number} milliseconds
 */
export function getEntryDurationInRange(entry, start, end) {
  const entryStart = new Date(entry.punchIn).getTime()
  const entryEnd   = entry.punchOut ? new Date(entry.punchOut).getTime() : Date.now()
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
