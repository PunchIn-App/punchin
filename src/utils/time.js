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
 * Sub-minute hand-off gap (ms) below which two adjacent tasks count as ONE
 * continuous session. `startTimer` punches the running task out and the new one
 * in on two separate `new Date()` calls, leaving a few-hundred-ms gap (a manual
 * re-punch, a few seconds) — well under a minute, which the billing increment
 * already treats as noise. A gap of a minute or more is a real break, so it
 * starts a fresh session. (This tolerance is why the reopened-#274 fix works
 * where v0.30's bit-exact contiguity test silently failed on the punch jitter.)
 */
const SESSION_GAP_MS = 60_000

/**
 * Distribute `units` whole increments across items weighted by `weights` (worked
 * ms), in proportion to weight, via Hamilton's largest-remainder method: floor
 * each ideal share, then hand the leftover increments to the largest remainders
 * (ties → larger weight, then earlier index). Returns an integer per item summing
 * exactly to `units`. The building block of the session allocator below.
 * @param {number[]} weights @param {number} units @returns {number[]}
 */
function largestRemainder(weights, units) {
  const out = weights.map(() => 0)
  const totalW = weights.reduce((s, w) => s + w, 0)
  if (totalW <= 0 || units <= 0) return out
  const parts = weights.map((w, i) => {
    const ideal = (w / totalW) * units
    out[i] = Math.floor(ideal)
    return { i, rem: ideal - out[i], w }
  })
  let leftover = units - out.reduce((s, n) => s + n, 0)
  for (const p of parts.sort((a, b) => b.rem - a.rem || b.w - a.w || a.i - b.i)) {
    if (leftover <= 0) break
    out[p.i] += 1
    leftover -= 1
  }
  return out
}

/**
 * BILLED duration (ms) for every entry in `entries`, keyed by the entry object.
 * This is the single source of truth for billing — the daily/weekly totals, the
 * per-row hours, and the CSV / print / invoice exports all read from this map, so
 * they can never disagree.
 *
 * Completed entries are grouped by the local calendar day of their `punchIn`
 * (each entry bills once, whole, on its start day — never split across the days
 * it spans, so day totals partition a week — issues #274/#136), then into
 * **continuous sessions**: a task joins the running session when it starts within
 * {@link SESSION_GAP_MS} of the session's end. A session bills `roundOff(whole
 * worked span)` total — a whole number of increments — split first across its
 * billed RATE-GROUPS (`(jobId, laborTypeId)`) by time WORKED, then within each
 * group across its entries (Hamilton's largest-remainder). That gives four
 * properties at once (the reopened #274 fix + its review):
 *
 *  1. The session total equals the rounded whole span — `round`/`ceil` of the
 *     continuous session, NOT of each piece. Per-task rounding made an N-task day
 *     drift by up to N increments (DOWN in 'nearest' → 9.00 h, UP in 'up' →
 *     9.75 h, for a real 9 h 8 m day); session rounding caps the error at one
 *     increment, so that day bills 9.25 h either way.
 *  2. The per-task rows are whole increments that sum to exactly that total (no
 *     per-row vs total drift).
 *  3. Allocation is by worked DURATION, not wall-clock position, so the result is
 *     phase-independent — and two jobs at different rates interleaved in one session
 *     are each billed ~the time they worked (EXACTLY when their worked totals
 *     already align to the increment), not 0 vs the whole session by punch order.
 *  4. An entry's billed time is intrinsic to its full-day session — see the
 *     CONTRACT below.
 *
 * Limits (inherent to discrete session rounding): a session crossing local
 * midnight is split at the day boundary and each part rounds on its own (required
 * so the by-day Daily view and the by-week Weekly view agree — billing attributes
 * each entry to its punchIn day). In 'up' mode the session's round-up surplus lands
 * on the largest-remaining rate-group, so a single line item can read more than its
 * own worked time; only the session total and per-rate-group shares are bounded.
 *
 * A RUNNING entry is billed live and UNrounded (it's still accruing, so rounding
 * would make it jump in steps — issue #265) and never joins a session. Rounding
 * off (`minutes` 0/undefined), or a whole session under a minute, bills raw worked
 * durations (so a stray sub-minute mis-punch isn't inflated to a full increment).
 *
 * **CONTRACT — pass the COMPLETE set of entries for the period (every job/labor
 * type), then filter for display by looking up `billed.get(entry)`.** Because an
 * entry's billed time depends on its session neighbours, computing this over a
 * pre-filtered SUBSET (one job, one client) regroups the sessions and yields a
 * different, scope-dependent number — so a single-job invoice would disagree with
 * that job's contribution to the unfiltered timesheet. Build the map once over the
 * full day/week, then sum/show whatever subset you need; never round a subset.
 * @param {Entry[]} entries @param {number} [now] @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {Map<Entry, number>} entry → billed ms
 */
export function billedDurationMap(entries, now = Date.now(), minutes, mode = 'nearest') {
  const out = new Map()
  if (!entries?.length) return out

  // Running entries bill live + unrounded (#265); completed ones go into sessions.
  const completed = []
  for (const e of entries) {
    if (e.punchOut) completed.push(e)
    else out.set(e, Math.max(0, now - new Date(e.punchIn).getTime()))
  }

  // Bucket completed entries by the local calendar day of punchIn.
  const byDay = new Map()
  for (const e of completed) {
    const d = new Date(e.punchIn)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const bucket = byDay.get(key)
    if (bucket) bucket.push(e)
    else byDay.set(key, [e])
  }

  const inc = minutes * 60_000
  const roundOff = ms => (mode === 'up' ? Math.ceil(ms / inc) : Math.round(ms / inc)) * inc

  for (const dayEntries of byDay.values()) {
    dayEntries.sort((a, b) =>
      new Date(a.punchIn) - new Date(b.punchIn) || new Date(a.punchOut) - new Date(b.punchOut))

    let i = 0
    while (i < dayEntries.length) {
      // Grow the session while the next task starts within the hand-off gap.
      let j = i
      let sessionEnd = new Date(dayEntries[i].punchOut).getTime()
      while (
        j + 1 < dayEntries.length &&
        new Date(dayEntries[j + 1].punchIn).getTime() - sessionEnd < SESSION_GAP_MS
      ) {
        j++
        sessionEnd = Math.max(sessionEnd, new Date(dayEntries[j].punchOut).getTime())
      }

      let sessionWorked = 0
      for (let k = i; k <= j; k++) sessionWorked += getEntryDuration(dayEntries[k])

      if (!minutes || sessionWorked < 60_000) {
        // Rounding off, or a whole session under a minute (e.g. a stray mis-punch):
        // bill raw so a ~0-duration entry isn't inflated to a full increment —
        // matching roundDurationMs's sub-minute guard (issues #208/#274).
        for (let k = i; k <= j; k++) out.set(dayEntries[k], getEntryDuration(dayEntries[k]))
      } else {
        // The session bills roundOff(sessionWorked) = `units` whole increments. Split
        // them first across the session's billed RATE-GROUPS — keyed by (jobId,
        // laborTypeId), the invoice's rate key — in proportion to time WORKED, then
        // within each group across its entries. So every rate-group bills ~its worked
        // share (EXACTLY when the worked totals already align to the increment, so no
        // rounding is invented between jobs), and no job is zeroed or billed the whole
        // session by punch order (issue #274 review). The within-group split is
        // display-only: those entries share one rate. A single-rate session reduces to
        // the obvious split; 'up' mode rounds the SESSION up (not each task), and that
        // round-up surplus lands on the largest-remaining group.
        const units = Math.round(roundOff(sessionWorked) / inc)
        const groups = new Map()
        for (let k = i; k <= j; k++) {
          const e = dayEntries[k]
          const key = `${e.jobId}|${e.laborTypeId}`
          const g = groups.get(key)
          if (g) g.push(e)
          else groups.set(key, [e])
        }
        const groupList = [...groups.values()]
        const groupUnits = largestRemainder(
          groupList.map(g => g.reduce((s, e) => s + getEntryDuration(e), 0)), units)
        groupList.forEach((g, gi) => {
          const within = largestRemainder(g.map(getEntryDuration), groupUnits[gi])
          g.forEach((e, ei) => out.set(e, within[ei] * inc))
        })
      }
      i = j + 1
    }
  }

  return out
}

/**
 * An entry's BILLED duration (ms) treated as its own session — a COMPLETED entry's
 * full duration rounded per policy, a RUNNING entry's live unrounded time (#265).
 * Convenience wrapper over {@link billedDurationMap}; callers that render or total
 * a *set* of entries must use the map directly so back-to-back tasks round as one
 * continuous session (issue #274) instead of each in isolation.
 * @param {Entry} entry @param {number} [now] @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {number} milliseconds
 */
export function billedEntryDuration(entry, now = Date.now(), minutes, mode) {
  return billedDurationMap([entry], now, minutes, mode).get(entry) ?? 0
}

/**
 * Billable total (ms) for `entries` already filtered to a window by punchIn — the
 * sum of {@link billedDurationMap}, so back-to-back tasks bill as one continuous
 * session and the rows sum exactly to this total (issues #274/#265).
 * @param {Entry[]} entries @param {number} [now] @param {number} [minutes] @param {'nearest'|'up'} [mode] @returns {number} milliseconds
 */
export function sumBilled(entries, now = Date.now(), minutes, mode) {
  let total = 0
  for (const ms of billedDurationMap(entries, now, minutes, mode).values()) total += ms
  return total
}
