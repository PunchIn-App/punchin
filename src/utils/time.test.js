import {
  formatElapsed,
  formatDurationHM,
  formatDecimalHours,
  formatDuration,
  roundEntry,
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
// roundEntry (issue #208)
// ---------------------------------------------------------------------------
describe('roundEntry', () => {
  it('rounds in the user’s favour: 8:07→8:20 becomes 8:00→8:30 at a quarter hour', () => {
    const e = { punchIn: new Date(2024, 0, 15, 8, 7), punchOut: new Date(2024, 0, 15, 8, 20) }
    const r = roundEntry(e, 15)
    expect(r.punchIn).toEqual(new Date(2024, 0, 15, 8, 0))
    expect(r.punchOut).toEqual(new Date(2024, 0, 15, 8, 30))
    expect(getEntryDuration(r)).toBe(30 * 60_000)
  })

  it('rounds to the half hour: 9:05→9:50 becomes 9:00→10:00', () => {
    const e = { punchIn: new Date(2024, 0, 15, 9, 5), punchOut: new Date(2024, 0, 15, 9, 50) }
    const r = roundEntry(e, 30)
    expect(r.punchIn).toEqual(new Date(2024, 0, 15, 9, 0))
    expect(r.punchOut).toEqual(new Date(2024, 0, 15, 10, 0))
  })

  it('leaves exact-boundary times unchanged (8:00→8:30 stays 8:00→8:30)', () => {
    const e = { punchIn: new Date(2024, 0, 15, 8, 0), punchOut: new Date(2024, 0, 15, 8, 30) }
    const r = roundEntry(e, 15)
    expect(r.punchIn).toEqual(e.punchIn)
    expect(r.punchOut).toEqual(e.punchOut)
  })

  it('is a no-op when rounding is off (0)', () => {
    const e = { punchIn: new Date(2024, 0, 15, 8, 7), punchOut: new Date(2024, 0, 15, 8, 20) }
    expect(roundEntry(e, 0)).toBe(e)
  })

  it('leaves a still-running entry untouched (no punchOut to bill yet)', () => {
    const e = { punchIn: new Date(2024, 0, 15, 8, 7), punchOut: null }
    expect(roundEntry(e, 15)).toBe(e)
  })

  it('ceils a punch-out with leftover seconds up to the next increment', () => {
    const e = { punchIn: new Date(2024, 0, 15, 8, 0, 0), punchOut: new Date(2024, 0, 15, 8, 30, 1) }
    const r = roundEntry(e, 15)
    expect(r.punchOut).toEqual(new Date(2024, 0, 15, 8, 45))
  })

  it('does NOT inflate a 0-minute (sub-minute) entry to a full increment', () => {
    // Punch in and straight back out: 0 minutes must stay 0, not become 0.25 h.
    const zero = { punchIn: new Date(2024, 0, 15, 8, 7), punchOut: new Date(2024, 0, 15, 8, 7) }
    expect(roundEntry(zero, 15)).toBe(zero)
    expect(getEntryDuration(roundEntry(zero, 15))).toBe(0)
    // A 30-second entry is still "0m" — leave it untouched rather than bill 15 min.
    const subMinute = { punchIn: new Date(2024, 0, 15, 8, 7, 0), punchOut: new Date(2024, 0, 15, 8, 7, 30) }
    expect(roundEntry(subMinute, 15)).toBe(subMinute)
  })
})
