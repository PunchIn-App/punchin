import 'fake-indexeddb/auto'
import { db } from '../db'
import { exportSnapshot, runSync, disconnectSync } from './syncManager'
import * as github from './providers/github'
import * as google from './providers/google'
import * as onedrive from './providers/onedrive'

vi.mock('./providers/github', () => ({
  buildGitHubOAuthUrl: vi.fn(),
  createGist: vi.fn(),
  updateGist: vi.fn(),
  fetchGist: vi.fn(),
}))

vi.mock('./providers/google', () => ({
  pushToDrive: vi.fn(),
  pullFromDrive: vi.fn(),
}))

vi.mock('./providers/onedrive', () => ({
  pushToOneDrive: vi.fn(),
  pullFromOneDrive: vi.fn(),
}))

// Seed sync-related settings into the DB
async function seedSyncSettings(overrides = {}) {
  const defaults = {
    syncProvider: 'github',
    syncToken: 'test-token',
    syncTokenExpiry: null,
    syncFileId: 'gist-123',
    lastSyncedAt: null,
  }
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    await db.settings.put({ key, value })
  }
}

// Clear sync settings and data tables before each test
beforeEach(async () => {
  vi.clearAllMocks()
  await db.jobs.clear()
  await db.laborTypes.clear()
  await db.entries.clear()
  for (const key of ['syncProvider', 'syncToken', 'syncTokenExpiry', 'syncFileId', 'lastSyncedAt']) {
    await db.settings.delete(key)
  }
})

afterAll(async () => {
  await db.close()
  await db.delete()
})

// ---------------------------------------------------------------------------
// exportSnapshot
// ---------------------------------------------------------------------------

