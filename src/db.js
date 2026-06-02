import Dexie from 'dexie'

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
    { key: 'accentColor',           value: '#F59E0B' },
  ])
})

export default db
