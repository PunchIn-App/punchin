import Dexie from 'dexie'

/**
 * @typedef {'auto'|'dark'|'light'} Theme
 *
 * @typedef {{ key: string, value: boolean|string }} Setting
 *
 * @typedef {{
 *   id?: number,
 *   name: string,
 *   color: string,
 *   isArchived: boolean,
 * }} LaborType
 *
 * @typedef {{
 *   id?: number,
 *   name: string,
 *   laborTypeId: number,
 *   isActive: boolean,
 *   isDeleted?: boolean,
 *   laborRates?: Record<number, number>,
 * }} Job
 *
 * @typedef {{
 *   id?: number,
 *   jobId: number,
 *   laborTypeId: number,
 *   punchIn: Date,
 *   punchOut: Date|null,
 *   note?: string,
 * }} Entry
 */

export const db = new Dexie('PunchInDB')

db.version(1).stores({
  settings:    'key',
  laborTypes:  '++id, name',
  jobs:        '++id, name, laborTypeId, isActive',
  entries:     '++id, jobId, laborTypeId, punchIn',
})

db.version(2).stores({
  entries:     '++id, jobId, laborTypeId, punchIn, punchOut',
})

// Seed default settings on first run — no jobs or labor types pre-loaded
db.on('populate', async () => {
  await db.settings.bulkPut([
    { key: 'allowConcurrentTimers', value: false },
    { key: 'weekStartsMonday',      value: true  },
    { key: 'theme',                 value: 'auto' },
    { key: 'accentColor',           value: '#1f6feb' },
    { key: 'hapticFeedback',        value: true  },
    // Reminder notifications (issue #54) — all off by default; the master
    // toggle requests notification permission when first enabled.
    { key: 'remindersEnabled',          value: false   },
    { key: 'remindLongRunning',         value: true    },
    { key: 'remindLongRunningMinutes',  value: 60      },
    { key: 'remindIdle',                value: false   },
    { key: 'remindIdleTime',            value: '09:00' },
    { key: 'remindStillRunning',        value: false   },
    { key: 'remindStillRunningTime',    value: '17:00' },
    { key: 'remindTimesheetDaily',      value: false   },
    { key: 'remindTimesheetDailyTime',  value: '17:00' },
    { key: 'remindTimesheetWeekly',     value: false   },
    { key: 'remindTimesheetWeeklyDay',  value: 5       },
    { key: 'remindTimesheetWeeklyTime', value: '16:00' },
  ])
})

export default db
