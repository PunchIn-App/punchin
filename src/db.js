import Dexie from 'dexie'

export const db = new Dexie('PunchInDB')

db.version(1).stores({
  settings:    'key',
  laborTypes:  '++id, name',
  jobs:        '++id, name, laborTypeId, isActive',
  entries:     '++id, jobId, laborTypeId, punchIn',
})

// Seed default settings on first run — no jobs or labor types pre-loaded
db.on('populate', async () => {
  await db.settings.bulkPut([
    { key: 'allowConcurrentTimers', value: false },
    { key: 'weekStartsMonday',      value: true  },
  ])
})

export default db
