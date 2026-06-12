import 'fake-indexeddb/auto'
import { db, deleteEntry, startTimer, DEFAULT_SETTINGS } from './db'

afterAll(async () => {
  await db.close()
  await db.delete()
})

describe('db — schema', () => {
  it('has settings, laborTypes, jobs, and entries tables', () => {
    const names = db.tables.map(t => t.name)
    expect(names).toEqual(expect.arrayContaining(['settings', 'laborTypes', 'jobs', 'entries']))
  })

  it('entries table has a punchOut index (v2 migration)', () => {
    const idx = db.table('entries').schema.indexes.map(i => i.name)
    expect(idx).toContain('punchOut')
  })

  it('settings table uses key as primary key', () => {
    const schema = db.table('settings').schema
    expect(schema.primKey.name).toBe('key')
  })
})

describe('db — populate seed', () => {
  it('seeds exactly the DEFAULT_SETTINGS keys (44, incl. the sync + billing keys) on fresh install', async () => {
    const all = await db.settings.toArray()
    expect(all).toHaveLength(Object.keys(DEFAULT_SETTINGS).length)
    expect(all).toHaveLength(44)
    // Single source of truth (issue #131): the seeded rows match DEFAULT_SETTINGS exactly.
    const seeded = Object.fromEntries(all.map(({ key, value }) => [key, value]))
    expect(seeded).toEqual(DEFAULT_SETTINGS)
  })

  it('seeds the sync keys as null on fresh install (matches factory reset, issue #131)', async () => {
    const all = await db.settings.toArray()
    for (const key of ['syncProvider', 'syncToken', 'syncTokenExpiry', 'syncFileId', 'lastSyncedAt', 'syncError', 'syncUsername']) {
      const row = all.find(s => s.key === key)
      expect(row).toBeDefined()
      expect(row.value).toBeNull()
    }
  })

  it('seeds the per-reminder weekday defaults as all 7 days', async () => {
    const all = await db.settings.toArray()
    for (const key of ['remindIdleDays', 'remindStillRunningDays', 'remindTimesheetDailyDays']) {
      expect(all.find(s => s.key === key)?.value).toEqual([0, 1, 2, 3, 4, 5, 6])
    }
  })

  it('seeds allowConcurrentTimers = false', async () => {
    const s = await db.settings.get('allowConcurrentTimers')
    expect(s?.value).toBe(false)
  })

  it('seeds weekStartsMonday from the device locale (matches the computed default)', async () => {
    const s = await db.settings.get('weekStartsMonday')
    expect(s?.value).toBe(DEFAULT_SETTINGS.weekStartsMonday)
    expect(typeof s?.value).toBe('boolean')
  })

  it('seeds theme = "auto"', async () => {
    const s = await db.settings.get('theme')
    expect(s?.value).toBe('auto')
  })

  it('seeds accentColor = "#2D5BF5"', async () => {
    const s = await db.settings.get('accentColor')
    expect(s?.value).toBe('#2D5BF5')
  })

  it('seeds hapticFeedback = true', async () => {
    const s = await db.settings.get('hapticFeedback')
    expect(s?.value).toBe(true)
  })

  it('seeds remindersEnabled = false (reminders off by default)', async () => {
    const s = await db.settings.get('remindersEnabled')
    expect(s?.value).toBe(false)
  })

  it('seeds remindLongRunningMinutes = 60', async () => {
    const s = await db.settings.get('remindLongRunningMinutes')
    expect(s?.value).toBe(60)
  })

  it('seeds the time-display defaults (decimalHours off, rounding off) (#208)', async () => {
    expect((await db.settings.get('decimalHours'))?.value).toBe(false)
    expect((await db.settings.get('roundingMinutes'))?.value).toBe(0)
  })

  it('seeds zero jobs', async () => {
    const jobs = await db.jobs.toArray()
    expect(jobs).toHaveLength(0)
  })

  it('seeds zero labor types', async () => {
    const lts = await db.laborTypes.toArray()
    expect(lts).toHaveLength(0)
  })
})

describe('db — basic CRUD', () => {
  afterEach(async () => {
    await db.jobs.clear()
    await db.laborTypes.clear()
    await db.entries.clear()
  })

  it('can add and retrieve a job', async () => {
    const id = await db.jobs.add({ name: 'Test Job', isActive: true, laborRates: {} })
    const job = await db.jobs.get(id)
    expect(job?.name).toBe('Test Job')
  })

  it('can add and retrieve a labor type', async () => {
    const id = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const lt = await db.laborTypes.get(id)
    expect(lt?.name).toBe('Design')
  })

  it('can add and retrieve an entry', async () => {
    const punchIn = new Date('2025-01-01T09:00:00')
    const id = await db.entries.add({ jobId: 1, laborTypeId: 1, punchIn, punchOut: null })
    const entry = await db.entries.get(id)
    expect(entry?.punchIn).toEqual(punchIn)
  })
})

