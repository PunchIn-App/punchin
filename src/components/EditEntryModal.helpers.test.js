import {
  formatDateToYYYYMMDD,
  formatTimeToHHMM,
  combineDateAndTime,
} from './EditEntryModal'

// ---------------------------------------------------------------------------
// formatDateToYYYYMMDD
// ---------------------------------------------------------------------------
describe('formatDateToYYYYMMDD', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateToYYYYMMDD(new Date(2024, 0, 15))).toBe('2024-01-15')
  })

  it('pads single-digit month with a leading zero', () => {
    expect(formatDateToYYYYMMDD(new Date(2024, 2, 5))).toBe('2024-03-05')
  })

  it('pads single-digit day with a leading zero', () => {
    expect(formatDateToYYYYMMDD(new Date(2024, 11, 3))).toBe('2024-12-03')
  })

  it('handles end of year', () => {
    expect(formatDateToYYYYMMDD(new Date(2024, 11, 31))).toBe('2024-12-31')
  })

  it('returns empty string for an invalid date', () => {
    expect(formatDateToYYYYMMDD('not-a-date')).toBe('')
  })

  it('returns empty string for NaN date', () => {
    expect(formatDateToYYYYMMDD(new Date('invalid'))).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatTimeToHHMM
// ---------------------------------------------------------------------------
describe('formatTimeToHHMM', () => {
  it('formats afternoon time as HH:MM', () => {
    expect(formatTimeToHHMM(new Date(2024, 0, 15, 14, 30))).toBe('14:30')
  })

  it('pads single-digit hours with a leading zero', () => {
    expect(formatTimeToHHMM(new Date(2024, 0, 15, 9, 5))).toBe('09:05')
  })

  it('formats midnight as 00:00', () => {
    expect(formatTimeToHHMM(new Date(2024, 0, 15, 0, 0))).toBe('00:00')
  })

  it('formats 23:59 correctly', () => {
    expect(formatTimeToHHMM(new Date(2024, 0, 15, 23, 59))).toBe('23:59')
  })

  it('returns empty string for an invalid date', () => {
    expect(formatTimeToHHMM('invalid')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// combineDateAndTime
// ---------------------------------------------------------------------------
describe('combineDateAndTime', () => {
  it('produces the correct year, month, day, hour, and minute', () => {
    const result = combineDateAndTime('2024-01-15', '14:30')
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(0)   // January = 0
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
  })

  it('sets seconds and milliseconds to zero', () => {
    const result = combineDateAndTime('2024-01-15', '09:00')
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('handles midnight (00:00)', () => {
    const result = combineDateAndTime('2024-01-15', '00:00')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('handles end-of-day (23:59)', () => {
    const result = combineDateAndTime('2024-01-15', '23:59')
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
  })

  it('returns null when dateStr is empty', () => {
    expect(combineDateAndTime('', '14:30')).toBeNull()
  })

  it('returns null when timeStr is empty', () => {
    expect(combineDateAndTime('2024-01-15', '')).toBeNull()
  })

  it('returns null when both args are empty', () => {
    expect(combineDateAndTime('', '')).toBeNull()
  })

  it('round-trips with formatDateToYYYYMMDD and formatTimeToHHMM', () => {
    const original = new Date(2024, 5, 15, 9, 45)
    const result = combineDateAndTime(
      formatDateToYYYYMMDD(original),
      formatTimeToHHMM(original),
    )
    expect(result.getFullYear()).toBe(original.getFullYear())
    expect(result.getMonth()).toBe(original.getMonth())
    expect(result.getDate()).toBe(original.getDate())
    expect(result.getHours()).toBe(original.getHours())
    expect(result.getMinutes()).toBe(original.getMinutes())
  })
})
