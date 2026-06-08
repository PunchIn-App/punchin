import Dexie from 'dexie'

// Stable cross-device record id. Prefers the native UUID generator; falls back
// to a manual v4 UUID (crypto.getRandomValues is available in every supported
// browser and in the test environment) so record creation never throws.
export function genUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * @typedef {'auto'|'dark'|'light'} Theme
 *
 * @typedef {{ key: string, value: boolean|string }} Setting
 *
 * `uuid` is a stable, cross-device identifier stamped on creation (see the
 * Dexie `creating` hook below). Unlike the auto-increment `id` (local-only), it
 * survives sync/transfer and lets cloud merge identify the *same* record across
 * devices. `updatedAt` (ms epoch) is bumped on every write and is the basis for
 * last-write-wins conflict resolution.
 *
 * @typedef {{
 *   id?: number,
 *   uuid?: string,
 *   name: string,
 *   color: string,
 *   glyph?: string,
 *   isArchived: boolean,
 *   updatedAt?: number,
 * }} LaborType
 *
 * @typedef {{
 *   id?: number,
 *   uuid?: string,
 *   name: string,
 *   laborTypeId: number,
 *   isActive: boolean,
 *   laborRates?: Record<number, number>,
 *   color?: string,
 *   updatedAt?: number,
 * }} Job
 *
 * @typedef {{
 *   id?: number,
 *   uuid?: string,
 *   jobId: number,
 *   laborTypeId: number,
 *   punchIn: Date,
 *   punchOut: Date|null,
 *   notes?: string,
 *   updatedAt?: number,
 * }} Entry
 */

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

// v3 — add a stable cross-device `uuid` (indexed, non-unique: uniqueness is
// guaranteed by genUuid(), and a plain index avoids any unique-constraint risk
// during the backfill). The upgrade backfills `uuid` + `updatedAt` on every
// existing record so older installs become merge-identifiable without data loss.
db.version(3)
  .stores({
    laborTypes:  '++id, name, uuid',
    jobs:        '++id, name, laborTypeId, isActive, uuid',
    entries:     '++id, jobId, laborTypeId, punchIn, punchOut, uuid',
  })
  .upgrade(async (tx) => {
    const stamp = Date.now()
    for (const table of ['laborTypes', 'jobs', 'entries']) {
      await tx.table(table).toCollection().modify((r) => {
        if (r.uuid == null) r.uuid = genUuid()
        if (r.updatedAt == null) r.updatedAt = stamp
      })
    }
  })

// v4 — `deletions` tombstone table. Entries are hard-deleted from `entries`
// (so every view/analytics/export query is unaffected), but the deleted
// record's `uuid` is recorded here with a `deletedAt` timestamp. Cloud merge
// reads these so a delete on one device propagates to the others instead of the
// entry resurrecting from a peer's snapshot.
db.version(4).stores({
  deletions: 'uuid, deletedAt',
})

// v5 — `secrets` table for at-rest-encrypted sync credentials (issue #126).
// Holds a non-extractable AES-GCM CryptoKey and the encrypted sync token, so the
// OAuth token is never stored in plaintext IndexedDB. All access goes through
// src/sync/tokenStore.js (set/get/clearSyncToken), which also lazily migrates a
// pre-existing plaintext `settings.syncToken` into this encrypted store.
db.version(5).stores({
  secrets: 'name',
})

// Stamp identity metadata on every write, centrally — so the ~10 create/update
// call sites across the app don't each have to remember to. `creating` only
// fills in missing values, so a record merged from another device keeps its
// remote `uuid`/`updatedAt`. `updating` bumps `updatedAt` unless the caller set
// it explicitly (e.g. a future last-write-wins merge applying a remote value).
for (const table of [db.laborTypes, db.jobs, db.entries]) {
  table.hook('creating', (_primKey, obj) => {
    if (obj.uuid == null) obj.uuid = genUuid()
    if (obj.updatedAt == null) obj.updatedAt = Date.now()
  })
  table.hook('updating', (mods) => {
    if (Object.prototype.hasOwnProperty.call(mods, 'updatedAt')) return undefined
    return { updatedAt: Date.now() }
  })
}

// Delete a time entry and record a tombstone (keyed by its stable uuid) so the
// deletion propagates through cloud sync instead of the entry reappearing from
// another device's snapshot. Atomic: the entry and its tombstone are written in
// one transaction.
export async function deleteEntry(id) {
  return db.transaction('rw', [db.entries, db.deletions], async () => {
    const entry = await db.entries.get(id)
    if (!entry) return
    if (entry.uuid) {
      await db.deletions.put({ uuid: entry.uuid, deletedAt: Date.now() })
    }
    await db.entries.delete(id)
  })
}

// Punch in a new timer. Single source of truth for the punch-in flow, shared by
// StartTimerModal and the Timer rail's quick-punch so the "stop the running
// timer(s) first unless concurrent timers are allowed" rule can never diverge.
// Atomic: any punch-outs + the new entry are written in one transaction.
export async function startTimer({ jobId, laborTypeId, notes = null, allowConcurrentTimers = false }) {
  return db.transaction('rw', db.entries, async () => {
    if (!allowConcurrentTimers) {
      const now = new Date()
      const running = await db.entries.filter(e => !e.punchOut).toArray()
      for (const e of running) {
        await db.entries.update(e.id, { punchOut: now })
      }
    }
    await db.entries.add({
      jobId:       Number(jobId),
      laborTypeId: Number(laborTypeId),
      punchIn:     new Date(),
      punchOut:    null,
      notes:       notes || null,
    })
  })
}

