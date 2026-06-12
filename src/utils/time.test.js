import {
  formatElapsed,
  formatDurationHM,
  formatDecimalHours,
  formatDuration,
  roundDurationMs,
  billedEntryDuration,
  billedDurationMap,
  sumBilled,
  getEntryDuration,
  formatTime,
  formatDate,
  getDayRange,
  getWeekRange,
  getWeekDays,
  isEntryInRange,
  entryOverlapsRange,
  getEntryDurationInRange,
  sumDurations,
  sumDurationsInRange,
} from './time'

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------
describe('formatElapsed', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
  })
  it('formats 1 second', () => {
    expect(formatElapsed(1000)).toBe('00:00:01')
  })
  it('formats 1 minute', () => {
    expect(formatElapsed(60_000)).toBe('00:01:00')
  })
  it('formats 1 hour', () => {
    expect(formatElapsed(3_600_000)).toBe('01:00:00')
  })
  it('pads all segments with zeros', () => {
    expect(formatElapsed(3_661_000)).toBe('01:01:01')
  })
  it('handles negative ms (uses absolute value)', () => {
    expect(formatElapsed(-1000)).toBe('00:00:01')
  })
  it('handles 10 hours', () => {
    expect(formatElapsed(36_000_000)).toBe('10:00:00')
  })
  it('sub-second ms rounds down to 0 seconds', () => {
    expect(formatElapsed(999)).toBe('00:00:00')
  })
})

// ---------------------------------------------------------------------------
// formatDurationHM
// ---------------------------------------------------------------------------
describe('formatDurationHM', () => {
  it('formats 0ms as 0m', () => {
    expect(formatDurationHM(0)).toBe('0m')
  })
  it('sub-minute ms rounds down to 0m', () => {
    expect(formatDurationHM(59_999)).toBe('0m')
  })
  it('formats exactly 1 minute', () => {
    expect(formatDurationHM(60_000)).toBe('1m')
  })
  it('formats 45 minutes (no hours)', () => {
    expect(formatDurationHM(2_700_000)).toBe('45m')
  })
  it('formats exactly 1 hour with no minutes', () => {
    expect(formatDurationHM(3_600_000)).toBe('1h')
  })
  it('formats 1h 30m', () => {
    expect(formatDurationHM(5_400_000)).toBe('1h 30m')
  })
  it('handles negative ms (uses absolute value)', () => {
    expect(formatDurationHM(-5_400_000)).toBe('1h 30m')
  })
})

