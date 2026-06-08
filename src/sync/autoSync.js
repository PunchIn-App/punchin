import { db } from '../db'
import { runSync } from './syncManager'

// Opt-in background auto-sync engine.
//
// A client-only PWA can't be pushed to, so "auto" means syncing on the events we
// CAN observe while the app is open: app open, window focus / tab becoming
// visible, a periodic tick, and shortly after a local data change. All four
// funnel through one throttled, single-flight path (`trigger`).
//
// Loop-safety has two layers: runSync's merge is idempotent (records match by
// stable uuid and last-write-wins only writes a *strictly newer* record, so
// re-merging an unchanged snapshot writes nothing), AND the data-change hooks
// below no-op while a sync is in flight — so a sync's own merge writes can never
// re-trigger a sync.
//
// Error policy: background syncs must not splash errors the user didn't provoke.
// Only the actionable TOKEN_EXPIRED is surfaced (→ the existing "Reconnect"
// nudge); transient/network failures are swallowed and retried on the next tick.
// (The manual "Sync Now" button keeps its own full-error reporting.)
export const PERIODIC_MS = 4 * 60_000 // background tick cadence while open
const MIN_INTERVAL_MS = 20_000        // floor between auto-syncs (a forced open bypasses it)
const CHANGE_DEBOUNCE_MS = 4_000      // let a burst of edits settle before syncing

let enabled = false
let running = false
let lastRun = 0
let timer = null // a pending trailing-edge sync

export function setAutoSyncEnabled(value) {
  enabled = value
  if (!enabled) { clearTimeout(timer); timer = null }
}

async function doSync(reason) {
  if (!enabled || running) return
  running = true
  try {
    await runSync()
    await db.settings.put({ key: 'syncError', value: null })
  } catch (err) {
    if (err?.message === 'TOKEN_EXPIRED') {
      enabled = false // stop auto-syncing until the user reconnects
      await db.settings.put({ key: 'syncError', value: 'TOKEN_EXPIRED' })
    } else {
      console.warn(`[autoSync:${reason}] transient error (will retry):`, err?.message)
    }
  } finally {
    running = false
    lastRun = Date.now()
  }
}

function schedule(delay, reason) {
  clearTimeout(timer)
  timer = setTimeout(() => { timer = null; trigger(reason) }, delay)
}

// Throttled, single-flight, trailing-edge. `force` (app open) bypasses the floor;
// a too-soon non-forced call reschedules for the floor boundary rather than
// dropping (so "sync shortly after a change" actually holds).
export function trigger(reason, { force = false } = {}) {
  if (!enabled || running) return
  const since = Date.now() - lastRun
  if (!force && since < MIN_INTERVAL_MS) { schedule(MIN_INTERVAL_MS - since, reason); return }
  doSync(reason)
}

// Debounced change trigger: settle the edit burst, but never sooner than the
// throttle floor.
function onDataChange() {
  if (!enabled || running) return
  const since = Date.now() - lastRun
  schedule(Math.max(CHANGE_DEBOUNCE_MS, MIN_INTERVAL_MS - since), 'change')
}

// Subscribe table-mutation hooks ONCE, at module load (not per React effect — so
// they never stack across remounts). They compose with db.js's identity-stamping
// hooks on the same tables and no-op unless auto-sync is enabled and idle.
for (const name of ['entries', 'jobs', 'laborTypes', 'deletions']) {
  const table = db[name]
  if (!table?.hook) continue // defensive: a mocked db (some unit tests) has no tables/hooks
  table.hook('creating', onDataChange)
  table.hook('updating', onDataChange)
  table.hook('deleting', onDataChange)
}

// Test-only: reset module state between cases.
export function _resetAutoSyncForTest() {
  enabled = false
  running = false
  lastRun = 0
  clearTimeout(timer)
  timer = null
}
