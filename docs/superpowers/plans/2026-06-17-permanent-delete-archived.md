# Permanent Delete of Archived Jobs & Labor Types (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users permanently delete archived jobs and labor types; affected past entries are kept as frozen "unlinked" plaintext (name + color, + glyph for labor types) rather than "—", and deletions propagate via sync without resurrecting.

**Architecture:** A delete (1) freezes the deleted record's display identity onto every referencing entry (new optional `entry.frozenRefs` field → entries stay self-describing and survive sync without their parent), (2) writes a uuid-keyed tombstone to the existing `deletions` table (today entry-only), and (3) hard-deletes the record — all atomically (the `deleteEntry` pattern). Deleting a labor type is **blocked** while a live (non-archived) job references it. `mergeSnapshot` carries `frozenRefs`, keeps frozen entries even when their job can't be remapped, and suppresses re-adding tombstoned jobs/labor types. Rendering surfaces fall back to the frozen snapshot via a shared resolver util.

**Tech Stack:** React 19 + Vite + Dexie (IndexedDB) + Vitest. DB/sync tests run through `fake-indexeddb`; component tests use Testing Library (see `App.test.jsx`). No Dexie version bump — `frozenRefs` is optional + unindexed, and `deletions` already exists.

**Spec:** `docs/superpowers/specs/2026-06-17-appearance-sync-and-permanent-delete-design.md` (Part 2, §4). **Branch:** `feat/permanent-delete-archived` (already created off the merged `main`).