// ---------------------------------------------------------------------------
// getEntryDuration
// ---------------------------------------------------------------------------
describe('getEntryDuration', () => {
  it('returns elapsed ms for a completed entry', () => {
    const punchIn  = new Date('2024-01-15T09:00:00')
    const punchOut = new Date('2024-01-15T10:00:00')
    expect(getEntryDuration({ punchIn, punchOut })).toBe(3_600_000)
  })

  it('uses current time when punchOut is null (active timer)', () => {
    const now = Date.now()
    const punchIn = new Date(now - 5_000)
    const duration = getEntryDuration({ punchIn, punchOut: null })
    expect(duration).toBeGreaterThanOrEqual(4_900)
    expect(duration).toBeLessThan(10_000)
  })

  it('handles string-serialised dates (IndexedDB round-trip)', () => {
    const punchIn  = '2024-01-15T09:00:00.000Z'
    const punchOut = '2024-01-15T10:00:00.000Z'
    expect(getEntryDuration({ punchIn, punchOut })).toBe(3_600_000)
  })

  it('handles cross-day entries', () => {
    const punchIn  = new Date('2024-01-15T23:00:00')
    const punchOut = new Date('2024-01-16T01:00:00')
    expect(getEntryDuration({ punchIn, punchOut })).toBe(7_200_000)
  })
})

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('formats morning time in 12-hour format with AM', () => {
    expect(formatTime(new Date(2024, 0, 15, 9, 30))).toBe('9:30 AM')
  })
  it('formats afternoon time with PM', () => {
    expect(formatTime(new Date(2024, 0, 15, 14, 5))).toBe('2:05 PM')
  })
  it('formats midnight as 12:00 AM', () => {
    expect(formatTime(new Date(2024, 0, 15, 0, 0))).toBe('12:00 AM')
  })
  it('formats noon as 12:00 PM', () => {
    expect(formatTime(new Date(2024, 0, 15, 12, 0))).toBe('12:00 PM')
  })
  it('honours an explicit 24-hour format', () => {
    expect(formatTime(new Date(2024, 0, 15, 14, 5), '24h')).toBe('14:05')
    expect(formatTime(new Date(2024, 0, 15, 0, 0), '24h')).toBe('00:00')
  })
  it('honours an explicit 12-hour format regardless of locale', () => {
    expect(formatTime(new Date(2024, 0, 15, 14, 5), '12h')).toBe('2:05 PM')
  })
  it("'auto' resolves to a valid time string (device preference)", () => {
    expect(formatTime(new Date(2024, 0, 15, 14, 5), 'auto')).toMatch(/^(2:05 PM|14:05)$/)
  })

  describe("'auto' resolves the device hour cycle (issue #264)", () => {
    const origLanguages = Object.getOwnPropertyDescriptor(navigator, 'languages')
    const setLanguages = (langs) => Object.defineProperty(navigator, 'languages', { value: langs, configurable: true })
    afterEach(() => {
      if (origLanguages) Object.defineProperty(navigator, 'languages', origLanguages)
    })

    it("renders 24-hour when the device locale carries a 24-hour override (-u-hc-h23)", () => {
      // Android Chrome surfaces the OS 'use 24-hour time' toggle this way; the old
      // hour12-based detection missed it and stayed 12-hour.
      setLanguages(['en-US-u-hc-h23'])
      expect(formatTime(new Date(2024, 0, 15, 14, 5), 'auto')).toBe('14:05')
    })

    it('renders 24-hour for a 24-hour-default locale (en-GB)', () => {
      setLanguages(['en-GB'])
      expect(formatTime(new Date(2024, 0, 15, 14, 5), 'auto')).toBe('14:05')
    })

    it('renders 12-hour for a 12-hour-default locale (en-US)', () => {
      setLanguages(['en-US'])
      expect(formatTime(new Date(2024, 0, 15, 14, 5), 'auto')).toBe('2:05 PM')
    })
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats a Monday date', () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe('Mon, Jan 15')
  })
  it('formats a Friday date', () => {
    expect(formatDate(new Date(2024, 0, 19))).toBe('Fri, Jan 19')
  })
})

