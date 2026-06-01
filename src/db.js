import Dexie from 'dexie'

export const db = new Dexie('PunchInDB')

db.version(1).stores({
  settings:    'key',
  laborTypes:  '++id, name',
  jobs:        '++id, name, laborTypeId, isActive',
  entries:     '++id, jobId, laborTypeId, punchIn',
})

// Seed defaults on first run
db.on('populate', async () => {
  await db.settings.bulkPut([
    { key: 'allowConcurrentTimers', value: false },
    { key: 'weekStartsMonday',      value: true  },
  ])

  await db.laborTypes.bulkAdd([
    { name: 'General',     color: '#6366F1' },
    { name: 'Consulting',  color: '#22C55E' },
    { name: 'Design',      color: '#F59E0B' },
    { name: 'Development', color: '#3B82F6' },
  ])
})

export default db