// Default the week start to the device locale's first day of week: Sunday-start
// locales (e.g. en-US) → false, Monday-start locales (e.g. en-GB) → true. Falls
// back to false (Sunday) where the locale's week info isn't available.
function localeWeekStartsMonday() {
  try {
    const loc = new Intl.Locale((typeof navigator !== 'undefined' && navigator.language) || 'en-US')
    const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo
    return info?.firstDay === 1
  } catch {
    return false
  }
}

// Single source of truth for default settings (issues #131/#134). Seeded on a
// fresh install (populate) and restored by factoryReset, and merged under the
// live rows by useSettings so every consumer reads a complete, typed object.
// The sync keys are seeded as null on fresh install too, so a fresh install
// matches a factory reset (no undefined-vs-null branching in consumers).
export const DEFAULT_SETTINGS = {
  allowConcurrentTimers: false,
  weekStartsMonday: localeWeekStartsMonday(),
  theme: 'auto',
  accentColor: '#2D5BF5',
  hapticFeedback: true,
  // Time display & billing (issue #208). decimalHours shows durations as decimal
  // hours ("1.50 h") instead of "1h 30m" in timesheets. roundingMinutes rounds
  // each billable entry in the user's favour (start down, end up) for timesheets
  // and invoices: 0 = off, 15 = nearest quarter hour, 30 = nearest half hour.
  decimalHours: false,
  roundingMinutes: 0,
  // Time display + invoice formatting. timeFormat drives clock-time rendering
  // (in-app default is 12h); defaultCurrency is an ISO 4217 code formatted via
  // Intl.NumberFormat in invoices/CSV.
  timeFormat: 'auto',      // 'auto' (match device) | '12h' | '24h'
  defaultCurrency: 'USD',  // ISO 4217
  // Billing profile — the invoice "Billed from" identity. Flat keys (the
  // useSettings merge is shallow, so a nested object wouldn't auto-default new
  // sub-fields for existing installs). All optional; the invoice band hides
  // blank lines. Invoice numbering is display-only (set/bump the counter here).
  billingName: '',
  billingBusiness: '',
  billingEmail: '',
  billingPhone: '',
  billingAddress: '',
  billingPaymentTerms: '',
  billingNotes: '',
  billingLogo: '',         // optional business logo (downscaled PNG data URL) for the invoice band
  numberInvoices: false,
  invoicePrefix: '',
  nextInvoiceNumber: 1,
  // Reminder notifications (issue #54) — all off by default; the master toggle
  // requests notification permission when first enabled.
  remindersEnabled: false,
  remindLongRunning: true,
  remindLongRunningMinutes: 60,
  remindIdle: false,
  remindIdleTime: '09:00',
  remindIdleDays: [0, 1, 2, 3, 4, 5, 6],
  remindStillRunning: false,
  remindStillRunningTime: '17:00',
  remindStillRunningDays: [0, 1, 2, 3, 4, 5, 6],
  remindTimesheetDaily: false,
  remindTimesheetDailyTime: '17:00',
  remindTimesheetDailyDays: [0, 1, 2, 3, 4, 5, 6],
  remindTimesheetWeekly: false,
  remindTimesheetWeeklyDay: 5,
  remindTimesheetWeeklyTime: '16:00',
  // Sync (issue #131) — seeded as null on fresh install too. The token itself
  // is stored encrypted in the `secrets` table (issue #126); the `syncToken`
  // settings key is a legacy/null placeholder kept for back-compat.
  syncProvider: null,
  syncToken: null,
  syncTokenExpiry: null,
  syncFileId: null,
  lastSyncedAt: null,
  syncError: null,
  syncUsername: null,
  autoSync: true, // background auto-sync: opt-in but ON by default once connected (per-device)
}

/** DEFAULT_SETTINGS as Dexie KV rows for bulkPut (populate + factoryReset). */
export const defaultSettingsRows = () =>
  Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))

// Settings that are device-local or account-bound — they must NOT travel in a
// backup, transfer link, or cloud snapshot (a new device sets up its own sync,
// and the token lives encrypted in `secrets`, never here). Everything else is a
// portable user *preference* (theme, accent, billing profile, currency, time
// format, reminders, …) that should follow your data so a fresh install / the
// installed PWA isn't stranded at defaults when the browser's data can't carry.
export const NON_PORTABLE_SETTING_KEYS = [
  'syncProvider', 'syncToken', 'syncTokenExpiry', 'syncFileId',
  'lastSyncedAt', 'syncError', 'syncUsername', 'autoSync',
]

/** The portable preferences as a plain { key: value } object. */
export async function getPortableSettings() {
  const rows = await db.settings.toArray()
  const out = {}
  for (const { key, value } of rows) {
    if (!NON_PORTABLE_SETTING_KEYS.includes(key)) out[key] = value
  }
  return out
}

/** Apply a portable-settings object onto the local settings table, defensively
 *  dropping any sync/account keys so an import can never plant another device's
 *  credentials. No-op for a missing/empty object. */
export async function applyPortableSettings(settingsObj) {
  if (!settingsObj || typeof settingsObj !== 'object') return
  const rows = Object.entries(settingsObj)
    .filter(([k]) => !NON_PORTABLE_SETTING_KEYS.includes(k))
    .map(([key, value]) => ({ key, value }))
  if (rows.length) await db.settings.bulkPut(rows)
}

// Seed default settings on first run — no jobs or labor types pre-loaded
db.on('populate', async () => {
  await db.settings.bulkPut(defaultSettingsRows())
})

export default db