// ---------------------------------------------------------------------------
// getDayRange
// ---------------------------------------------------------------------------
describe('getDayRange', () => {
  it('start is midnight (00:00:00.000)', () => {
    const { start } = getDayRange(new Date(2024, 0, 15, 14, 30))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it('end is 23:59:59.999', () => {
    const { end } = getDayRange(new Date(2024, 0, 15, 14, 30))
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })

  it('start and end are on the same calendar day', () => {
    const date = new Date(2024, 5, 1, 8, 0)
    const { start, end } = getDayRange(date)
    expect(start.getDate()).toBe(end.getDate())
    expect(start.getMonth()).toBe(end.getMonth())
    expect(start.getFullYear()).toBe(end.getFullYear())
  })

  it('start is strictly before end', () => {
    const { start, end } = getDayRange(new Date())
    expect(start.getTime()).toBeLessThan(end.getTime())
  })
})

// ---------------------------------------------------------------------------
// getWeekRange
// ---------------------------------------------------------------------------
describe('getWeekRange', () => {
  // Wednesday 2024-01-17
  const wednesday = new Date(2024, 0, 17)

  it('week starts Monday when weekStartsMonday=true', () => {
    const { start } = getWeekRange(wednesday, true)
    expect(start.getDay()).toBe(1) // Monday
  })

  it('week ends Sunday when weekStartsMonday=true', () => {
    const { end } = getWeekRange(wednesday, true)
    expect(end.getDay()).toBe(0) // Sunday
  })

  it('week starts Sunday when weekStartsMonday=false', () => {
    const { start } = getWeekRange(wednesday, false)
    expect(start.getDay()).toBe(0) // Sunday
  })

  it('week ends Saturday when weekStartsMonday=false', () => {
    const { end } = getWeekRange(wednesday, false)
    expect(end.getDay()).toBe(6) // Saturday
  })

  it('range covers exactly 7 calendar days', () => {
    // start = Monday 00:00:00.000, end = Sunday 23:59:59.999 → ~7 day window
    const { start, end } = getWeekRange(wednesday, true)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.round(diffMs / 86_400_000)
    expect(diffDays).toBe(7)
  })

  it('start is strictly before end', () => {
    const { start, end } = getWeekRange(new Date(), true)
    expect(start.getTime()).toBeLessThan(end.getTime())
  })

  it('input date falls within returned range', () => {
    const { start, end } = getWeekRange(wednesday, true)
    expect(wednesday.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(wednesday.getTime()).toBeLessThanOrEqual(end.getTime())
  })
})

// ---------------------------------------------------------------------------
// getWeekDays
// ---------------------------------------------------------------------------
describe('getWeekDays', () => {
  it('always returns exactly 7 days', () => {
    expect(getWeekDays(new Date(2024, 0, 17))).toHaveLength(7)
  })

  it('first day is Monday when weekStartsMonday=true', () => {
    const days = getWeekDays(new Date(2024, 0, 17), true)
    expect(days[0].getDay()).toBe(1)
  })

  it('first day is Sunday when weekStartsMonday=false', () => {
    const days = getWeekDays(new Date(2024, 0, 17), false)
    expect(days[0].getDay()).toBe(0)
  })

  it('days are in ascending chronological order', () => {
    const days = getWeekDays(new Date(2024, 0, 17))
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime()).toBeGreaterThan(days[i - 1].getTime())
    }
  })

  it('consecutive days differ by exactly 1 day', () => {
    const days = getWeekDays(new Date(2024, 0, 17))
    for (let i = 1; i < days.length; i++) {
      const diff = days[i].getTime() - days[i - 1].getTime()
      expect(diff).toBe(86_400_000)
    }
  })
})

// ---------------------------------------------------------------------------
// isEntryInRange
// ---------------------------------------------------------------------------
describe('isEntryInRange', () => {
  const start = new Date(2024, 0, 15, 0, 0, 0, 0)
  const end   = new Date(2024, 0, 15, 23, 59, 59, 999)

  it('includes entry whose punchIn falls within range', () => {
    expect(isEntryInRange({ punchIn: new Date(2024, 0, 15, 10, 0) }, start, end)).toBe(true)
  })

  it('excludes entry whose punchIn is before range', () => {
    expect(isEntryInRange({ punchIn: new Date(2024, 0, 14, 23, 59, 59) }, start, end)).toBe(false)
  })

  it('excludes entry whose punchIn is after range', () => {
    expect(isEntryInRange({ punchIn: new Date(2024, 0, 16, 0, 0, 1) }, start, end)).toBe(false)
  })

  it('includes entry at the exact start boundary', () => {
    expect(isEntryInRange({ punchIn: start }, start, end)).toBe(true)
  })

  it('includes entry at the exact end boundary', () => {
    expect(isEntryInRange({ punchIn: end }, start, end)).toBe(true)
  })

  it('punchIn-only check: cross-day entry appears on start day, not end day', () => {
    // Starts Jan 15 23:00 (in range), ends Jan 16 01:00 (out of range)
    // Known limitation: only punchIn is checked
    const crossDay = { punchIn: new Date(2024, 0, 15, 23, 0), punchOut: new Date(2024, 0, 16, 1, 0) }
    expect(isEntryInRange(crossDay, start, end)).toBe(true)

    const nextDayRange = { start: new Date(2024, 0, 16, 0, 0), end: new Date(2024, 0, 16, 23, 59, 59, 999) }
    expect(isEntryInRange(crossDay, nextDayRange.start, nextDayRange.end)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// entryOverlapsRange (issue #136)
// ---------------------------------------------------------------------------
describe('entryOverlapsRange', () => {
  const start = new Date(2024, 0, 15, 0, 0, 0, 0)
  const end   = new Date(2024, 0, 15, 23, 59, 59, 999)

  it('includes an entry fully inside the range', () => {
    const e = { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) }
    expect(entryOverlapsRange(e, start, end)).toBe(true)
  })

  it('includes an entry that started the previous day and ends inside (overnight morning half)', () => {
    const e = { punchIn: new Date(2024, 0, 14, 23, 0), punchOut: new Date(2024, 0, 15, 2, 0) }
    expect(entryOverlapsRange(e, start, end)).toBe(true)
  })

  it('includes an entry that starts inside and ends the next day', () => {
    const e = { punchIn: new Date(2024, 0, 15, 23, 0), punchOut: new Date(2024, 0, 16, 1, 0) }
    expect(entryOverlapsRange(e, start, end)).toBe(true)
  })

  it('excludes an entry that ends before the range starts', () => {
    const e = { punchIn: new Date(2024, 0, 14, 20, 0), punchOut: new Date(2024, 0, 14, 22, 0) }
    expect(entryOverlapsRange(e, start, end)).toBe(false)
  })

  it('excludes an entry that starts after the range ends', () => {
    const e = { punchIn: new Date(2024, 0, 16, 1, 0), punchOut: new Date(2024, 0, 16, 2, 0) }
    expect(entryOverlapsRange(e, start, end)).toBe(false)
  })

  it('treats a running entry as ending now', () => {
    const e = { punchIn: new Date(Date.now() - 1000), punchOut: null }
    const wide = { start: new Date(Date.now() - 3600_000), end: new Date(Date.now() + 3600_000) }
    expect(entryOverlapsRange(e, wide.start, wide.end)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getEntryDurationInRange (issue #136)
// ---------------------------------------------------------------------------
describe('getEntryDurationInRange', () => {
  const dayStart = new Date(2024, 0, 15, 0, 0, 0, 0)
  const dayEnd   = new Date(2024, 0, 15, 23, 59, 59, 999)

  it('returns the full duration for an entry fully inside the range', () => {
    const e = { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) }
    expect(getEntryDurationInRange(e, dayStart, dayEnd)).toBe(3_600_000)
  })

  it('clips to the end of the day for an entry that runs past midnight', () => {
    // 23:00 → 01:00 next day: only the first hour (23:00–24:00) falls in this day
    const e = { punchIn: new Date(2024, 0, 15, 23, 0), punchOut: new Date(2024, 0, 16, 1, 0) }
    // 23:00:00.000 → 23:59:59.999 ≈ 1h minus 1ms
    expect(getEntryDurationInRange(e, dayStart, dayEnd)).toBe(3_600_000 - 1)
  })

  it('clips to the start of the day for the morning half of an overnight entry', () => {
    // Previous day 23:00 → 02:00: two hours (00:00–02:00) fall in this day
    const e = { punchIn: new Date(2024, 0, 14, 23, 0), punchOut: new Date(2024, 0, 15, 2, 0) }
    expect(getEntryDurationInRange(e, dayStart, dayEnd)).toBe(7_200_000)
  })

  it('returns 0 when the entry does not overlap the range', () => {
    const e = { punchIn: new Date(2024, 0, 10, 9, 0), punchOut: new Date(2024, 0, 10, 10, 0) }
    expect(getEntryDurationInRange(e, dayStart, dayEnd)).toBe(0)
  })

  it('sums per-day clips back to the full duration (no time lost or double-counted)', () => {
    const e = { punchIn: new Date(2024, 0, 15, 23, 0), punchOut: new Date(2024, 0, 16, 1, 0) } // 2h total
    const day1 = getEntryDurationInRange(e, dayStart, dayEnd)
    const day2Start = new Date(2024, 0, 16, 0, 0, 0, 0)
    const day2End   = new Date(2024, 0, 16, 23, 59, 59, 999)
    const day2 = getEntryDurationInRange(e, day2Start, day2End)
    // 1ms is the gap between 23:59:59.999 and 00:00:00.000
    expect(day1 + day2).toBe(7_200_000 - 1)
  })
})

// ---------------------------------------------------------------------------
// sumDurations
// ---------------------------------------------------------------------------
describe('sumDurations', () => {
  it('returns 0 for an empty array', () => {
    expect(sumDurations([])).toBe(0)
  })

  it('returns the duration of a single completed entry', () => {
    const entries = [
      { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 9, 1) },
    ]
    expect(sumDurations(entries)).toBe(60_000)
  })

  it('sums durations across multiple entries', () => {
    const entries = [
      { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) }, // 1h
      { punchIn: new Date(2024, 0, 15, 11, 0), punchOut: new Date(2024, 0, 15, 11, 30) }, // 30m
    ]
    expect(sumDurations(entries)).toBe(5_400_000)
  })

  it('includes active timers (punchOut = null) using current time', () => {
    const now = Date.now()
    const entries = [
      { punchIn: new Date(now - 1_000), punchOut: null },
    ]
    expect(sumDurations(entries)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// sumDurationsInRange (issues #136 + #137)
// ---------------------------------------------------------------------------
describe('sumDurationsInRange', () => {
  const start = new Date(2024, 0, 15, 0, 0, 0, 0)
  const end   = new Date(2024, 0, 15, 23, 59, 59, 999)

  it('returns 0 for an empty array', () => {
    expect(sumDurationsInRange([], start, end)).toBe(0)
  })

  it('sums completed entries clipped to the window', () => {
    const entries = [
      { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) },  // 1h
      { punchIn: new Date(2024, 0, 15, 11, 0), punchOut: new Date(2024, 0, 15, 11, 30) }, // 30m
    ]
    expect(sumDurationsInRange(entries, start, end)).toBe(5_400_000)
  })

  it('excludes running entries (punchOut = null) so totals match exports (#137)', () => {
    const entries = [
      { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) }, // 1h, counts
      { punchIn: new Date(2024, 0, 15, 11, 0), punchOut: null },                         // running, skipped
    ]
    expect(sumDurationsInRange(entries, start, end)).toBe(3_600_000)
  })

  it('clips a cross-midnight entry to only its in-window portion (#136)', () => {
    const entries = [
      { punchIn: new Date(2024, 0, 15, 23, 0), punchOut: new Date(2024, 0, 16, 1, 0) }, // 2h, 1h in-window
    ]
    expect(sumDurationsInRange(entries, start, end)).toBe(3_600_000 - 1)
  })
})

// ---------------------------------------------------------------------------
// billedEntryDuration / sumBilled (issues #265/#274 — rounded completed + live
// running, attributed whole to the punchIn day, never split across windows)
// ---------------------------------------------------------------------------
describe('billedEntryDuration', () => {
  it('rounds a completed entry by its FULL duration', () => {
    const e = { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 9, 50) } // 50m
    expect(billedEntryDuration(e, Date.now(), 30, 'nearest')).toBe(60 * 60_000) // 50m → 60m
    expect(billedEntryDuration(e, Date.now(), 0)).toBe(50 * 60_000)             // off → raw
  })

  it('bills the whole entry regardless of any window — a cross-midnight entry is not split', () => {
    // 23:40 → 00:50 next day = 70m. There is no clipping: the whole 70m rounds
    // once and is attributed (by the caller) to the punchIn day.
    const overnight = { punchIn: new Date(2024, 0, 15, 23, 40), punchOut: new Date(2024, 0, 16, 0, 50) }
    expect(billedEntryDuration(overnight, Date.now(), 30, 'nearest')).toBe(60 * 60_000) // round(70m) = 60m, once
  })

  it('returns a running entry live and UNrounded (no step-jumping, #265)', () => {
    const now = new Date(2024, 0, 15, 11, 7).getTime() // running 7m — would be 0 if nearest-rounded
    const e = { punchIn: new Date(2024, 0, 15, 11, 0), punchOut: null }
    expect(billedEntryDuration(e, now, 15, 'nearest')).toBe(7 * 60_000) // raw, not 0
  })
})

describe('sumBilled', () => {
  it('rounding off: includes a running entry live, unrounded', () => {
    const now = new Date(2024, 0, 15, 11, 30).getTime()
    const entries = [
      { punchIn: new Date(2024, 0, 15, 9, 0), punchOut: new Date(2024, 0, 15, 10, 0) }, // 1h completed
      { punchIn: new Date(2024, 0, 15, 11, 0), punchOut: null },                         // running, 30m
    ]
    expect(sumBilled(entries, now)).toBe(60 * 60_000 + 30 * 60_000)
  })

  it('grows as now advances (live)', () => {
    const entries = [{ punchIn: new Date(2024, 0, 15, 11, 0), punchOut: null }]
    const t1 = sumBilled(entries, new Date(2024, 0, 15, 11, 10).getTime(), 15, 'nearest')
    const t2 = sumBilled(entries, new Date(2024, 0, 15, 11, 40).getTime(), 15, 'nearest')
    expect(t2 - t1).toBe(30 * 60_000)
  })
})

// ---------------------------------------------------------------------------
// formatDecimalHours / formatDuration (issue #208)
// ---------------------------------------------------------------------------
describe('formatDecimalHours', () => {
  it('formats 90 minutes as 1.50 h', () => {
    expect(formatDecimalHours(90 * 60_000)).toBe('1.50 h')
  })
  it('formats a quarter hour as 0.25 h', () => {
    expect(formatDecimalHours(15 * 60_000)).toBe('0.25 h')
  })
  it('formats zero as 0.00 h', () => {
    expect(formatDecimalHours(0)).toBe('0.00 h')
  })
})

describe('formatDuration', () => {
  it('uses the compact h/m form by default', () => {
    expect(formatDuration(90 * 60_000)).toBe('1h 30m')
    expect(formatDuration(90 * 60_000, false)).toBe('1h 30m')
  })
  it('uses decimal hours when asked', () => {
    expect(formatDuration(90 * 60_000, true)).toBe('1.50 h')
  })
})

// ---------------------------------------------------------------------------
// roundDurationMs (issues #208/#274 — round each task's billed duration)
// ---------------------------------------------------------------------------
describe('roundDurationMs', () => {
  const M = (mins) => mins * 60_000

  it('rounds a duration to the nearest increment by default', () => {
    expect(roundDurationMs(M(92), 15)).toBe(M(90))  // 1h32m → 1h30m
    expect(roundDurationMs(M(34), 15)).toBe(M(30))  // 34m → 30m
    expect(roundDurationMs(M(21), 15)).toBe(M(15))  // 21m → 15m
    expect(roundDurationMs(M(8),  15)).toBe(M(15))  // 8m → 15m (≥ half)
    expect(roundDurationMs(M(7),  15)).toBe(0)      // 7m → 0  (< half, rounds down)
  })

  it("rounds UP in 'up' mode so a short task is never lost", () => {
    expect(roundDurationMs(M(7),  15, 'up')).toBe(M(15))  // 7m → 15m (the lost-task case)
    expect(roundDurationMs(M(92), 15, 'up')).toBe(M(105)) // 1h32m → 1h45m
    expect(roundDurationMs(M(15), 15, 'up')).toBe(M(15))  // exact stays exact
    expect(roundDurationMs(M(50), 30, 'up')).toBe(M(60))  // half-hour increment
  })

  it('is a no-op when rounding is off (0 / undefined)', () => {
    expect(roundDurationMs(M(34), 0)).toBe(M(34))
    expect(roundDurationMs(M(34), undefined, 'up')).toBe(M(34))
  })

  it('does NOT inflate a sub-minute duration to a full increment (either mode)', () => {
    expect(roundDurationMs(0, 15, 'up')).toBe(0)             // 0 stays 0
    expect(roundDurationMs(30_000, 15, 'up')).toBe(30_000)   // 30s stays 30s
    expect(roundDurationMs(30_000, 15)).toBe(30_000)
  })
})

// ---------------------------------------------------------------------------
// Continuous-workday billing (issue #274, reopened) — back-to-back tasks round as
// ONE continuous session, so an N-task day bills the rounded WHOLE span (capping
// the error at a single increment) instead of drifting by up to N increments. The
// hand-offs carry the few-ms gap startTimer leaves; the session tolerance bridges
// it where v0.30's bit-exact contiguity test silently failed.
// ---------------------------------------------------------------------------
describe('billing a continuous workday split into tasks (issue #274)', () => {
  const now   = new Date(2024, 0, 15, 18, 0).getTime()
  // 8:00→17:08 = 9h 8m of real work (9.13 h) split Admin/Install/Travel/Admin,
  // with a few-hundred-ms gap at each hand-off (as real punches have).
  const day = [
    { id: 1, jobId: 1, punchIn: new Date(2024, 0, 15, 8, 0, 0, 0),    punchOut: new Date(2024, 0, 15, 9, 32, 0, 0) },
    { id: 2, jobId: 2, punchIn: new Date(2024, 0, 15, 9, 32, 0, 250), punchOut: new Date(2024, 0, 15, 10, 6, 0, 0) },
    { id: 3, jobId: 3, punchIn: new Date(2024, 0, 15, 10, 6, 0, 400), punchOut: new Date(2024, 0, 15, 10, 27, 0, 0) },
    { id: 4, jobId: 1, punchIn: new Date(2024, 0, 15, 10, 27, 0, 600), punchOut: new Date(2024, 0, 15, 17, 8, 0, 0) },
  ]
  const hrs = (map, e) => (map.get(e) ?? 0) / 3_600_000

  it('nearest: the whole 9h08m session rounds to 9.25 h, not 9.00 (the per-task drift)', () => {
    const m = billedDurationMap(day, now, 15, 'nearest')
    expect(hrs(m, day[0])).toBeCloseTo(1.5, 5)
    expect(hrs(m, day[1])).toBeCloseTo(0.5, 5)
    expect(hrs(m, day[2])).toBeCloseTo(0.5, 5)   // the Travel task is no longer rounded away in isolation
    expect(hrs(m, day[3])).toBeCloseTo(6.75, 5)
    expect(sumBilled(day, now, 15, 'nearest') / 3_600_000).toBeCloseTo(9.25, 5)
  })

  it("round up: the session rounds UP once to 9.25 h, not 9.75 (4× per-task padding)", () => {
    expect(sumBilled(day, now, 15, 'up') / 3_600_000).toBeCloseTo(9.25, 5)
  })

  it('rows sum exactly to the total (telescoping — no per-row vs total drift)', () => {
    const m = billedDurationMap(day, now, 15, 'nearest')
    const rows = day.reduce((s, e) => s + m.get(e), 0)
    expect(rows).toBe(sumBilled(day, now, 15, 'nearest'))
  })

  it('a real break (gap ≥ 1 min) starts a fresh session, rounded on its own', () => {
    // Two 8-minute tasks an hour apart: NOT one session, so each rounds alone.
    // 8m → 15m nearest, twice = 30m total (not merged to one 16m → 15m session).
    const split = [
      { id: 1, punchIn: new Date(2024, 0, 15, 9, 0),  punchOut: new Date(2024, 0, 15, 9, 8) },
      { id: 2, punchIn: new Date(2024, 0, 15, 10, 0), punchOut: new Date(2024, 0, 15, 10, 8) },
    ]
    expect(sumBilled(split, now, 15, 'nearest')).toBe(30 * 60_000)
  })

  it('attributes each session to its own punchIn day (no cross-day merge)', () => {
    // Same clock-adjacent times but on different days never form one session.
    const twoDays = [
      { id: 1, punchIn: new Date(2024, 0, 15, 16, 0), punchOut: new Date(2024, 0, 15, 17, 8) },
      { id: 2, punchIn: new Date(2024, 0, 16,  8, 0), punchOut: new Date(2024, 0, 16,  9, 0) },
    ]
    const m = billedDurationMap(twoDays, now, 15, 'nearest')
    expect(m.get(twoDays[0])).toBe(roundDurationMs(68 * 60_000, 15)) // 1h08m → 1h15m, alone
    expect(m.get(twoDays[1])).toBe(60 * 60_000)                       // 1h exact, alone
  })
})

// ---------------------------------------------------------------------------
// Subset-stability & sub-minute guard (issue #274 review) — billing must be the
// SAME number whatever subset is in scope, and a stray mis-punch must not inflate.
// ---------------------------------------------------------------------------
describe('billing is subset-stable & guards sub-minute mis-punches (issue #274 review)', () => {
  const now = new Date(2024, 0, 15, 18, 0).getTime()
  // Continuous day, two jobs interleaved: A 9:00–9:10, B 9:10–9:40, A 9:40–9:50.
  const A1 = { id: 1, jobId: 1, punchIn: new Date(2024, 0, 15, 9, 0),  punchOut: new Date(2024, 0, 15, 9, 10) }
  const B  = { id: 2, jobId: 2, punchIn: new Date(2024, 0, 15, 9, 10), punchOut: new Date(2024, 0, 15, 9, 40) }
  const A2 = { id: 3, jobId: 1, punchIn: new Date(2024, 0, 15, 9, 40), punchOut: new Date(2024, 0, 15, 9, 50) }

  it("a job's billed time is its share of the FULL-day session, not a rounding of its own subset", () => {
    // 30-min increment, round up. Day session = 50m worked → ceil 60m, allocated
    // A1=30m, B=30m, A2=0m. Job A's contribution = 30m.
    const full = billedDurationMap([A1, B, A2], now, 30, 'up')
    expect(full.get(A1) + full.get(A2)).toBe(30 * 60_000)
    // The regressed behaviour rounded only Job A's subset [A1,A2] — two 10m tasks
    // 30m apart → two sessions → 30m+30m = 60m. This is exactly why a consumer must
    // pass the WHOLE day to billedDurationMap and attribute, never round a subset.
    expect(sumBilled([A1, A2], now, 30, 'up')).toBe(60 * 60_000)
    expect(sumBilled([A1, A2], now, 30, 'up')).not.toBe(full.get(A1) + full.get(A2))
  })

  it("'up' mode does not inflate an isolated sub-minute mis-punch to a full increment", () => {
    const blip = { id: 1, punchIn: new Date(2024, 0, 15, 11, 0, 0, 0), punchOut: new Date(2024, 0, 15, 11, 0, 20, 0) } // 20s
    expect(billedEntryDuration(blip, now, 15, 'up')).toBe(20_000) // raw ~0, not 15m
    expect(billedEntryDuration(blip, now, 30, 'up')).toBe(20_000)
  })

  it('a sub-minute blip BETWEEN real tasks does not add a whole increment to the session', () => {
    // 9:00–9:30 (30m), 9:30:00–9:30:20 (20s blip), 9:30:20–9:50:20 (20m). 15m 'up'.
    // worked = 30m + 20s + 20m = 50m20s → ceil to the ¼h = 60m. Per-task 'up' would
    // have over-billed (30+15+30 = 75m); the session caps it.
    const t1   = { punchIn: new Date(2024, 0, 15, 9, 0),         punchOut: new Date(2024, 0, 15, 9, 30) }
    const blip = { punchIn: new Date(2024, 0, 15, 9, 30, 0, 0),  punchOut: new Date(2024, 0, 15, 9, 30, 20, 0) }
    const t2   = { punchIn: new Date(2024, 0, 15, 9, 30, 20, 0), punchOut: new Date(2024, 0, 15, 9, 50, 20, 0) }
    expect(sumBilled([t1, blip, t2], now, 15, 'up')).toBe(60 * 60_000)
  })
})
