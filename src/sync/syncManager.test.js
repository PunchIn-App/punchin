import 'fake-indexeddb/auto'
import { db, deleteEntry } from '../db'
import { exportSnapshot, importSnapshot, runSync, disconnectSync } from './syncManager'
import { getSyncToken } from './tokenStore'
import * as github from './providers/github'
import * as google from './providers/google'
import * as onedrive from './providers/onedrive'

vi.mock('../utils/deviceId', () => ({
  getDeviceId: vi.fn(() => 'testdevice'),
}))

vi.mock('./providers/github', () => ({
  buildGitHubOAuthUrl: vi.fn(),
  createGist: vi.fn(),
  fetchAllDeviceData: vi.fn(),
  pushDeviceData: vi.fn(),
  deleteDeviceFile: vi.fn(),
  findExistingPunchInGist: vi.fn(),
  fetchGitHubUser: vi.fn(),
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
  await db.deletions.clear()
  await db.secrets.clear() // encrypted sync token store (issue #126)
  await db.settings.clear() // full reset so preference keys don't leak between tests
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

  it('includes portable user preferences but never the sync/account keys', async () => {
    await db.settings.bulkPut([
      { key: 'theme', value: 'light' },
      { key: 'defaultCurrency', value: 'EUR' },
      { key: 'billingName', value: 'Jane Doe' },
      { key: 'syncProvider', value: 'github' },
      { key: 'syncToken', value: 'secret' },
      { key: 'syncFileId', value: 'gist-123' },
    ])
    const snap = await exportSnapshot()
    expect(snap.settings).toMatchObject({ theme: 'light', defaultCurrency: 'EUR', billingName: 'Jane Doe' })
    expect(snap.settings).not.toHaveProperty('syncProvider')
    expect(snap.settings).not.toHaveProperty('syncToken')
    expect(snap.settings).not.toHaveProperty('syncFileId')
  })
})

// ---------------------------------------------------------------------------
// importSnapshot — portable preferences (issue: web→installed-PWA carry-over)
// ---------------------------------------------------------------------------

describe('importSnapshot — portable preferences', () => {
  it('applies the snapshot’s preferences to local settings (an explicit import)', async () => {
    const snap = { version: 1, jobs: [], entries: [], laborTypes: [], deletions: [], settings: { theme: 'light', defaultCurrency: 'EUR' } }
    await importSnapshot(snap)
    expect((await db.settings.get('theme'))?.value).toBe('light')
    expect((await db.settings.get('defaultCurrency'))?.value).toBe('EUR')
  })

  it('never plants sync/account keys carried in an imported snapshot', async () => {
    const snap = { version: 1, jobs: [], entries: [], laborTypes: [], deletions: [], settings: { theme: 'dark', syncToken: 'evil', syncProvider: 'github' } }
    await importSnapshot(snap)
    expect(await db.settings.get('syncToken')).toBeUndefined()
    expect(await db.settings.get('syncProvider')).toBeUndefined()
    expect((await db.settings.get('theme'))?.value).toBe('dark')
  })

  it('is a no-op on settings when the snapshot carries none (legacy backup)', async () => {
    await db.settings.put({ key: 'theme', value: 'dark' })
    await importSnapshot({ version: 1, jobs: [], entries: [], laborTypes: [], deletions: [] })
    expect((await db.settings.get('theme'))?.value).toBe('dark') // untouched
  })
})

// ---------------------------------------------------------------------------
// runSync — seed preferences on a FRESH install only (seed-not-sync)
// ---------------------------------------------------------------------------

describe('runSync — seeds preferences on a fresh install only', () => {
  it('applies remote preferences when the local install has no data (fresh)', async () => {
    await seedSyncSettings()
    const remote = { version: 1, jobs: [], entries: [], laborTypes: [], deletions: [], settings: { theme: 'light', defaultCurrency: 'EUR' } }
    github.fetchAllDeviceData.mockResolvedValueOnce([remote])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect((await db.settings.get('theme'))?.value).toBe('light')
    expect((await db.settings.get('defaultCurrency'))?.value).toBe('EUR')
  })

  it('does NOT overwrite local preferences when the device already has data', async () => {
    await seedSyncSettings()
    await db.settings.put({ key: 'theme', value: 'dark' })
    await db.jobs.add({ name: 'Existing', isActive: true, laborRates: {} }) // not a fresh install
    const remote = { version: 1, jobs: [], entries: [], laborTypes: [], deletions: [], settings: { theme: 'light' } }
    github.fetchAllDeviceData.mockResolvedValueOnce([remote])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect((await db.settings.get('theme'))?.value).toBe('dark') // each established device keeps its own
  })
})

// ---------------------------------------------------------------------------
// disconnectSync
// ---------------------------------------------------------------------------

describe('disconnectSync', () => {
  // disconnectSync now POSTs a best-effort grant-revoke to the worker (/oauth/revoke),
  // so stub fetch for the whole block. Default: a successful revoke.
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets all sync settings (including syncUsername) to null', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncToken: 'tok', lastSyncedAt: 12345 })
    await db.settings.put({ key: 'syncUsername', value: 'octocat' })
    await disconnectSync()
    const keys = ['syncProvider', 'syncTokenExpiry', 'syncFileId', 'lastSyncedAt', 'syncUsername']
    for (const key of keys) {
      const row = await db.settings.get(key)
      expect(row?.value).toBeNull()
    }
    // the token lives in the encrypted store now and is wiped on disconnect (issue #126)
    expect(await getSyncToken()).toBeNull()
  })

  it('deletes the device gist file, then revokes the GitHub grant through the worker (in that order)', async () => {
    await seedSyncSettings({ syncProvider: 'github', syncToken: 'gh-token', syncFileId: 'gist-del' })
    github.deleteDeviceFile.mockResolvedValueOnce(undefined)
    await disconnectSync()
    expect(github.deleteDeviceFile).toHaveBeenCalledWith('gh-token', 'gist-del', 'testdevice')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/oauth/revoke')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ provider: 'github', token: 'gh-token' })
    // gist cleanup must run BEFORE the revoke — revoking kills the token, so a
    // revoke-first ordering would 401 the cleanup PATCH and orphan the file.
    expect(github.deleteDeviceFile.mock.invocationCallOrder[0])
      .toBeLessThan(fetchMock.mock.invocationCallOrder[0])
    expect((await db.settings.get('syncProvider'))?.value).toBeNull()
  })

  it('revokes the Google token through the worker (no gist cleanup for non-GitHub)', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncToken: 'goog-token', syncFileId: null })
    await disconnectSync()
    expect(github.deleteDeviceFile).not.toHaveBeenCalled()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/oauth/revoke')
    expect(JSON.parse(opts.body)).toEqual({ provider: 'google', token: 'goog-token' })
  })

  it('does not call the worker revoke for OneDrive (no client-side revoke exists)', async () => {
    await seedSyncSettings({ syncProvider: 'onedrive', syncToken: 'od-token', syncFileId: null })
    await disconnectSync()
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await db.settings.get('syncProvider'))?.value).toBeNull()
  })

  it('still clears settings and wipes the token even if the worker revoke fails', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncToken: 'goog-token', syncFileId: null })
    fetchMock.mockRejectedValueOnce(new Error('network'))
    await disconnectSync()
    expect((await db.settings.get('syncProvider'))?.value).toBeNull()
    expect(await getSyncToken()).toBeNull()
  })

  it('still clears settings even if deleteDeviceFile throws', async () => {
    await seedSyncSettings({ syncProvider: 'github', syncToken: 'gh-token', syncFileId: 'gist-id' })
    github.deleteDeviceFile.mockRejectedValueOnce(new Error('network'))
    await disconnectSync()
    const row = await db.settings.get('syncProvider')
    expect(row?.value).toBeNull()
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
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await expect(runSync()).resolves.not.toThrow()
  })

  it('does not throw when syncTokenExpiry is null (GitHub tokens never expire)', async () => {
    await seedSyncSettings({ syncTokenExpiry: null })
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await expect(runSync()).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// runSync — GitHub provider
// ---------------------------------------------------------------------------

describe('runSync — GitHub provider', () => {
  it('calls fetchAllDeviceData with the stored token and fileId', async () => {
    await seedSyncSettings({ syncFileId: 'existing-gist' })
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.fetchAllDeviceData).toHaveBeenCalledWith('test-token', 'existing-gist')
  })

  it('calls pushDeviceData when a fileId is already stored', async () => {
    await seedSyncSettings({ syncFileId: 'existing-gist' })
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.pushDeviceData).toHaveBeenCalledWith('test-token', 'existing-gist', 'testdevice', expect.any(Object))
  })

  it('does not call findExistingPunchInGist when syncFileId is already stored', async () => {
    await seedSyncSettings({ syncFileId: 'existing-gist' })
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.findExistingPunchInGist).not.toHaveBeenCalled()
  })

  it('searches for an existing gist on first sync (no syncFileId)', async () => {
    await seedSyncSettings({ syncFileId: null })
    github.findExistingPunchInGist.mockResolvedValueOnce('found-gist-id')
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(github.findExistingPunchInGist).toHaveBeenCalledWith('test-token')
    expect(github.fetchAllDeviceData).toHaveBeenCalledWith('test-token', 'found-gist-id')
    expect(github.pushDeviceData).toHaveBeenCalledWith('test-token', 'found-gist-id', 'testdevice', expect.any(Object))
    const stored = await db.settings.get('syncFileId')
    expect(stored?.value).toBe('found-gist-id')
  })

  it('creates a new gist when no existing one is found', async () => {
    await seedSyncSettings({ syncFileId: null })
    github.findExistingPunchInGist.mockResolvedValueOnce(null)
    github.createGist.mockResolvedValueOnce('brand-new-gist-id')
    await runSync()
    expect(github.createGist).toHaveBeenCalledWith('test-token', 'testdevice', expect.any(Object))
    const stored = await db.settings.get('syncFileId')
    expect(stored?.value).toBe('brand-new-gist-id')
  })

  it('does not call fetchAllDeviceData when no fileId exists and no existing gist is found', async () => {
    await seedSyncSettings({ syncFileId: null })
    github.findExistingPunchInGist.mockResolvedValueOnce(null)
    github.createGist.mockResolvedValueOnce('new-id')
    await runSync()
    expect(github.fetchAllDeviceData).not.toHaveBeenCalled()
  })

  it('merges all snapshots returned by fetchAllDeviceData', async () => {
    await seedSyncSettings({ syncFileId: 'gist-123' })
    const snap1 = {
      version: 1,
      laborTypes: [{ id: 1, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 10, name: 'Project Alpha', laborTypeId: 1, isActive: true }],
      entries: [{
        jobId: 10, laborTypeId: 1,
        punchIn: '2025-01-01T09:00:00.000Z',
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    const snap2 = {
      version: 1,
      laborTypes: [{ id: 2, name: 'Dev', color: '#F59E0B' }],
      jobs: [{ id: 20, name: 'Project Beta', laborTypeId: 2, isActive: true }],
      entries: [{
        jobId: 20, laborTypeId: 2,
        punchIn: '2025-01-02T09:00:00.000Z',
        punchOut: '2025-01-02T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([snap1, snap2])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const jobs = await db.jobs.toArray()
    expect(jobs.map(j => j.name)).toEqual(expect.arrayContaining(['Project Alpha', 'Project Beta']))
    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(2)
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
    expect(github.fetchAllDeviceData).not.toHaveBeenCalled()
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
    expect(github.fetchAllDeviceData).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// runSync — return value and DB side-effects
// ---------------------------------------------------------------------------

describe('runSync — timestamp and lastSyncedAt', () => {
  it('returns a millisecond timestamp', async () => {
    await seedSyncSettings()
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    const before = Date.now()
    const ts = await runSync()
    const after = Date.now()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('persists lastSyncedAt in the DB matching the returned timestamp', async () => {
    await seedSyncSettings()
    github.fetchAllDeviceData.mockResolvedValueOnce([])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const jobs = await db.jobs.toArray()
    expect(jobs.filter(j => j.name === 'Client Project')).toHaveLength(1)
  })

  it('dedups a labor type that differs only in case (#168)', async () => {
    await seedSyncSettings()
    await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'design', color: '#6366F1' }], // lowercase — must match 'Design'
      jobs: [],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.laborTypes.toArray()).toHaveLength(1)
  })

  it('dedups a job that differs only in case (#168)', async () => {
    await seedSyncSettings()
    await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })

    const remoteSnapshot = {
      version: 1,
      laborTypes: [],
      jobs: [{ id: 200, name: 'CLIENT PROJECT', laborTypeId: null, isActive: true }], // upper — must match
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.jobs.toArray()).toHaveLength(1)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
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
        jobId: 9999,
        laborTypeId: null,
        punchIn: '2025-01-01T09:00:00.000Z',
        punchOut: '2025-01-01T10:00:00.000Z',
        notes: null,
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(0)
  })

  it('returns 0 and does nothing when remote snapshot has no version', async () => {
    await seedSyncSettings()
    github.fetchAllDeviceData.mockResolvedValueOnce([{ jobs: [], entries: [], laborTypes: [] }])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: stable uuid identity (issue #123)
// ---------------------------------------------------------------------------

describe('runSync — merge by stable uuid identity', () => {
  it('does not re-add an entry whose uuid already exists locally even if its fields changed', async () => {
    // Reproduces the "edits duplicate across devices" half: under the old
    // value-tuple dedup, an edited copy (different punchIn/punchOut) of the
    // same entry would be imported as a second row. With uuid identity it is
    // recognised as the same record and not duplicated.
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })
    const localId = await db.entries.add({
      jobId, laborTypeId: ltId,
      punchIn: new Date('2025-01-01T09:00:00.000Z'),
      punchOut: new Date('2025-01-01T10:00:00.000Z'),
      notes: null,
    })
    const [lt, job, entry] = await Promise.all([
      db.laborTypes.get(ltId), db.jobs.get(jobId), db.entries.get(localId),
    ])

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        uuid: entry.uuid, jobId: 200, laborTypeId: 100,
        punchIn: '2025-01-01T11:30:00.000Z', // edited start
        punchOut: '2025-01-01T12:15:00.000Z', // edited end
        notes: 'edited elsewhere',
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1) // matched by uuid → no duplicate
  })

  it('matches a labor type by uuid even when its name differs (rename no longer splits)', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const { uuid } = await db.laborTypes.get(ltId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid, name: 'Visual Design', color: '#6366F1' }], // renamed remotely
      jobs: [],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const lts = await db.laborTypes.toArray()
    expect(lts).toHaveLength(1) // matched by uuid, not added as a second "Visual Design"
  })

  it('still imports a genuinely new uuid-bearing entry from a remote device', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 1, uuid: 'lt-uuid-1', name: 'Dev', color: '#F59E0B' }],
      jobs: [{ id: 2, uuid: 'job-uuid-1', name: 'Remote Job', laborTypeId: 1, isActive: true }],
      entries: [{
        uuid: 'entry-uuid-1', jobId: 2, laborTypeId: 1,
        punchIn: '2025-02-01T09:00:00.000Z', punchOut: '2025-02-01T10:00:00.000Z', notes: null,
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].uuid).toBe('entry-uuid-1') // remote uuid preserved
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: delete tombstones (issue #118)
// ---------------------------------------------------------------------------

describe('runSync — merge with delete tombstones', () => {
  async function seedOneEntry(updatedAt) {
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })
    const extra = updatedAt != null ? { updatedAt } : {}
    const id = await db.entries.add({
      jobId, laborTypeId: ltId,
      punchIn: new Date('2025-01-01T09:00:00.000Z'),
      punchOut: new Date('2025-01-01T10:00:00.000Z'),
      notes: null, ...extra,
    })
    const [lt, job, entry] = await Promise.all([
      db.laborTypes.get(ltId), db.jobs.get(jobId), db.entries.get(id),
    ])
    return { id, lt, job, entry }
  }

  it('does not resurrect an entry that was deleted locally (peer snapshot still has it)', async () => {
    await seedSyncSettings()
    const { id, lt, job, entry } = await seedOneEntry()
    await deleteEntry(id) // local delete → tombstone

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{ uuid: entry.uuid, jobId: 200, laborTypeId: 100, punchIn: '2025-01-01T09:00:00.000Z', punchOut: '2025-01-01T10:00:00.000Z', notes: null }],
      deletions: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.entries.toArray()).toHaveLength(0) // tombstone suppresses the re-import
  })

  it('applies a remote tombstone, deleting the matching local entry and keeping the tombstone', async () => {
    await seedSyncSettings()
    const { entry } = await seedOneEntry(1000)

    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [], entries: [],
      deletions: [{ uuid: entry.uuid, deletedAt: 2000 }], // deleted after the entry's updatedAt
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.entries.toArray()).toHaveLength(0)
    expect(await db.deletions.get(entry.uuid)).toBeTruthy() // persisted so it keeps propagating
  })

  it('keeps a local entry edited after the remote tombstone (a newer edit undeletes)', async () => {
    await seedSyncSettings()
    const { entry } = await seedOneEntry(5000)

    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [], entries: [],
      deletions: [{ uuid: entry.uuid, deletedAt: 3000 }], // deleted BEFORE the local edit
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.entries.toArray()).toHaveLength(1) // newer local edit wins
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: edit last-write-wins (issue #119)
// ---------------------------------------------------------------------------

describe('runSync — merge entry edits (last-write-wins)', () => {
  async function seedEntry(updatedAt, notes = 'old') {
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client Project', isActive: true, laborRates: {} })
    const id = await db.entries.add({
      jobId, laborTypeId: ltId,
      punchIn: new Date('2025-01-01T09:00:00.000Z'),
      punchOut: new Date('2025-01-01T10:00:00.000Z'),
      notes, updatedAt,
    })
    const [lt, job, entry] = await Promise.all([
      db.laborTypes.get(ltId), db.jobs.get(jobId), db.entries.get(id),
    ])
    return { id, lt, job, entry }
  }

  it('applies a remote edit in place when its updatedAt is newer (edit propagates, no duplicate)', async () => {
    await seedSyncSettings()
    const { lt, job, entry } = await seedEntry(1000)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        uuid: entry.uuid, jobId: 200, laborTypeId: 100,
        punchIn: '2025-01-01T09:30:00.000Z', // edited
        punchOut: '2025-01-01T11:00:00.000Z', // edited
        notes: 'edited', updatedAt: 5000,
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1) // updated in place, not duplicated
    expect(entries[0].notes).toBe('edited')
    expect(new Date(entries[0].punchIn).toISOString()).toBe('2025-01-01T09:30:00.000Z')
    expect(entries[0].updatedAt).toBe(5000)
  })

  it('ignores a remote edit that is older than the local copy', async () => {
    await seedSyncSettings()
    const { lt, job, entry } = await seedEntry(5000, 'local-newer')

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client Project', laborTypeId: 100, isActive: true }],
      entries: [{
        uuid: entry.uuid, jobId: 200, laborTypeId: 100,
        punchIn: '2025-01-01T08:00:00.000Z', punchOut: '2025-01-01T09:00:00.000Z',
        notes: 'stale', updatedAt: 1000,
      }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].notes).toBe('local-newer') // local kept
  })
})

// ---------------------------------------------------------------------------
// runSync — merge: job / labor-type field propagation (issue #120)
// ---------------------------------------------------------------------------

describe('runSync — merge job / labor-type fields (last-write-wins)', () => {
  it('propagates a job rename, archive, and laborRates when the remote is newer', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Old Name', isActive: true, laborRates: {}, updatedAt: 1000 })
    const [lt, job] = await Promise.all([db.laborTypes.get(ltId), db.jobs.get(jobId)])

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1', isArchived: false }],
      jobs: [{
        id: 200, uuid: job.uuid, name: 'New Name', laborTypeId: 100,
        isActive: false, laborRates: { 100: 75 }, updatedAt: 5000, // keyed by REMOTE lt id
      }],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const jobs = await db.jobs.toArray()
    expect(jobs).toHaveLength(1) // updated in place, not split into two
    expect(jobs[0].name).toBe('New Name')
    expect(jobs[0].isActive).toBe(false) // archive propagated
    expect(jobs[0].laborRates[ltId]).toBe(75) // rate remapped to the LOCAL labor type id
  })

  it('propagates labor-type archive state via LWW', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false, updatedAt: 1000 })
    const lt = await db.laborTypes.get(ltId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1', isArchived: true, updatedAt: 5000 }],
      jobs: [], entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const lts = await db.laborTypes.toArray()
    expect(lts).toHaveLength(1)
    expect(lts[0].isArchived).toBe(true)
  })

  it('copies laborRates (remapped) when first importing a job from a remote device', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 5, uuid: 'lt-uuid-x', name: 'Dev', color: '#F59E0B', isArchived: false }],
      jobs: [{ id: 9, uuid: 'job-uuid-x', name: 'Imported', laborTypeId: 5, isActive: true, laborRates: { 5: 50 }, updatedAt: 1000 }],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [importedJob] = await db.jobs.toArray()
    const [importedLt] = await db.laborTypes.toArray()
    expect(importedJob.laborRates[importedLt.id]).toBe(50) // not lost, keyed by local lt id
  })
})

