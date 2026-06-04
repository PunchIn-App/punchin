import { formatDurationHM } from './time'

// Pure reminder evaluation (issue #54). Given the current time, the user's
// reminder settings, the live timers, and a small persisted state map (used to
// avoid firing the same reminder twice), it returns the notifications to fire
// now plus the updated state. Keeping this pure makes the scheduling logic
// fully unit-testable without timers, the DOM, or the Notification API.

export function parseHHMM(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Stable per-day key (local time) used to fire time-of-day reminders at most
// once per day.
export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// Whether a reminder may fire on the given weekday (0=Sun … 6=Sat). `days` is an
// optional array of allowed weekday numbers; a missing/non-array value means
// "every day" so reminders configured before this option keep firing as before.
export function dayAllowed(weekday, days) {
  if (!Array.isArray(days)) return true
  return days.includes(weekday)
}

export function evaluateReminders({ now, settings, activeEntries = [], jobs = [], state = {} }) {
  const fire = []
  const next = { ...state }

  if (!settings || !settings.remindersEnabled) {
    return { fire, state: next }
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = dayKey(now)
  const weekday = now.getDay()
  const jobName = (id) => jobs.find(j => j.id === id)?.name || 'A job'

  // 1. Long-running timer — fires once per threshold interval an active timer
  //    has been running (e.g. every 60 min). The crossing count de-dupes so a
  //    30s poll doesn't spam.
  if (settings.remindLongRunning !== false) {
    const thresholdMs = Math.max(1, Number(settings.remindLongRunningMinutes) || 60) * 60000
    for (const e of activeEntries) {
      const elapsed = now.getTime() - new Date(e.punchIn).getTime()
      const crossed = Math.floor(elapsed / thresholdMs)
      if (crossed >= 1) {
        const k = `long:${e.id}`
        if (next[k] !== crossed) {
          next[k] = crossed
          fire.push({
            key: k,
            title: 'Timer still running',
            body: `${jobName(e.jobId)} has been running for ${formatDurationHM(elapsed)}.`,
          })
        }
      }
    }
  }

  // Drop long-running state for timers that are no longer active so a future
  // run of the same job id starts clean.
  const activeKeys = new Set(activeEntries.map(e => `long:${e.id}`))
  for (const k of Object.keys(next)) {
    if (k.startsWith('long:') && !activeKeys.has(k)) delete next[k]
  }

  // 2. No timer running by a chosen time of day (on the allowed weekdays).
  if (settings.remindIdle && dayAllowed(weekday, settings.remindIdleDays)) {
    const target = parseHHMM(settings.remindIdleTime)
    if (target != null && nowMin >= target && activeEntries.length === 0 && next.idle !== today) {
      next.idle = today
      fire.push({
        key: 'idle',
        title: 'No timer running',
        body: "You don't have a timer running yet — punch in to start tracking.",
      })
    }
  }

  // 3. Timer still running at a chosen time of day (on the allowed weekdays).
  if (settings.remindStillRunning && dayAllowed(weekday, settings.remindStillRunningDays)) {
    const target = parseHHMM(settings.remindStillRunningTime)
    if (target != null && nowMin >= target && activeEntries.length > 0 && next.still !== today) {
      next.still = today
      const n = activeEntries.length
      fire.push({
        key: 'still',
        title: 'Timer still running',
        body: `You still have ${n === 1 ? 'a timer' : `${n} timers`} running — don't forget to punch out.`,
      })
    }
  }

  // 4. Daily timesheet reminder (on the allowed weekdays).
  if (settings.remindTimesheetDaily && dayAllowed(weekday, settings.remindTimesheetDailyDays)) {
    const target = parseHHMM(settings.remindTimesheetDailyTime)
    if (target != null && nowMin >= target && next.tsDaily !== today) {
      next.tsDaily = today
      fire.push({
        key: 'tsDaily',
        title: 'Daily timesheet',
        body: "Review and submit today's hours.",
      })
    }
  }

  // 5. Weekly timesheet reminder on a chosen weekday.
  if (settings.remindTimesheetWeekly) {
    const target = parseHHMM(settings.remindTimesheetWeeklyTime)
    const day = Number(settings.remindTimesheetWeeklyDay)
    if (target != null && now.getDay() === day && nowMin >= target && next.tsWeekly !== today) {
      next.tsWeekly = today
      fire.push({
        key: 'tsWeekly',
        title: 'Weekly timesheet',
        body: "Time to review and submit this week's hours.",
      })
    }
  }

  return { fire, state: next }
}