describe('db — startTimer', () => {
  afterEach(async () => { await db.entries.clear() })

  it('adds a running entry (punchOut null) for the job/labor type', async () => {
    await startTimer({ jobId: 3, laborTypeId: 7, notes: 'hi' })
    const running = await db.entries.filter(e => !e.punchOut).toArray()
    expect(running).toHaveLength(1)
    expect(running[0]).toMatchObject({ jobId: 3, laborTypeId: 7, punchOut: null, notes: 'hi' })
  })

  it('punches out already-running timers when concurrent timers are off', async () => {
    await db.entries.add({ jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null })
    await startTimer({ jobId: 2, laborTypeId: 1, allowConcurrentTimers: false })
    const running = await db.entries.filter(e => !e.punchOut).toArray()
    expect(running).toHaveLength(1)
    expect(running[0].jobId).toBe(2)
  })

  it('keeps existing timers running when concurrent timers are allowed', async () => {
    await db.entries.add({ jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null })
    await startTimer({ jobId: 2, laborTypeId: 1, allowConcurrentTimers: true })
    const running = await db.entries.filter(e => !e.punchOut).toArray()
    expect(running).toHaveLength(2)
  })
})

describe('db — identity stamping (uuid / updatedAt hooks)', () => {
  afterEach(async () => {
    await db.jobs.clear()
    await db.laborTypes.clear()
    await db.entries.clear()
  })

  it.each([
    ['jobs', { name: 'X', isActive: true, laborRates: {} }],
    ['laborTypes', { name: 'Y', color: '#fff', isArchived: false }],
    ['entries', { jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }],
  ])('stamps a uuid and updatedAt on a newly created %s record', async (table, record) => {
    const id = await db[table].add(record)
    const row = await db[table].get(id)
    expect(typeof row.uuid).toBe('string')
    expect(row.uuid.length).toBeGreaterThan(0)
    expect(typeof row.updatedAt).toBe('number')
  })

  it('gives each record a distinct uuid', async () => {
    const a = await db.jobs.add({ name: 'A', isActive: true, laborRates: {} })
    const b = await db.jobs.add({ name: 'B', isActive: true, laborRates: {} })
    const [ja, jb] = await Promise.all([db.jobs.get(a), db.jobs.get(b)])
    expect(ja.uuid).not.toBe(jb.uuid)
  })

  it('preserves an explicitly-provided uuid/updatedAt (merge path keeps remote identity)', async () => {
    const id = await db.jobs.add({ name: 'Remote', isActive: true, laborRates: {}, uuid: 'fixed-uuid', updatedAt: 123 })
    const job = await db.jobs.get(id)
    expect(job.uuid).toBe('fixed-uuid')
    expect(job.updatedAt).toBe(123)
  })

  it('bumps updatedAt on update', async () => {
    const id = await db.jobs.add({ name: 'X', isActive: true, laborRates: {}, updatedAt: 1 })
    await db.jobs.update(id, { name: 'Y' })
    const job = await db.jobs.get(id)
    expect(job.updatedAt).toBeGreaterThan(1)
  })
})

describe('db — deleteEntry tombstones (issue #118)', () => {
  afterEach(async () => {
    await db.entries.clear()
    await db.deletions.clear()
  })

  it('hard-deletes the entry and records a tombstone keyed by its uuid', async () => {
    const id = await db.entries.add({ jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null })
    const { uuid } = await db.entries.get(id)
    await deleteEntry(id)
    expect(await db.entries.get(id)).toBeUndefined()
    const tomb = await db.deletions.get(uuid)
    expect(tomb?.uuid).toBe(uuid)
    expect(typeof tomb.deletedAt).toBe('number')
  })

  it('is a no-op for a missing entry (no tombstone written)', async () => {
    await expect(deleteEntry(99999)).resolves.toBeUndefined()
    expect(await db.deletions.toArray()).toHaveLength(0)
  })
})

describe('db — indexed punchIn range queries (issue #132)', () => {
  afterEach(async () => { await db.entries.clear() })

  // Guards the perf refactor: the views now query the punchIn index via
  // .where('punchIn').between(...) instead of scanning the whole table. Because
  // punchIn is stored as a Date, the index range must return exactly the same
  // rows the old isEntryInRange() predicate did — including the boundaries.
  it('between() returns only entries whose Date punchIn falls in [start, end] inclusive', async () => {
    const start = new Date('2025-03-10T00:00:00')
    const end   = new Date('2025-03-10T23:59:59.999')
    await db.entries.bulkAdd([
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-09T23:59:59'), punchOut: null }, // before
      { jobId: 1, laborTypeId: 1, punchIn: start,                                punchOut: null }, // start boundary
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-10T12:00:00'), punchOut: null }, // inside
      { jobId: 1, laborTypeId: 1, punchIn: end,                                  punchOut: null }, // end boundary
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-11T00:00:01'), punchOut: null }, // after
    ])
    const inRange = await db.entries.where('punchIn').between(start, end, true, true).toArray()
    const times = inRange.map(e => e.punchIn.getTime()).sort()
    expect(times).toEqual([start, new Date('2025-03-10T12:00:00'), end].map(d => d.getTime()).sort())
  })

  it('aboveOrEqual() with a completed-only .and() predicate matches the Analytics query', async () => {
    const cutoff = new Date('2025-03-10T00:00:00')
    await db.entries.bulkAdd([
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-09T10:00:00'), punchOut: new Date('2025-03-09T11:00:00') }, // before cutoff
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-10T10:00:00'), punchOut: new Date('2025-03-10T11:00:00') }, // after, completed
      { jobId: 1, laborTypeId: 1, punchIn: new Date('2025-03-11T10:00:00'), punchOut: null },                            // after, still running
    ])
    const result = await db.entries.where('punchIn').aboveOrEqual(cutoff).and(e => !!e.punchOut).toArray()
    expect(result).toHaveLength(1)
    expect(result[0].punchIn.getTime()).toBe(new Date('2025-03-10T10:00:00').getTime())
  })
})
