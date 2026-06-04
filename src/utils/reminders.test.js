import { describe, it, expect } from 'vitest'
import { evaluateReminders, parseHHMM, dayKey, dayAllowed } from './reminders'

const at = (h, m = 0) => {
  const d = new Date(2026, 5, 3, h, m, 0) // Wed, 3 Jun 2026
  return d
}
const minsAgo = (now, mins) => new Date(now.getTime() - mins * 60000)

describe('parseHHMM', () => {
  it('parses valid HH:MM into minutes', () => {
    expect(parseHHMM('00:00')).toBe(0)
    expect(parseHHMM('09:30')).toBe(570)
    expect(parseHHMM('23:59')).toBe(1439)
    expect(parseHHMM('9:05')).toBe(545)
  })

  it('returns null for invalid input', () => {
    expect(parseHHMM('')).toBeNull()
    expect(parseHHMM(null)).toBeNull()
    expect(parseHHMM('24:00')).toBeNull()
    expect(parseHHMM('12:60')).toBeNull()
    expect(parseHHMM('abc')).toBeNull()
  })
})

describe('dayKey', () => {
  it('is stable within a day and differs across days', () => {
    expect(dayKey(at(8))).toBe(dayKey(at(20)))
    expect(dayKey(new Date(2026, 5, 3))).not.toBe(dayKey(new Date(2026, 5, 4)))
  })
})

describe('evaluateReminders — gating', () => {
  it('fires nothing when settings are missing', () => {
    expect(evaluateReminders({ now: at(10), settings: null }).fire).toEqual([])
  })

  it('fires nothing when reminders are disabled', () => {
    const { fire } = evaluateReminders({
      now: at(10),
      settings: { remindersEnabled: false, remindLongRunning: true },
      activeEntries: [{ id: 1, jobId: 1, punchIn: minsAgo(at(10), 120) }],
    })
    expect(fire).toEqual([])
  })
})

describe('evaluateReminders — long-running timer', () => {
  const base = { remindersEnabled: true, remindLongRunning: true, remindLongRunningMinutes: 60 }

  it('fires once when a timer crosses the threshold', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 75) }]
    const jobs = [{ id: 1, name: 'Acme' }]
    const { fire, state } = evaluateReminders({ now, settings: base, activeEntries: entries, jobs })
    expect(fire).toHaveLength(1)
    expect(fire[0].key).toBe('long:7')
    expect(fire[0].title).toBe('Timer still running')
    expect(fire[0].body).toContain('Acme')
    // Same crossing → no repeat
    const second = evaluateReminders({ now, settings: base, activeEntries: entries, jobs, state })
    expect(second.fire).toEqual([])
  })

  it('fires again after the next threshold interval', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 65) }]
    const first = evaluateReminders({ now, settings: base, activeEntries: entries })
    expect(first.fire).toHaveLength(1)
    // 130 min later → second crossing
    const later = new Date(now.getTime() + 65 * 60000)
    const second = evaluateReminders({ now: later, settings: base, activeEntries: entries, state: first.state })
    expect(second.fire).toHaveLength(1)
  })

  it('does not fire before the threshold', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 30) }]
    expect(evaluateReminders({ now, settings: base, activeEntries: entries }).fire).toEqual([])
  })

  it('honors the configured threshold', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 20) }]
    const settings = { ...base, remindLongRunningMinutes: 15 }
    expect(evaluateReminders({ now, settings, activeEntries: entries }).fire).toHaveLength(1)
  })

  it('is skipped when remindLongRunning is false', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 120) }]
    const settings = { ...base, remindLongRunning: false }
    expect(evaluateReminders({ now, settings, activeEntries: entries }).fire).toEqual([])
  })

  it('clears state for timers that are no longer active', () => {
    const now = at(10)
    const entries = [{ id: 7, jobId: 1, punchIn: minsAgo(now, 70) }]
    const { state } = evaluateReminders({ now, settings: base, activeEntries: entries })
    expect(state['long:7']).toBe(1)
    const after = evaluateReminders({ now, settings: base, activeEntries: [], state })
    expect(after.state['long:7']).toBeUndefined()
  })
})

