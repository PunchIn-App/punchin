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

// Round a Date to a local clock increment (in minutes). `dir` is 'floor',
// 'ceil', or 'nearest'. Works in local minutes-of-day (with fractional seconds)
// so 15/30-min increments land on the wall-clock :00/:15/:30/:45 boundaries the
// user expects, independent of time zone, and `setMinutes` handles the hour/day
// rollover.
function roundLocalTime(date, increment, dir) {
  const d = new Date(date)
  const minutesOfDay =
    d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000
  const units = minutesOfDay / increment
  const rounded =
    (dir === 'ceil' ? Math.ceil(units) : dir === 'floor' ? Math.floor(units) : Math.round(units)) * increment
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

/**
 * Round a set of entries for billing "in the user's favour" while treating
 * back-to-back entries as ONE continuous session, so a task switch (entry A ends
 * exactly when entry B begins) isn't billed on both sides and inflated (issue
 * #274). For each maximal run of contiguous completed entries
 * (entry[i].punchOut === entry[i+1].punchIn):
 *   - the run's first punchIn is floored down and its last punchOut is ceiled up
 *     (the favour is applied once, at the real start/stop of the session), and
 *   - every internal shared boundary is rounded to the NEAREST increment a single
 *     time and reused as both the earlier entry's punchOut and the later entry's
 *     punchIn — so the rounded rows tile the run with no gap or overlap and sum
 *     exactly to the rounded run span.
 * An isolated entry (no contiguous neighbour) is floored-in / ceiled-out exactly
 * like {@link roundEntry}. Running and sub-minute entries are not rounded.
 *
 * Returns a Map keyed by entry `id` containing ONLY the entries that were rounded;
 * callers look up `map.get(e.id) ?? e` so an entry's rounded copy is the same in
 * the day total, the week total, and any job/labour-filtered view — rounding is a
 * property of the worked session, not of which rows happen to be shown. An empty
 * map (rounding off) means every caller falls back to the raw entry.
 *
 * @param {Entry[]} entries @param {number} [roundingMinutes] @returns {Map<number, Entry>}
 */
export function roundEntriesContiguous(entries, roundingMinutes) {
  const map = new Map()
  if (!roundingMinutes || !entries?.length) return map
  // Only completed, ≥1-minute entries are rounded (matches roundEntry's guards).
  const sorted = entries
    .filter(e => e.punchOut && getEntryDuration(e) >= 60000)
    .sort((a, b) =>
      new Date(a.punchIn) - new Date(b.punchIn) || new Date(a.punchOut) - new Date(b.punchOut))
  let i = 0
  while (i < sorted.length) {
    // Extend the run while the next entry starts exactly where this one ends.
    let j = i
    while (
      j + 1 < sorted.length &&
      new Date(sorted[j].punchOut).getTime() === new Date(sorted[j + 1].punchIn).getTime()
    ) j++
    for (let k = i; k <= j; k++) {
      const e = sorted[k]
      const punchIn = roundLocalTime(e.punchIn, roundingMinutes, k === i ? 'floor' : 'nearest')
      const punchOut = roundLocalTime(e.punchOut, roundingMinutes, k === j ? 'ceil' : 'nearest')
      map.set(e.id, { ...e, punchIn, punchOut })
    }
    i = j + 1
  }
  return map
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
 * Like {@link sumDurationsInRange} but INCLUDES running timers, each valued to
 * `now` (ms epoch) so an on-screen total ticks live (issue #265). Exports/print
 * filter to completed entries instead, so they never show a moving value (the UI
 * warns when a running timer makes the screen and an export differ).
 * @param {Entry[]} entries @param {Date} start @param {Date} end @param {number} [now] @returns {number} milliseconds
 */
export function sumDurationsInRangeLive(entries, start, end, now = Date.now()) {
  return entries.reduce((acc, e) => acc + getEntryDurationInRange(e, start, end, now), 0)
}