describe('exportSnapshot', () => {
  it('returns version: 1', async () => {
    const snap = await exportSnapshot()
    expect(snap.version).toBe(1)
  })

  it('includes exportedAt as an ISO 8601 string', async () => {
    const snap = await exportSnapshot()
    expect(typeof snap.exportedAt).toBe('string')
    expect(() => new Date(snap.exportedAt)).not.toThrow()
    expect(new Date(snap.exportedAt).toISOString()).toBe(snap.exportedAt)
  })

  it('includes all jobs from the DB', async () => {
    await db.jobs.bulkAdd([
      { name: 'Job A', isActive: true, laborRates: {} },
      { name: 'Job B', isActive: false, laborRates: {} },
    ])
    const snap = await exportSnapshot()
    expect(snap.jobs).toHaveLength(2)
    expect(snap.jobs.map(j => j.name)).toEqual(expect.arrayContaining(['Job A', 'Job B']))
  })

  it('includes all labor types from the DB', async () => {
    await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const snap = await exportSnapshot()
    expect(snap.laborTypes).toHaveLength(1)
    expect(snap.laborTypes[0].name).toBe('Design')
  })

  it('includes all entries including active timers (punchOut: null)', async () => {
    const jobId = await db.jobs.add({ name: 'Job A', isActive: true, laborRates: {} })
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#F59E0B', isArchived: false })
    await db.entries.bulkAdd([
      { jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: new Date('2025-01-01T10:00:00Z') },
      { jobId, laborTypeId: ltId, punchIn: new Date('2025-01-02T09:00:00Z'), punchOut: null },
    ])
    const snap = await exportSnapshot()
    expect(snap.entries).toHaveLength(2)
    expect(snap.entries.some(e => e.punchOut === null)).toBe(true)
  })

  it('returns empty arrays when the DB has no data', async () => {
    const snap = await exportSnapshot()
    expect(snap.jobs).toEqual([])
    expect(snap.entries).toEqual([])
    expect(snap.laborTypes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// disconnectSync
// ---------------------------------------------------------------------------

describe('disconnectSync', () => {
  it('sets all 5 sync settings to null', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncToken: 'tok', lastSyncedAt: 12345 })
    await disconnectSync()
    const keys = ['syncProvider', 'syncToken', 'syncTokenExpiry', 'syncFileId', 'lastSyncedAt']
    for (const key of keys) {
      const row = await db.settings.get(key)
      expect(row?.value).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// runSync — auth guards
// ---------------------------------------------------------------------------

describe('runSync — auth guards', () => {
  it('throws "Not connected" when syncProvider is absent', async () => {
    await expect(runSync()).rejects.toThrow('Not connected')
  })

  it('throws "Not connected" when syncToken is absent', async () => {
    await db.settings.put({ key: 'syncProvider', value: 'github' })
    await expect(runSync()).rejects.toThrow('Not connected')
  })

  it('throws "TOKEN_EXPIRED" when syncTokenExpiry is in the past', async () => {
    await seedSyncSettings({ syncTokenExpiry: Date.now() - 1000 })
    await expect(runSync()).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('does not throw for a token that has not expired', async () => {
    await seedSyncSettings({ syncTokenExpiry: Date.now() + 60_000 })
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    await expect(runSync()).resolves.not.toThrow()
  })

  it('does not throw when syncTokenExpiry is null (GitHub tokens never expire)', async () => {
    await seedSyncSettings({ syncTokenExpiry: null })
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    await expect(runSync()).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// runSync — GitHub provider
// ---------------------------------------------------------------------------

describe('runSync — GitHub provider', () => {
  it('calls fetchGist with the stored token and fileId', async () => {
    await seedSyncSettings({ syncFileId: 'existing-gist' })
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.fetchGist).toHaveBeenCalledWith('test-token', 'existing-gist')
  })

  it('calls updateGist when a fileId is already stored', async () => {
    await seedSyncSettings({ syncFileId: 'existing-gist' })
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.updateGist).toHaveBeenCalledWith('test-token', 'existing-gist', expect.any(Object))
  })

  it('calls createGist and saves the new id when no fileId is stored', async () => {
    await seedSyncSettings({ syncFileId: null })
    github.createGist.mockResolvedValueOnce('brand-new-gist-id')
    await runSync()
    expect(github.createGist).toHaveBeenCalled()
    const stored = await db.settings.get('syncFileId')
    expect(stored?.value).toBe('brand-new-gist-id')
  })

  it('does not call fetchGist when no fileId is stored', async () => {
    await seedSyncSettings({ syncFileId: null })
    github.createGist.mockResolvedValueOnce('new-id')
    await runSync()
    expect(github.fetchGist).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// runSync — Google provider
// ---------------------------------------------------------------------------

describe('runSync — Google provider', () => {
  it('calls pullFromDrive and pushToDrive with the stored token', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncFileId: null })
    google.pullFromDrive.mockResolvedValueOnce(null)
    google.pushToDrive.mockResolvedValueOnce('drive-file-id')
    await runSync()
    expect(google.pullFromDrive).toHaveBeenCalledWith('test-token')
    expect(google.pushToDrive).toHaveBeenCalledWith('test-token', expect.any(Object))
  })

  it('does not call any GitHub functions when provider is google', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncFileId: null })
    google.pullFromDrive.mockResolvedValueOnce(null)
    google.pushToDrive.mockResolvedValueOnce('id')
    await runSync()
    expect(github.fetchGist).not.toHaveBeenCalled()
    expect(github.createGist).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// runSync — OneDrive provider
// ---------------------------------------------------------------------------

describe('runSync — OneDrive provider', () => {
  it('calls pullFromOneDrive and pushToOneDrive with the stored token', async () => {
    await seedSyncSettings({ syncProvider: 'onedrive', syncFileId: null })
    onedrive.pullFromOneDrive.mockResolvedValueOnce(null)
    onedrive.pushToOneDrive.mockResolvedValueOnce('od-file-id')
    await runSync()
    expect(onedrive.pullFromOneDrive).toHaveBeenCalledWith('test-token')
    expect(onedrive.pushToOneDrive).toHaveBeenCalledWith('test-token', expect.any(Object))
  })

  it('does not call any GitHub functions when provider is onedrive', async () => {
    await seedSyncSettings({ syncProvider: 'onedrive', syncFileId: null })
    onedrive.pullFromOneDrive.mockResolvedValueOnce(null)
    onedrive.pushToOneDrive.mockResolvedValueOnce('id')
    await runSync()
    expect(github.fetchGist).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// runSync — return value and DB side-effects
// ---------------------------------------------------------------------------

describe('runSync — timestamp and lastSyncedAt', () => {
  it('returns a millisecond timestamp', async () => {
    await seedSyncSettings()
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    const before = Date.now()
    const ts = await runSync()
    const after = Date.now()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('persists lastSyncedAt in the DB matching the returned timestamp', async () => {
    await seedSyncSettings()
    github.fetchGist.mockResolvedValueOnce(null)
    github.updateGist.mockResolvedValueOnce(undefined)
    const ts = await runSync()
    const stored = await db.settings.get('lastSyncedAt')
    expect(stored?.value).toBe(ts)
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: new data from remote
// ---------------------------------------------------------------------------

describe('runSync — merge new remote data', () => {
  it('imports labor types, jobs, and entries from the remote snapshot', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        jobId: 200,
        laborTypeId: 100,
        punchIn: '2025-01-01T09:00:00.000Z',
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const lts = await db.laborTypes.toArray()
    expect(lts.some(lt => lt.name === 'Design')).toBe(true)
    const jobs = await db.jobs.toArray()
    expect(jobs.some(j => j.name === 'Client Project')).toBe(true)
    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
  })

  it('re-maps remote IDs to local IDs correctly', async () => {
    await seedSyncSettings()
    // Pre-seed a labor type with a different local ID than the remote
    const localLtId = await db.laborTypes.add({ name: 'Development', color: '#F59E0B', isArchived: false })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 999, name: 'Development', color: '#F59E0B' }],
      jobs: [{ id: 888, name: 'My Project', laborTypeId: 999, isActive: true }],
      entries: [{
        jobId: 888,
        laborTypeId: 999,
        punchIn: '2025-03-01T08:00:00.000Z',
        punchOut: '2025-03-01T09:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].laborTypeId).toBe(localLtId)
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: deduplication
// ---------------------------------------------------------------------------

describe('runSync — merge deduplication', () => {
  it('does not create a duplicate labor type when name already exists', async () => {
    await seedSyncSettings()
    await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'Design', color: '#6366F1' }],
      jobs: [],
      entries: [],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const lts = await db.laborTypes.toArray()
    expect(lts.filter(lt => lt.name === 'Design')).toHaveLength(1)
  })

  it('does not create a duplicate job when name already exists', async () => {
    await seedSyncSettings()
    await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [],
      jobs: [{ id: 200, name: 'Client Project', laborTypeId: null, isActive: true }],
      entries: [],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const jobs = await db.jobs.toArray()
    expect(jobs.filter(j => j.name === 'Client Project')).toHaveLength(1)
  })

  it('does not import a duplicate entry on a second sync', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })
    await db.entries.add({
      jobId, laborTypeId: ltId,
      punchIn: new Date('2025-01-01T09:00:00.000Z'),
      punchOut: new Date('2025-01-01T10:00:00.000Z'),
      notes: null,
    })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        jobId: 200, laborTypeId: 100,
        punchIn: '2025-01-01T09:00:00.000Z',
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
  })

  it('imports a new entry when punchIn differs by even 1 ms', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })
    await db.entries.add({
      jobId, laborTypeId: ltId,
      punchIn: new Date('2025-01-01T09:00:00.000Z'),
      punchOut: new Date('2025-01-01T10:00:00.000Z'),
      notes: null,
    })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        jobId: 200, laborTypeId: 100,
        punchIn: '2025-01-01T09:00:00.001Z', // 1 ms later
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(2)
  })

  it('skips remote entries whose job cannot be mapped (unknown jobId)', async () => {
    await seedSyncSettings()

    const remoteSnapshot = {
      version: 1,
      laborTypes: [],
      jobs: [],
      entries: [{
        jobId: 9999, // no matching job
        laborTypeId: null,
        punchIn: '2025-01-01T09:00:00.000Z',
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchGist.mockResolvedValueOnce(remoteSnapshot)
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(0)
  })

  it('returns 0 and does nothing when remote snapshot has no version', async () => {
    await seedSyncSettings()
    // fetchGist returns an invalid snapshot (no version field)
    github.fetchGist.mockResolvedValueOnce({ jobs: [], entries: [], laborTypes: [] })
    github.updateGist.mockResolvedValueOnce(undefined)
    await runSync()
    // Nothing imported
    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(0)
  })
})