describe('evaluateReminders — time-of-day reminders', () => {
  it('fires the idle reminder once per day after the time when no timer runs', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00' }
    const before = evaluateReminders({ now: at(8, 30), settings, activeEntries: [] })
    expect(before.fire).toEqual([])
    const after = evaluateReminders({ now: at(9, 30), settings, activeEntries: [] })
    expect(after.fire.map(f => f.key)).toContain('idle')
    const repeat = evaluateReminders({ now: at(10), settings, activeEntries: [], state: after.state })
    expect(repeat.fire).toEqual([])
  })

  it('does not fire the idle reminder while a timer is running', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00' }
    const { fire } = evaluateReminders({ now: at(10), settings, activeEntries: [{ id: 1, jobId: 1, punchIn: at(9) }] })
    expect(fire).toEqual([])
  })

  it('fires the still-running reminder when a timer is active past the time', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindStillRunning: true, remindStillRunningTime: '17:00' }
    const { fire } = evaluateReminders({ now: at(17, 30), settings, activeEntries: [{ id: 1, jobId: 1, punchIn: at(16) }] })
    expect(fire.map(f => f.key)).toContain('still')
  })

  it('fires the daily timesheet reminder after its time', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindTimesheetDaily: true, remindTimesheetDailyTime: '17:00' }
    const { fire } = evaluateReminders({ now: at(17, 5), settings })
    expect(fire.map(f => f.key)).toContain('tsDaily')
  })

  it('fires the weekly reminder only on the configured weekday', () => {
    // 3 Jun 2026 is a Wednesday (day 3)
    const settings = { remindersEnabled: true, remindLongRunning: false, remindTimesheetWeekly: true, remindTimesheetWeeklyDay: 3, remindTimesheetWeeklyTime: '16:00' }
    expect(evaluateReminders({ now: at(16, 30), settings }).fire.map(f => f.key)).toContain('tsWeekly')

    const otherDay = { ...settings, remindTimesheetWeeklyDay: 5 }
    expect(evaluateReminders({ now: at(16, 30), settings: otherDay }).fire).toEqual([])
  })
})

describe('dayAllowed', () => {
  it('returns true when days is not an array (every day)', () => {
    expect(dayAllowed(3, undefined)).toBe(true)
    expect(dayAllowed(0, null)).toBe(true)
  })
  it('respects an explicit allowed-days list', () => {
    expect(dayAllowed(3, [1, 2, 3, 4, 5])).toBe(true)
    expect(dayAllowed(0, [1, 2, 3, 4, 5])).toBe(false)
  })
  it('treats an empty list as never', () => {
    expect(dayAllowed(3, [])).toBe(false)
  })
})

describe('evaluateReminders — day-of-week gating', () => {
  // at() is a Wednesday (day 3).
  it('skips the idle reminder when today is not an allowed day', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00', remindIdleDays: [1, 2, 4, 5] }
    expect(evaluateReminders({ now: at(10), settings, activeEntries: [] }).fire).toEqual([])
  })
  it('fires the idle reminder when today is an allowed day', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00', remindIdleDays: [3] }
    expect(evaluateReminders({ now: at(10), settings, activeEntries: [] }).fire.map(f => f.key)).toContain('idle')
  })
  it('skips the still-running reminder outside its allowed days', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindStillRunning: true, remindStillRunningTime: '17:00', remindStillRunningDays: [0, 6] }
    expect(evaluateReminders({ now: at(17, 30), settings, activeEntries: [{ id: 1, jobId: 1, punchIn: at(16) }] }).fire).toEqual([])
  })
  it('skips the daily timesheet reminder outside its allowed days', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindTimesheetDaily: true, remindTimesheetDailyTime: '17:00', remindTimesheetDailyDays: [1, 2, 4, 5] }
    expect(evaluateReminders({ now: at(17, 5), settings }).fire).toEqual([])
  })
  it('still fires when days arrays are absent (back-compat)', () => {
    const settings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00' }
    expect(evaluateReminders({ now: at(10), settings, activeEntries: [] }).fire.map(f => f.key)).toContain('idle')
  })
})
