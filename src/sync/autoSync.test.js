import 'fake-indexeddb/auto'
import { db } from '../db'
import { setAutoSyncEnabled, trigger, _resetAutoSyncForTest } from './autoSync'

// runSync is the unit under orchestration — mock it so we assert WHEN/whether the
// engine calls it, not what a real sync does.
vi.mock('./syncManager', () => ({ runSync: vi.fn() }))
import { runSync } from './syncManager'

beforeEach(async () => {
  vi.clearAllMocks()
  _resetAutoSyncForTest()
  await db.settings.clear()
  await db.entries.clear()
  runSync.mockResolvedValue(Date.now())
})

afterEach(() => {
  setAutoSyncEnabled(false)
  vi.useRealTimers()
})

const errorVal = async () => (await db.settings.get('syncError'))?.value

describe('autoSync engine', () => {
  it('a forced trigger runs runSync and clears syncError', async () => {
    await db.settings.put({ key: 'syncError', value: 'stale' })
    setAutoSyncEnabled(true)
    trigger('open', { force: true })
    await vi.waitFor(() => expect(runSync).toHaveBeenCalledTimes(1))
    await vi.waitFor(async () => expect(await errorVal()).toBeNull())
  })

  it('does nothing while disabled', async () => {
    setAutoSyncEnabled(false)
    trigger('open', { force: true })
    await new Promise((r) => setTimeout(r, 15))
    expect(runSync).not.toHaveBeenCalled()
  })

  it('is single-flight — a second trigger while one is in flight is dropped', async () => {
    let release
    runSync.mockReturnValue(new Promise((r) => { release = r }))
    setAutoSyncEnabled(true)
    trigger('open', { force: true }) // starts the sync (running)
    trigger('open', { force: true }) // ignored — one already running
    expect(runSync).toHaveBeenCalledTimes(1)
    release(Date.now())
  })

  it('surfaces TOKEN_EXPIRED and then stops auto-syncing', async () => {
    runSync.mockRejectedValue(new Error('TOKEN_EXPIRED'))
    setAutoSyncEnabled(true)
    trigger('open', { force: true })
    await vi.waitFor(async () => expect(await errorVal()).toBe('TOKEN_EXPIRED'))
    runSync.mockClear()
    runSync.mockResolvedValue(Date.now())
    trigger('open', { force: true }) // engine disabled itself on expiry
    await new Promise((r) => setTimeout(r, 15))
    expect(runSync).not.toHaveBeenCalled()
  })

  it('swallows a transient error (no error splashed) and stays enabled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await db.settings.put({ key: 'syncError', value: null })
    runSync.mockRejectedValueOnce(new Error('network down'))
    setAutoSyncEnabled(true)
    trigger('open', { force: true })
    await vi.waitFor(() => expect(runSync).toHaveBeenCalledTimes(1))
    expect(await errorVal()).not.toBe('network down') // not surfaced to the UI
    runSync.mockResolvedValueOnce(Date.now())
    trigger('open', { force: true }) // still enabled → runs again
    await vi.waitFor(() => expect(runSync).toHaveBeenCalledTimes(2))
    warn.mockRestore()
  })

  it('throttles a too-soon trigger and reschedules it (trailing-edge, not dropped)', async () => {
    vi.useFakeTimers()
    setAutoSyncEnabled(true)
    trigger('open', { force: true }) // forced: runs now, sets a "recent" lastRun
    await vi.advanceTimersByTimeAsync(5)
    expect(runSync).toHaveBeenCalledTimes(1)
    trigger('periodic') // within the 20s floor → reschedules, doesn't drop
    await vi.advanceTimersByTimeAsync(5)
    expect(runSync).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20_000) // floor elapses → the trailing run fires
    expect(runSync).toHaveBeenCalledTimes(2)
  })

  it('schedules a debounced sync after a local data change', async () => {
    vi.useFakeTimers()
    setAutoSyncEnabled(true)
    db.entries.add({ jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null })
    await vi.advanceTimersByTimeAsync(10) // let the write + creating hook run
    expect(runSync).not.toHaveBeenCalled() // still debouncing
    await vi.advanceTimersByTimeAsync(4_000)
    expect(runSync).toHaveBeenCalledTimes(1)
  })
})