**Run tests via the npm script** (the repo's Vitest config is `config/vite.config.js`; a bare `npx vitest` errors with "beforeEach is not defined"): `npm run test:run -- <file> -t "<name>"`. A stale `.claude/worktrees/` copy can inflate totals — judge by failures.

---

## File Structure

- **Create:** `src/utils/entryRefs.js` (frozen-ref resolver) + `src/utils/entryRefs.test.js`; `src/views/JobsView.test.jsx` (delete-flow component test).
- **Modify:** `src/db.js` (typedef + `deleteJob`/`deleteLaborType`/`jobsUsingLaborType`); `src/sync/syncManager.js` (frozenRefs propagation, frozen-entry survival, job/labor tombstone suppression) + `src/sync/syncManager.test.js`; `src/db.test.js` (delete helpers); `src/views/JobsView.jsx` (delete UI); `src/views/TimesheetsView.jsx`, `src/components/TimerCard.jsx`, `src/views/TimerView.jsx`, `src/components/InvoiceModal.jsx`, `src/views/AnalyticsView.jsx`, `src/components/EditEntryModal.jsx` (frozen fallback); release docs.
- **Unchanged but reused:** `src/components/LaborGlyph.jsx` (`LaborTag`/`LaborGlyphChip` already render from any `{name,color,glyph}` — pass the frozen object), `src/components/ConfirmModal.jsx`.

`frozenRefs` shape (used throughout):
```js
entry.frozenRefs = {
  job?:       { name: string, color: string | null },
  laborType?: { name: string, color: string, glyph: string | null },
}
```

---

## Task 1: Data layer — `frozenRefs` typedef + delete helpers (`db.js`)

**Files:**
- Modify: `src/db.js` (Entry typedef ~line 49-58; add helpers after `deleteEntry`, ~line 142)
- Test: `src/db.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/db.test.js` (match the file's existing import/setup style — it already imports `db` and clears tables in `beforeEach`; add `deleteJob, deleteLaborType, jobsUsingLaborType` to the import from `./db`):

```js
describe('deleteJob', () => {
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
  it('blocks deletion while a live job references it', async () => {
    const ltId = await db.laborTypes.add({ name: 'Dev', color: '#111', isArchived: true })
    await db.jobs.add({ name: 'LiveUser', isActive: true, laborRates: { [ltId]: 90 } })

    await expect(deleteLaborType(ltId)).rejects.toThrow('LABOR_TYPE_IN_USE')
    expect(await db.laborTypes.get(ltId)).toBeTruthy() // not deleted
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
    expect(e.frozenRefs.job).toEqual({ name: 'Gone', color: '#abc' }) // preserved
    expect(e.frozenRefs.laborType.name).toBe('Dev')                    // added
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/db.test.js -t "deleteJob"` and `-t "deleteLaborType"` and `-t "jobsUsingLaborType"`
Expected: FAIL — `deleteJob`/`deleteLaborType`/`jobsUsingLaborType` are not exported.

- [ ] **Step 3: Add the `frozenRefs` typedef field**

In `src/db.js`, in the Entry `@typedef` (the block ending `}} Entry`), add `frozenRefs` after `notes`:
```js
 *   notes?: string,
 *   frozenRefs?: { job?: { name: string, color: string|null }, laborType?: { name: string, color: string, glyph: string|null } },
 *   updatedAt?: number,
```

- [ ] **Step 4: Add the three helpers**

In `src/db.js`, immediately after the `deleteEntry` function (ends ~line 141), insert:

```js
// Jobs that reference a labor type — by their default `laborTypeId` or by a
// per-type rate keyed under it (laborRates keys are strings, so `in` matches).
// `liveOnly` restricts to non-archived jobs — used to BLOCK deleting a labor
// type a live job still bills against.
export async function jobsUsingLaborType(laborTypeId, { liveOnly = false } = {}) {
  const jobs = await db.jobs.toArray()
  return jobs.filter(j =>
    (!liveOnly || j.isActive !== false) &&
    (j.laborTypeId === laborTypeId || (j.laborRates && laborTypeId in j.laborRates)))
}

// Permanently delete a job: freeze its display identity onto every referencing
// entry (so those entries stay self-describing once the job is gone), record a
// tombstone (so the deletion propagates via sync instead of the job resurrecting
// from a peer), and hard-delete the job — all in one transaction. The frozen
// colour resolves the job's own colour or, when unset, its labor type's, mirroring
// how the job renders today.
export async function deleteJob(id) {
  return db.transaction('rw', [db.jobs, db.laborTypes, db.entries, db.deletions], async () => {
    const job = await db.jobs.get(id)
    if (!job) return
    const ltColor = job.laborTypeId ? (await db.laborTypes.get(job.laborTypeId))?.color ?? null : null
    const frozen = { name: job.name, color: job.color || ltColor || null }
    const refEntries = await db.entries.where('jobId').equals(id).toArray()
    for (const e of refEntries) {
      await db.entries.update(e.id, { frozenRefs: { ...(e.frozenRefs ?? {}), job: frozen } })
    }
    if (job.uuid) await db.deletions.put({ uuid: job.uuid, deletedAt: Date.now() })
    await db.jobs.delete(id)
  })
}

// Permanently delete a labor type. Throws 'LABOR_TYPE_IN_USE' if any live
// (non-archived) job still references it — the unbypassable form of the block
// rule (callers should pre-check with jobsUsingLaborType(id, { liveOnly: true })
// to surface the offending jobs). Otherwise freezes name+colour+glyph onto
// referencing entries, tombstones, and hard-deletes — atomically.
export async function deleteLaborType(id) {
  return db.transaction('rw', [db.laborTypes, db.jobs, db.entries, db.deletions], async () => {
    const lt = await db.laborTypes.get(id)
    if (!lt) return
    const blocked = (await db.jobs.toArray()).some(j =>
      j.isActive !== false && (j.laborTypeId === id || (j.laborRates && id in j.laborRates)))
    if (blocked) throw new Error('LABOR_TYPE_IN_USE')
    const frozen = { name: lt.name, color: lt.color, glyph: lt.glyph ?? null }
    const refEntries = await db.entries.where('laborTypeId').equals(id).toArray()
    for (const e of refEntries) {
      await db.entries.update(e.id, { frozenRefs: { ...(e.frozenRefs ?? {}), laborType: frozen } })
    }
    if (lt.uuid) await db.deletions.put({ uuid: lt.uuid, deletedAt: Date.now() })
    await db.laborTypes.delete(id)
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- src/db.test.js`
Expected: PASS (existing + the new deleteJob/deleteLaborType/jobsUsingLaborType tests).

- [ ] **Step 6: Commit**

```bash
git add src/db.js src/db.test.js
git commit -m "feat(db): deleteJob/deleteLaborType helpers with frozen entry refs + tombstones

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Frozen-ref resolver util (`src/utils/entryRefs.js`)

**Files:**
- Create: `src/utils/entryRefs.js`, `src/utils/entryRefs.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/entryRefs.test.js`:
```js
import { entryJob, entryLabor } from './entryRefs'

describe('entryJob', () => {
  it('returns the live job when present (not frozen)', () => {
    const job = { id: 1, name: 'Live', color: '#fff' }
    expect(entryJob({ jobId: 1 }, job)).toEqual({ job, frozen: false })
  })
  it('falls back to frozenRefs.job when the live job is gone', () => {
    const entry = { jobId: 1, frozenRefs: { job: { name: 'Gone', color: '#abc' } } }
    expect(entryJob(entry, undefined)).toEqual({ job: { name: 'Gone', color: '#abc' }, frozen: true })
  })
  it('returns null job when neither live nor frozen', () => {
    expect(entryJob({ jobId: 1 }, undefined)).toEqual({ job: null, frozen: false })
  })
})

describe('entryLabor', () => {
  it('returns the live labor type when present', () => {
    const lt = { id: 2, name: 'Dev', color: '#111', glyph: 'code' }
    expect(entryLabor({ laborTypeId: 2 }, lt)).toEqual({ laborType: lt, frozen: false })
  })
  it('falls back to frozenRefs.laborType when gone', () => {
    const entry = { laborTypeId: 2, frozenRefs: { laborType: { name: 'Dev', color: '#111', glyph: 'code' } } }
    expect(entryLabor(entry, null)).toEqual({ laborType: { name: 'Dev', color: '#111', glyph: 'code' }, frozen: true })
  })
  it('returns null laborType when neither', () => {
    expect(entryLabor({ laborTypeId: 2 }, undefined)).toEqual({ laborType: null, frozen: false })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/utils/entryRefs.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the util**

Create `src/utils/entryRefs.js`:
```js
// Resolve an entry's job / labor-type for display, falling back to the frozen
// snapshot captured at delete time (entry.frozenRefs) when the live record is
// gone. `frozen` is true when the fallback was used, so callers can render the
// reference as inert "unlinked" plaintext instead of a live, interactive record.

export function entryJob(entry, liveJob) {
  if (liveJob) return { job: liveJob, frozen: false }
  const f = entry?.frozenRefs?.job
  return f ? { job: f, frozen: true } : { job: null, frozen: false }
}

export function entryLabor(entry, liveLabor) {
  if (liveLabor) return { laborType: liveLabor, frozen: false }
  const f = entry?.frozenRefs?.laborType
  return f ? { laborType: f, frozen: true } : { laborType: null, frozen: false }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/utils/entryRefs.test.js`
Expected: PASS (6).

- [ ] **Step 5: Commit**

```bash
git add src/utils/entryRefs.js src/utils/entryRefs.test.js
git commit -m "feat(utils): entryRefs resolver — live record or frozen fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Sync merge — carry `frozenRefs` + frozen-entry survival

**Files:**
- Modify: `src/sync/syncManager.js` (entry loop, current lines 182-197)
- Test: `src/sync/syncManager.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/sync/syncManager.test.js` (a new `describe` block):
```js
describe('runSync — frozen entry references', () => {
  it('carries frozenRefs through the merge for a uuid-matched entry', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Design', color: '#6366F1', isArchived: false })
    const jobId = await db.jobs.add({ name: 'Client', isActive: true, laborRates: {} })
    const [lt, job] = await Promise.all([db.laborTypes.get(ltId), db.jobs.get(jobId)])
    const localId = await db.entries.add({ jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: new Date('2025-01-01T10:00:00Z'), updatedAt: 1000 })
    const entry = await db.entries.get(localId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#6366F1' }],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client', laborTypeId: 100, isActive: true }],
      entries: [{ uuid: entry.uuid, jobId: 200, laborTypeId: 100, punchIn: '2025-01-01T09:00:00.000Z', punchOut: '2025-01-01T10:00:00.000Z', notes: null, frozenRefs: { laborType: { name: 'Old Design', color: '#abc', glyph: 'palette' } }, updatedAt: 5000 }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [out] = await db.entries.toArray()
    expect(out.frozenRefs.laborType.name).toBe('Old Design')
  })

  it('imports an entry whose job is gone but carries a frozen job ref (jobId nulled)', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [], // no job to map to
      entries: [{ uuid: 'frozen-e1', jobId: 777, laborTypeId: null, punchIn: '2025-02-01T09:00:00.000Z', punchOut: '2025-02-01T10:00:00.000Z', notes: null, frozenRefs: { job: { name: 'Deleted Job', color: '#f00' } } }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].jobId).toBeNull()
    expect(entries[0].frozenRefs.job.name).toBe('Deleted Job')
  })

  it('still skips an entry whose job is unmapped AND has no frozen ref (transient)', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [],
      entries: [{ uuid: 'orphan-e1', jobId: 888, laborTypeId: null, punchIn: '2025-02-01T09:00:00.000Z', punchOut: '2025-02-01T10:00:00.000Z', notes: null }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(await db.entries.toArray()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:run -- src/sync/syncManager.test.js -t "frozen entry references"`
Expected: FAIL — the frozen-job entry is skipped (`if (!newJobId) continue`) and `frozenRefs` is dropped (not in the `fields` allow-list).

- [ ] **Step 3: Update the entry loop**

In `src/sync/syncManager.js`, in the `for (const entry of remote.entries ?? [])` loop:

Replace line 185:
```js
      if (!newJobId) continue
```
with:
```js
      // Keep an entry whose job can't be remapped only when it carries a frozen
      // job snapshot (the job was permanently deleted) — those entries are
      // self-describing. A plain unmapped entry (job not yet synced) is still skipped.
      if (!newJobId && !entry.frozenRefs?.job) continue
```

Replace the `fields` object (lines 191-197):
```js
      const fields = {
        jobId: newJobId,
        laborTypeId: newLtId,
        punchIn: new Date(entry.punchIn),
        punchOut: entry.punchOut ? new Date(entry.punchOut) : null,
        notes: entry.notes ?? null,
      }
```
with:
```js
      const fields = {
        jobId: newJobId ?? null,
        laborTypeId: newLtId,
        punchIn: new Date(entry.punchIn),
        punchOut: entry.punchOut ? new Date(entry.punchOut) : null,
        notes: entry.notes ?? null,
        frozenRefs: entry.frozenRefs ?? null,
      }
```

- [ ] **Step 4: Run the new tests + full file**

Run: `npm run test:run -- src/sync/syncManager.test.js -t "frozen entry references"` → PASS (3).
Run: `npm run test:run -- src/sync/syncManager.test.js` → all green (the value-match dedup path is unaffected: frozen entries carry uuids and match by uuid).

- [ ] **Step 5: Commit**

```bash
git add src/sync/syncManager.js src/sync/syncManager.test.js
git commit -m "fix(sync): carry frozenRefs and keep frozen entries through merge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Sync merge — job/labor-type tombstone suppression

**Files:**
- Modify: `src/sync/syncManager.js` (move the tomb-map build up; suppress tombstoned jobs/labor types)
- Test: `src/sync/syncManager.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/sync/syncManager.test.js`:
```js
describe('runSync — job/labor-type tombstones', () => {
  it('does not resurrect a locally-deleted job from a peer snapshot', async () => {
    await seedSyncSettings()
    const jobId = await db.jobs.add({ name: 'Gone', isActive: false, laborRates: {}, updatedAt: 1000 })
    const job = await db.jobs.get(jobId)
    await db.deletions.put({ uuid: job.uuid, deletedAt: 2000 }) // local delete tombstone
    await db.jobs.delete(jobId)

    const remoteSnapshot = {
      version: 1, laborTypes: [],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Gone', laborTypeId: null, isActive: false, updatedAt: 1000 }],
      entries: [], deletions: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.jobs.toArray()).toHaveLength(0) // tombstone suppresses the re-add
  })

  it('applies a remote job tombstone, deleting the matching local job', async () => {
    await seedSyncSettings()
    const jobId = await db.jobs.add({ name: 'DeleteMe', isActive: false, laborRates: {}, updatedAt: 1000 })
    const job = await db.jobs.get(jobId)

    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [], entries: [],
      deletions: [{ uuid: job.uuid, deletedAt: 2000 }],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.jobs.toArray()).toHaveLength(0)
    expect(await db.deletions.get(job.uuid)).toBeTruthy()
  })

  it('does not resurrect a locally-deleted labor type from a peer snapshot', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Gone', color: '#111', isArchived: true, updatedAt: 1000 })
    const lt = await db.laborTypes.get(ltId)
    await db.deletions.put({ uuid: lt.uuid, deletedAt: 2000 })
    await db.laborTypes.delete(ltId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Gone', color: '#111', isArchived: true, updatedAt: 1000 }],
      jobs: [], entries: [], deletions: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    expect(await db.laborTypes.toArray()).toHaveLength(0)
  })

  it('keeps a labor type edited after the tombstone (newer edit undeletes)', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({ name: 'Kept', color: '#111', isArchived: false, updatedAt: 5000 })
    const lt = await db.laborTypes.get(ltId)
    const remoteSnapshot = {
      version: 1, laborTypes: [], jobs: [], entries: [],
      deletions: [{ uuid: lt.uuid, deletedAt: 3000 }], // older than the local edit
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()
    expect(await db.laborTypes.toArray()).toHaveLength(1) // newer edit wins
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:run -- src/sync/syncManager.test.js -t "job/labor-type tombstones"`
Expected: FAIL — jobs/labor types are re-added (no tombstone suppression in their loops) and remote tombstones don't delete local jobs/labor types.

- [ ] **Step 3: Move the tomb-map build above the labor loop and apply it**

In `src/sync/syncManager.js`, **cut** the tomb-map construction block (current lines 155-168 — the comment + `const tomb = new Map()` through the `for (const d of remote.deletions ?? [])` loop) and **paste it immediately after** the identity comment block (after line 92, before `const ltMap = {}`). Then, right after that pasted block, add local-record tombstone application + a reusable predicate:

```js
    // A remote record is suppressed (not re-added) when a tombstone covers its
    // uuid and no strictly-newer edit exists — the same delete-wins-by-timestamp
    // rule used for entries. Applied to jobs and labor types (issue: permanent delete).
    const tombstoned = (rec) => {
      const at = rec.uuid ? tomb.get(rec.uuid) : undefined
      return at != null && at >= (rec.updatedAt ?? 0)
    }
    // Delete local jobs / labor types covered by a (local or remote) tombstone.
    for (const lt of await db.laborTypes.toArray()) {
      if (tombstoned(lt)) await db.laborTypes.delete(lt.id)
    }
    for (const j of await db.jobs.toArray()) {
      if (tombstoned(j)) await db.jobs.delete(j.id)
    }
```

(The original entry-tombstone application at lines 170-179 stays where it is and keeps using `tomb`.)

- [ ] **Step 4: Suppress tombstoned remote records in the labor + job loops**

In the labor-type loop, add a skip as the first statement inside `for (const lt of remote.laborTypes ?? [])`:
```js
      if (tombstoned(lt)) continue
```
In the job loop, add as the first statement inside `for (const job of remote.jobs ?? [])`:
```js
      if (tombstoned(job)) continue
```

- [ ] **Step 5: Run the new tests + full file**

Run: `npm run test:run -- src/sync/syncManager.test.js -t "job/labor-type tombstones"` → PASS (4).
Run: `npm run test:run -- src/sync/syncManager.test.js` → all green (entry tombstone tests still pass; the tomb map moved up but its construction is unchanged, and the entry pass still runs after the loops).

- [ ] **Step 6: Commit**

```bash
git add src/sync/syncManager.js src/sync/syncManager.test.js
git commit -m "fix(sync): suppress resurrecting tombstoned jobs and labor types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: JobsView — permanent-delete UI

**Files:**
- Modify: `src/views/JobsView.jsx`
- Test: `src/views/JobsView.test.jsx` (new — model on `src/App.test.jsx` for Testing Library + fake-indexeddb setup)

- [ ] **Step 1: Write the failing component test**

Create `src/views/JobsView.test.jsx`. (Read `src/App.test.jsx` first to mirror the exact render/fake-indexeddb/`useLiveQuery` flushing conventions — including any `act`/`findBy` patterns and how it waits for `useLiveQuery` to resolve.) The test must:
```js
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '../db'
import JobsView from './JobsView'

beforeEach(async () => {
  await db.jobs.clear(); await db.laborTypes.clear(); await db.entries.clear(); await db.deletions.clear()
})

it('permanently deletes an archived job from the archived folder (with confirm)', async () => {
  const jobId = await db.jobs.add({ name: 'ArchivedJob', isActive: false, laborRates: {} })
  await db.entries.add({ jobId, laborTypeId: null, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: new Date('2025-01-01T10:00:00Z') })

  render(<JobsView />)
  // expand the archived folder
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  // open delete confirm
  fireEvent.click(await screen.findByLabelText('Delete ArchivedJob permanently'))
  // confirm
  fireEvent.click(await screen.findByRole('button', { name: /delete/i }))

  await waitFor(async () => expect(await db.jobs.get(jobId)).toBeUndefined())
  const [e] = await db.entries.toArray()
  expect(e.frozenRefs.job.name).toBe('ArchivedJob') // entry frozen, not deleted
})

it('blocks deleting a labor type that a live job uses', async () => {
  const ltId = await db.laborTypes.add({ name: 'Dev', color: '#111', isArchived: true })
  await db.jobs.add({ name: 'LiveJob', isActive: true, laborRates: { [ltId]: 90 } })

  render(<JobsView />)
  fireEvent.click(await screen.findByRole('button', { name: /labor types/i })) // switch tab
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  fireEvent.click(await screen.findByLabelText('Delete Dev permanently'))

  // a block message names the offending job; no destructive confirm available
  expect(await screen.findByText(/LiveJob/)).toBeInTheDocument()
  expect(await db.laborTypes.get(ltId)).toBeTruthy() // still there
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/views/JobsView.test.jsx`
Expected: FAIL — no delete button / handlers exist.

- [ ] **Step 3: Imports, state, and handlers**

In `src/views/JobsView.jsx`:
- Add `Trash2` to the `lucide-react` import (line 2).
- Add: `import ConfirmModal from '../components/ConfirmModal'` and extend the db import: `import { db, deleteJob, deleteLaborType, jobsUsingLaborType } from '../db'`.
- In the `JobsView` component, add state after line 243:
```js
  const [confirmJob, setConfirmJob] = useState(null)        // job pending delete-confirm
  const [confirmLT, setConfirmLT] = useState(null)          // labor type pending delete-confirm
  const [blockedLT, setBlockedLT] = useState(null)          // { lt, jobs } when delete is blocked
```
- Add handlers after `toggleArchive` (after line 257):
```js
  const askDeleteLaborType = async (lt) => {
    const live = await jobsUsingLaborType(lt.id, { liveOnly: true })
    if (live.length) setBlockedLT({ lt, jobs: live })
    else setConfirmLT(lt)
  }
```

- [ ] **Step 4: Add the delete buttons to the archived rows**

In the archived-JOBS row action group (currently lines 405-411 — the `<div className="flex items-center gap-1 flex-shrink-0">` with only the Restore button), add a delete button after the Restore button:
```jsx
                            <button onClick={() => setConfirmJob(job)}
                              aria-label={`Delete ${job.name} permanently`}
                              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
```

In the archived-LABOR-TYPES row action group (currently lines 513-519), add after the Restore button:
```jsx
                          <button onClick={() => askDeleteLaborType(lt)}
                            aria-label={`Delete ${lt.name} permanently`}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
```

- [ ] **Step 5: Render the confirm/block modals**

Just before the final closing of the component's returned JSX (after the two tab blocks, before the outermost closing `</div>`s — place it as a sibling of the tab content), add:
```jsx
        {confirmJob && (
          <ConfirmModal
            title={`Permanently delete "${confirmJob.name}"?`}
            message="The job is removed for good. Its time entries are kept but shown as unlinked (the job's name and colour are frozen onto them). This can't be undone."
            confirmLabel="Delete permanently"
            onConfirm={async () => { await deleteJob(confirmJob.id); setConfirmJob(null) }}
            onCancel={() => setConfirmJob(null)}
          />
        )}
        {confirmLT && (
          <ConfirmModal
            title={`Permanently delete "${confirmLT.name}"?`}
            message="The labor type is removed for good. Its time entries are kept but shown as unlinked (its name, colour, and glyph are frozen onto them). This can't be undone."
            confirmLabel="Delete permanently"
            onConfirm={async () => { await deleteLaborType(confirmLT.id); setConfirmLT(null) }}
            onCancel={() => setConfirmLT(null)}
          />
        )}
        {blockedLT && (
          <ConfirmModal
            title={`Can't delete "${blockedLT.lt.name}" yet`}
            message={`It's still used by an active job: ${blockedLT.jobs.map(j => j.name).join(', ')}. Archive or relink those jobs first, then delete it.`}
            confirmLabel="OK"
            onConfirm={() => setBlockedLT(null)}
            onCancel={() => setBlockedLT(null)}
          />
        )}
```

- [ ] **Step 6: Run the test + verify**

Run: `npm run test:run -- src/views/JobsView.test.jsx` → PASS (2). If the Testing Library flushing of `useLiveQuery` is flaky, mirror `App.test.jsx`'s `await screen.findBy…`/`waitFor` usage exactly. Then `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add src/views/JobsView.jsx src/views/JobsView.test.jsx
git commit -m "feat(jobs): permanent-delete buttons for archived jobs & labor types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Frozen-ref rendering — TimesheetsView, TimerCard, TimerView

**Files:**
- Modify: `src/views/TimesheetsView.jsx`, `src/components/TimerCard.jsx`, `src/views/TimerView.jsx`
- Test: add a focused case to `src/views/TimesheetsView` coverage if a test file exists; otherwise add an assertion via an existing test file or rely on the util tests + a CSV unit check (see Step 3).

The pattern everywhere: import `{ entryJob, entryLabor }` from `../utils/entryRefs` (path adjusted per file), replace a raw `getJob(entry.jobId)` / `getLT(entry.laborTypeId)` with the resolver, render `job?.name || '—'` (now the frozen name when frozen), pass the resolved `laborType` to `LaborTag`/`LaborGlyphChip` (they already render any `{name,color,glyph}`), and when `frozen` is true render the name as inert text with a muted class (e.g. append `italic text-appTextMuted` and drop any click affordance).

- [ ] **Step 1: TimesheetsView — daily + weekly + CSV + print**

In `src/views/TimesheetsView.jsx`, add the import, then at each site:
- DailySheet row (lines ~113-129): `const { job, frozen: jobFrozen } = entryJob(entry, getJob(entry.jobId)); const { laborType: lt } = entryLabor(entry, getLT(entry.laborTypeId))`. Use `jobColor = job?.color || getLT(job?.laborTypeId)?.color || 'var(--accent)'` (frozen job already has `.color`). Render `{job?.name || '—'}` with `className` gaining `italic` when `jobFrozen`. Pass `lt` to `<LaborTag laborType={lt} />` (renders frozen labor too).
- WeeklySheet per-job breakdown (lines ~272-274) and day-entries expanded (lines ~335-342): same resolver substitution.
- CSV export (lines ~452-472): `const { job } = entryJob(e, jobs?.find(j => j.id === e.jobId)); const { laborType: lt } = entryLabor(e, laborTypes?.find(l => l.id === e.laborTypeId))` so frozen names export.
- Print export (lines ~503-517): same resolver substitution so `job?.name` / `laborBadgeHTML(lt)` get frozen data.

- [ ] **Step 2: TimerCard + TimerView**

`src/components/TimerCard.jsx`: the component receives `job`/`laborType` as props (lines 13/47/62/70). Add an `entry`-aware fallback at the call sites in `TimerView.jsx` instead: in `TimerView.jsx` (lines ~186-187) pass `job={entryJob(entry, getJob(entry.jobId)).job}` and `laborType={entryLabor(entry, getLT(entry.laborTypeId)).laborType}`. (TimerCard's existing `job?.name || 'Unknown Job'` and `laborType?.color || DEFAULT` then render the frozen values; `LaborTag` handles the frozen labor object.) For the last-session card (lines ~194-196) apply the same resolver. Quick-punch `recentJobs` (lines ~78-83) intentionally skips entries whose live job is gone — leave as-is (you can't punch into a deleted job).

- [ ] **Step 3: Test (CSV frozen export)**

If `TimesheetsView` has an associated test file, add a case there; otherwise add it to the closest existing view test. The high-value assertion: a frozen entry exports its frozen job/labor name. If no view test infrastructure exists for this, add a small unit test that constructs the CSV row builder over an entry with `frozenRefs` (extract the row-building into a tiny pure helper if needed to make it testable) — but do NOT over-refactor; if the CSV builder isn't easily isolatable, rely on the `entryRefs` util tests (Task 2) + the JobsView/db tests and note this in the commit. Run `npm run build` and `npm run test:run -- src/views/entryRefs.test.js src/utils/entryRefs.test.js` to confirm nothing regressed.

- [ ] **Step 4: Commit**

```bash
git add src/views/TimesheetsView.jsx src/components/TimerCard.jsx src/views/TimerView.jsx
git commit -m "feat(views): frozen-ref fallback in timesheets + timer rendering

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Frozen-ref rendering — InvoiceModal, AnalyticsView, EditEntryModal

**Files:**
- Modify: `src/components/InvoiceModal.jsx`, `src/views/AnalyticsView.jsx`, `src/components/EditEntryModal.jsx`

- [ ] **Step 1: InvoiceModal — line items keep frozen names; totals already correct**

In `src/components/InvoiceModal.jsx` line-items builder (lines ~147-152): `const { job: eJob } = entryJob(entry, jobMap.get(entry.jobId)); const { laborType: lt } = entryLabor(entry, laborTypes?.find(l => l.id === entry.laborTypeId))`. Rate stays `eJob?.laborRates?.[entry.laborTypeId] ?? null` (frozen jobs have no rate → "—", which is correct). CSV (lines ~168-176) and print (line ~204) then emit frozen names. Hours/totals are unchanged (billing already counts every entry).

- [ ] **Step 2: AnalyticsView — include frozen contributions in breakdowns**

In `src/views/AnalyticsView.jsx`:
- Earnings loop (lines ~56-62): a frozen-job entry has no rate (job gone) → it simply won't add earnings; no change needed beyond ensuring `jobMap.get(e.jobId)` undefined is tolerated (it already is via `?.`).
- jobData bar chart (lines ~82-87): after building `jobData` from live `jobs`, append frozen-job contributions so deleted jobs still show their hours. Add, after the live `jobData` map:
```js
  const liveJobIds = new Set(jobs.map(j => j.id))
  const frozenJobAgg = new Map() // name -> { hours, color }
  for (const e of entries) {
    if (liveJobIds.has(e.jobId) || !e.frozenRefs?.job) continue
    const f = e.frozenRefs.job
    const cur = frozenJobAgg.get(f.name) ?? { name: f.name, hours: 0, color: f.color || 'rgb(var(--accent-rgb))' }
    cur.hours += getEntryDuration(e) / 3600000
    frozenJobAgg.set(f.name, cur)
  }
  const jobDataAll = [...jobData, ...[...frozenJobAgg.values()].map(d => ({ ...d, hours: parseFloat(d.hours.toFixed(2)) }))].filter(d => d.hours > 0)
```
and render from `jobDataAll` instead of `jobData`. Apply the analogous aggregation for the labor-type donut (lines ~90-95) keyed on `e.frozenRefs?.laborType` (carry `glyph`).

- [ ] **Step 3: EditEntryModal — show the deleted reference, allow re-link**

In `src/components/EditEntryModal.jsx` (options at lines ~162-174): when `entry.frozenRefs?.job` exists and the entry's `jobId` isn't in the live `jobs` list, prepend a disabled synthetic option so the user sees what it was:
```js
  const jobOptions = [
    ...((entry?.frozenRefs?.job && !(jobs ?? []).some(j => j.id === entry.jobId))
      ? [{ value: String(entry.jobId), label: `${entry.frozenRefs.job.name} (deleted)`, color: entry.frozenRefs.job.color, disabled: true }]
      : []),
    ...(jobs ?? []).map(j => ({ value: String(j.id), label: j.name, sublabel: j.clientName || undefined, color: j.color || laborColorOf(j.laborTypeId) })),
  ]
```
Apply the same shape for `laborOptions` using `entry.frozenRefs?.laborType` (carry `glyph`). (Confirm the dropdown component honors a per-option `disabled` flag; if it doesn't, render the synthetic option without `disabled` but keep the "(deleted)" label so re-selection is still possible.) The user can pick a live job/labor type to re-link; leaving it unchanged keeps the frozen ref.

- [ ] **Step 4: Verify**

Run: `npm run build` and `npm run test:run` (full). Confirm no new failures beyond the known deviceId jsdom flakes. (These three files are render/compute changes; their correctness rides on the `entryRefs` util tests + the db/sync tests; manual app verification of a deleted-job invoice/analytics view is worthwhile post-merge.)

- [ ] **Step 5: Commit**

```bash
git add src/components/InvoiceModal.jsx src/views/AnalyticsView.jsx src/components/EditEntryModal.jsx
git commit -m "feat(views): frozen-ref fallback in invoice, analytics, edit-entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Docs, version bump (MINOR → 0.32.0), and full verification

**Files:**
- Modify: `package.json`, `CLAUDE.md`, `README.md`, `docs/CHANGELOG.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/TEST-COVERAGE.md`

This is a **new feature → MINOR**: `0.31.3` → `0.32.0` (per `docs/RELEASING.md` — read it first). On a MINOR, `SECURITY.md` supported-versions must be updated.

- [ ] **Step 1: Version bump** — `package.json` `0.31.3`→`0.32.0`; `CLAUDE.md` `**Version:**` + any prose version; `README.md` version badge.

- [ ] **Step 2: CHANGELOG** — read the top entry for format, then add (matching style):
```markdown
## [0.32.0] — <today>

### Added
- **Permanently delete archived jobs and labor types.** Archived items now have a delete action (alongside Restore) that removes them for good. Past time entries are kept and shown as "unlinked" — the deleted job/labor type's name, colour, and glyph are frozen onto them — so timesheets, invoices, and totals stay intact. Deleting a labor type that an active job still uses is blocked until those jobs are archived or relinked. Deletions sync across devices (they won't reappear from another device).
```

- [ ] **Step 3: CLAUDE.md docs** — update the **Collections** table: `entries` gains `frozenRefs` (frozen display snapshot of a deleted job/labor type); `deletions` note now covers jobs and labor types (not entries only). Update the **Soft-Delete / Archive Pattern** section, which currently says "records are never hard-deleted" and "no Delete button in the UI" — describe the new permanent-delete + frozen-refs behavior.

- [ ] **Step 4: ARCHITECTURE + TEST-COVERAGE** — add `src/utils/entryRefs.js` to the `docs/ARCHITECTURE.md` file map; add rows to `docs/TEST-COVERAGE.md` for the new test files (`src/utils/entryRefs.test.js`, `src/views/JobsView.test.jsx`).

- [ ] **Step 5: Full verification**
- `npm run build` → exit 0.
- `npm run test:run` → full suite; only the known pre-existing `deviceId.test.js` jsdom flakes may fail (+ stale `.claude/worktrees/` duplicates). Everything in `src/db.test.js`, `src/sync/syncManager.test.js`, `src/utils/entryRefs.test.js`, `src/views/JobsView.test.jsx` must be green. Itemize any other failure with its path.
- `npm run check:docs` → PASS (version bump has matching CHANGELOG + SECURITY; new source/test files registered).

- [ ] **Step 6: Commit**

```bash
git add package.json CLAUDE.md README.md docs/CHANGELOG.md SECURITY.md docs/ARCHITECTURE.md docs/TEST-COVERAGE.md
git commit -m "chore(release): v0.32.0 — permanent delete of archived jobs & labor types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed during authoring)

**Spec coverage (§4):** §4.1 decisions (jobs+labor, frozen plaintext, block-if-live) → Tasks 1, 5. §4.2 data model (`frozenRefs`, reuse `deletions`, no version bump) → Task 1. §4.3 delete behavior (atomic freeze+tombstone+delete; block guard) → Task 1. §4.4 merge (tombstone suppression for jobs/labor; frozen-entry survival; `if (!newJobId)` change) → Tasks 3, 4. §4.5 rendering (plaintext fallback across the 5 surfaces; still counts in totals/exports) → Tasks 2, 6, 7. §4.6 UI (delete beside Restore, ConfirmModal, block message naming jobs) → Task 5. §4.7 tests/docs → every task + Task 8.

**Placeholder scan:** none — every code step has complete code; the two soft spots (CSV-builder testability in Task 6 Step 3; per-option `disabled` support in Task 7 Step 3) are called out with an explicit fallback, not left vague.

**Type/name consistency:** `frozenRefs.{job:{name,color}, laborType:{name,color,glyph}}` is identical in the typedef (Task 1), the merge (Task 3), the util (Task 2), and all render sites (Tasks 6/7). Helpers `deleteJob`/`deleteLaborType`/`jobsUsingLaborType` (Task 1) are imported with those exact names in Task 5. `entryJob`/`entryLabor` (Task 2) are used identically in Tasks 6/7. The `tombstoned(rec)` predicate (Task 4) is defined once and used in three places.

**Ordering:** 1 (db) → 2 (util) → 3,4 (sync) → 5 (UI) → 6,7 (rendering) → 8 (release). Rendering depends on the util (2); UI depends on the db helpers (1); sync changes are independent of UI/rendering. All deps satisfied.
