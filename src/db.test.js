import 'fake-indexeddb/auto'
import { db, deleteEntry, clearAllEntries, startTimer, DEFAULT_SETTINGS, deleteJob, deleteLaborType, jobsUsingLaborType } from './db'

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
  it('seeds exactly the DEFAULT_SETTINGS keys (47, incl. the sync + billing keys) on fresh install', async () => {
    const all = await db.settings.toArray()
    expect(all).toHaveLength(Object.keys(DEFAULT_SETTINGS).length)
    expect(all).toHaveLength(47)
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

// The Danger Zone "Clear time entries" action is documented as permanent, but a
// bare entries.clear() writes no tombstones — so the very next sync pulls every
// cleared entry back from the remote snapshot (issue: audit 2026-08-14). Even a
// single-device user resurrects, because the GitHub provider re-reads the
// device's own file. Clearing must tombstone exactly like deleteEntry does.
describe('db — clearAllEntries tombstones', () => {
  afterEach(async () => {
    await db.entries.clear()
    await db.deletions.clear()
  })

  it('clears every entry and records a tombstone for each', async () => {
    const a = await db.entries.add({ jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: new Date() })
    const b = await db.entries.add({ jobId: 2, laborTypeId: 1, punchIn: new Date(), punchOut: new Date() })
    const uuidA = (await db.entries.get(a)).uuid
    const uuidB = (await db.entries.get(b)).uuid

    await clearAllEntries()

    expect(await db.entries.toArray()).toHaveLength(0)
    expect(await db.deletions.get(uuidA)).toBeTruthy()
    expect(await db.deletions.get(uuidB)).toBeTruthy()
  })

  it('leaves jobs and labor types untouched', async () => {
    const jobId = await db.jobs.add({ name: 'Keeper', isActive: true, laborRates: {} })
    await db.entries.add({ jobId, laborTypeId: 1, punchIn: new Date(), punchOut: new Date() })

    await clearAllEntries()

    expect(await db.jobs.get(jobId)).toBeTruthy()
    await db.jobs.clear()
  })

  it('is a no-op on an empty table', async () => {
    await expect(clearAllEntries()).resolves.toBeUndefined()
    expect(await db.deletions.toArray()).toHaveLength(0)
  })
})

describe('deleteJob', () => {
  afterEach(async () => {
    await db.jobs.clear()
    await db.laborTypes.clear()
    await db.entries.clear()
    await db.deletions.clear()
  })

  it('freezes job name+colour onto referencing entries, tombstones, and deletes the job', async () => {
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6FA8FF', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Acme', isActive: false, laborRates: {}, color: '#FF8FA3' })
    const job = await db.jobs.get(jobId)
    const eId = await db.entries.add({ jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: new Date('2025-01-01T10:00:00Z') })

    await deleteJob(jobId)

    expect(await db.jobs.get(jobId)).toBeUndefined()
    expect(await db.deletions.get(job.uuid)).toBeTruthy()
    const e = await db.entries.get(eId)
    expect(e.frozenRefs.job).toEqual({ name: 'Acme', color: '#FF8FA3' })
  })

  it('freezes the labor-type colour when the job has no own colour', async () => {
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6FA8FF', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Acme', isActive: false, laborRates: {}, laborTypeId: ltId })
    const eId = await db.entries.add({ jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: null })

    await deleteJob(jobId)

    expect((await db.entries.get(eId)).frozenRefs.job).toEqual({ name: 'Acme', color: '#6FA8FF' })
  })
})

describe('jobsUsingLaborType', () => {
  afterEach(async () => {
    await db.jobs.clear()
    await db.laborTypes.clear()
  })

  it('finds live jobs referencing a labor type by default type or per-type rate', async () => {
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#111', isArchived: false })
    await db.jobs.add({ name: 'ByDefault', isActive: true, laborRates: {}, laborTypeId: ltId })
    await db.jobs.add({ name: 'ByRate', isActive: true, laborRates: { [ltId]: 90 } })
    await db.jobs.add({ name: 'Archived', isActive: false, laborRates: { [ltId]: 90 } })
    await db.jobs.add({ name: 'Unrelated', isActive: true, laborRates: {} })

    const live = await jobsUsingLaborType(ltId, { liveOnly: true })
    expect(live.map(j => j.name).sort()).toEqual(['ByDefault', 'ByRate'])
    const all = await jobsUsingLaborType(ltId)
    expect(all.map(j => j.name).sort()).toEqual(['Archived', 'ByDefault', 'ByRate'])
  })
})

describe('deleteLaborType', () => {
  afterEach(async () => {
    await db.jobs.clear()
    await db.laborTypes.clear()
    await db.entries.clear()
    await db.deletions.clear()
  })

  it('blocks deletion while a live job references it', async () => {
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#111', isArchived: true })
    await db.jobs.add({ name: 'LiveUser', isActive: true, laborRates: { [ltId]: 90 } })

    await expect(deleteLaborType(ltId)).rejects.toThrow('LABOR_TYPE_IN_USE')
    expect(await db.laborTypes.get(ltId)).toBeTruthy()
  })

  it('freezes name+colour+glyph onto entries, tombstones, and deletes when no live job uses it', async () => {
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#5FD08A', glyph: 'code', isArchived: true })
    const lt = await db.laborTypes.get(ltId)
    const jobId = await db.jobs.add({ name: 'Archived', isActive: false, laborRates: { [ltId]: 90 } })
    const eId = await db.entries.add({ jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: null })

    await deleteLaborType(ltId)

    expect(await db.laborTypes.get(ltId)).toBeUndefined()
    expect(await db.deletions.get(lt.uuid)).toBeTruthy()
    expect((await db.entries.get(eId)).frozenRefs.laborType).toEqual({ name: 'Dev', color: '#5FD08A', glyph: 'code' })
  })

  it('merges with an existing frozenRefs.job (an entry whose job was already deleted)', async () => {
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#5FD08A', glyph: 'code', isArchived: true })
    const eId = await db.entries.add({ jobId: 999, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: null, frozenRefs: { job: { name: 'Gone', color: '#abc' } } })

    await deleteLaborType(ltId)

    const e = await db.entries.get(eId)
    expect(e.frozenRefs.job).toEqual({ name: 'Gone', color: '#abc' })
    expect(e.frozenRefs.laborType.name).toBe('Dev')
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
