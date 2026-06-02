import 'fake-indexeddb/auto'
import { db } from './db'

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
  it('seeds exactly 4 default settings', async () => {
    const all = await db.settings.toArray()
    expect(all).toHaveLength(4)
  })

  it('seeds allowConcurrentTimers = false', async () => {
    const s = await db.settings.get('allowConcurrentTimers')
    expect(s?.value).toBe(false)
  })

  it('seeds weekStartsMonday = true', async () => {
    const s = await db.settings.get('weekStartsMonday')
    expect(s?.value).toBe(true)
  })

  it('seeds theme = "auto"', async () => {
    const s = await db.settings.get('theme')
    expect(s?.value).toBe('auto')
  })

  it('seeds accentColor = "#F59E0B"', async () => {
    const s = await db.settings.get('accentColor')
    expect(s?.value).toBe('#F59E0B')
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