// ---------------------------------------------------------------------------
// runSync — token expiry handling (issue #121)
// ---------------------------------------------------------------------------

describe('runSync — token expiry handling', () => {
  it('throws TOKEN_EXPIRED when the token is within the safety margin of expiry', async () => {
    await seedSyncSettings({ syncTokenExpiry: Date.now() + 10_000 }) // inside the 30s margin
    await expect(runSync()).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('surfaces a mid-sync provider 401 as TOKEN_EXPIRED and does not update lastSyncedAt', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncFileId: null })
    google.pullFromDrive.mockResolvedValueOnce(null)
    google.pushToDrive.mockRejectedValueOnce(new Error('TOKEN_EXPIRED')) // token expired mid-sync
    await expect(runSync()).rejects.toThrow('TOKEN_EXPIRED')
    const stored = await db.settings.get('lastSyncedAt')
    expect(stored?.value ?? null).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// runSync — failure isolation + retry safety (issue #122)
// ---------------------------------------------------------------------------

describe('runSync — failure isolation and retry safety', () => {
  it('tags a download (pull) failure and leaves lastSyncedAt unchanged', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncFileId: null })
    google.pullFromDrive.mockRejectedValueOnce(new Error('Drive 500'))
    await expect(runSync()).rejects.toThrow(/Sync download failed/)
    expect(google.pushToDrive).not.toHaveBeenCalled() // never reached push
    expect((await db.settings.get('lastSyncedAt'))?.value ?? null).toBeNull()
  })

  it('tags an upload (push) failure and leaves lastSyncedAt unchanged', async () => {
    await seedSyncSettings({ syncProvider: 'google', syncFileId: null })
    google.pullFromDrive.mockResolvedValueOnce(null)
    google.pushToDrive.mockRejectedValueOnce(new Error('Drive 500'))
    await expect(runSync()).rejects.toThrow(/Sync upload failed/)
    expect((await db.settings.get('lastSyncedAt'))?.value ?? null).toBeNull()
  })

  it('is idempotent: merging the same uuid-bearing remote snapshot twice adds it once', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 1, uuid: 'lt-x', name: 'Dev', color: '#F59E0B' }],
      jobs: [{ id: 2, uuid: 'job-x', name: 'Remote Job', laborTypeId: 1, isActive: true }],
      entries: [{ uuid: 'entry-x', jobId: 2, laborTypeId: 1, punchIn: '2025-02-01T09:00:00.000Z', punchOut: '2025-02-01T10:00:00.000Z', notes: null }],
    }
    github.fetchAllDeviceData.mockResolvedValue([remoteSnapshot]) // returned on every pull
    github.pushDeviceData.mockResolvedValue(undefined)
    await runSync()
    await runSync() // simulates a retry after a transient failure
    expect(await db.entries.toArray()).toHaveLength(1)
    expect(await db.jobs.toArray()).toHaveLength(1)
    expect(await db.laborTypes.toArray()).toHaveLength(1)
  })
})
