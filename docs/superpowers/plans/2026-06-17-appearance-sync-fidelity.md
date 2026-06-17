# Cross-Device Appearance Fidelity (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a job's own color, and a labor type's color + glyph, reliably carry across synced devices.

**Architecture:** All three failures live in `mergeSnapshot` (`src/sync/syncManager.js`). Three changes: (1) add `color` to the job merge so it stops being dropped; (2) replace the over-strict last-write-wins gate with a deterministic resolver (LWW by `updatedAt`, ties broken by `uuid`) so two devices always pick the same winner; (3) unify split identities — when records match by name but carry different uuids, converge them onto one canonical uuid so they stop disagreeing forever. Conflict resolution stays record-level LWW (no schema change, no per-field timestamps).

**Tech Stack:** React 19 + Vite + Dexie (IndexedDB) + Vitest. Tests run through `runSync()` against `fake-indexeddb`, mocking the GitHub provider — the established convention in `syncManager.test.js`.

**Spec:** `docs/superpowers/specs/2026-06-17-appearance-sync-and-permanent-delete-design.md` (Part 1, §3).

**Branch:** `feat/appearance-sync-and-permanent-delete` (already created).

---

## File Structure

- **Modify:** `src/sync/syncManager.js`
  - Add two module-private pure helpers (`canonicalUuid`, `remoteIsNewer`) just above `mergeSnapshot` (after `remapLaborRates`, ~line 57).
  - Rewrite the labor-type merge branch (current lines 70–90).
  - Rewrite the job merge branch (current lines 92–118), adding `color` to `jobFields`.
  - Update the identity/LWW code comments (lines 63–67, 76, 107–108).
- **Modify:** `src/sync/syncManager.test.js` — add two `describe` blocks (labor-type convergence; job color + convergence). Existing tests must stay green.
- **Modify (docs / release):** `src/db.js` (typedef comment), `package.json`, `docs/CHANGELOG.md`, `SECURITY.md`, `CLAUDE.md` (version header).

No new files. No Dexie version bump — `color` is unindexed/nullable and `uuid` is already indexed.

---

## Reference — the two helpers (used by Tasks 1 & 2)

These are written in Task 1, Step 3. Reproduced here once so later tasks can reference them:

```js
// Deterministic, symmetric across devices: pick the lexicographically smaller
// uuid as the canonical identity, so two independently-created same-named
// records converge onto ONE uuid instead of name-matching forever with split
// ids. If only one side has a uuid (legacy), that one is canonical.
function canonicalUuid(a, b) {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

// Last-write-wins by updatedAt; ties (equal or both-missing timestamps) are
// broken deterministically by uuid (larger uuid wins) so BOTH devices
// independently pick the same winner and converge, rather than each keeping its
// own copy. `?? 0` means a uuid-less / timestamp-less legacy remote never wins
// over a stamped local record.
function remoteIsNewer(remote, local) {
  const rt = remote.updatedAt ?? 0
  const lt = local.updatedAt ?? 0
  if (rt !== lt) return rt > lt
  return String(remote.uuid) > String(local.uuid)
}
```

---

## Task 1: Deterministic resolver + identity unification for labor types

**Files:**
- Modify: `src/sync/syncManager.js:57` (insert helpers), `src/sync/syncManager.js:70-90` (labor branch)
- Test: `src/sync/syncManager.test.js` (new `describe` block)

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `src/sync/syncManager.test.js` (after the existing `runSync — merge job / labor-type fields` block, before the token-expiry block):

```js
// ---------------------------------------------------------------------------
// runSync — labor-type appearance convergence (deterministic LWW + identity)
// ---------------------------------------------------------------------------

describe('runSync — labor-type appearance convergence', () => {
  it('converges a same-named labor type created independently on each device (color + glyph + uuid)', async () => {
    await seedSyncSettings()
    // Local "Design": its own (hook-stamped) uuid + an OLDER edit.
    const ltId = await db.laborTypes.add({
      name: 'Design', color: '#111111', glyph: 'palette', isArchived: false, updatedAt: 1000,
    })
    const local = await db.laborTypes.get(ltId)

    // Remote "Design": a DIFFERENT uuid (independent create) + a NEWER edit.
    const remoteSnapshot = {
      version: 1,
      laborTypes: [{
        id: 100, uuid: 'remote-uuid-zzz', name: 'Design',
        color: '#22AA44', glyph: 'code', isArchived: false, updatedAt: 5000,
      }],
      jobs: [], entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const lts = await db.laborTypes.toArray()
    expect(lts).toHaveLength(1)                 // name-matched, not split into two
    expect(lts[0].color).toBe('#22AA44')        // newer remote appearance adopted
    expect(lts[0].glyph).toBe('code')
    expect(lts[0].uuid).toBe(['remote-uuid-zzz', local.uuid].sort()[0]) // unified to smaller
  })

  it('breaks an updatedAt tie deterministically (larger uuid wins) so devices converge', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({
      name: 'Design', color: '#111111', glyph: 'palette', isArchived: false, updatedAt: 3000,
    })
    const local = await db.laborTypes.get(ltId)
    const remoteUuid = 'zzzz-larger-than-any-v4-uuid'

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{
        id: 100, uuid: remoteUuid, name: 'Design',
        color: '#22AA44', glyph: 'code', isArchived: false, updatedAt: 3000, // TIE
      }],
      jobs: [], entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [out] = await db.laborTypes.toArray()
    expect(remoteUuid > local.uuid).toBe(true)  // fixture sanity: remote uuid is larger
    expect(out.color).toBe('#22AA44')           // tie → larger uuid wins the fields
    expect(out.glyph).toBe('code')
    expect(out.uuid).toBe([remoteUuid, local.uuid].sort()[0]) // canonical = smaller uuid
  })

  it('adopts a newer remote color + glyph for a uuid-matched labor type', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({
      name: 'Design', color: '#111111', glyph: 'palette', isArchived: false, updatedAt: 1000,
    })
    const lt = await db.laborTypes.get(ltId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, uuid: lt.uuid, name: 'Design', color: '#999999', glyph: 'wrench', isArchived: false, updatedAt: 5000 }],
      jobs: [], entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [out] = await db.laborTypes.toArray()
    expect(out.color).toBe('#999999')
    expect(out.glyph).toBe('wrench')
  })

  it('does not let a uuid-less legacy remote overwrite a local labor type', async () => {
    await seedSyncSettings()
    const ltId = await db.laborTypes.add({
      name: 'Design', color: '#111111', glyph: 'palette', isArchived: false, updatedAt: 1000,
    })
    const local = await db.laborTypes.get(ltId)

    const remoteSnapshot = {
      version: 1,
      laborTypes: [{ id: 100, name: 'Design', color: '#999999', glyph: 'wrench' }], // no uuid, no updatedAt
      jobs: [], entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [out] = await db.laborTypes.toArray()
    expect(out.color).toBe('#111111')  // local kept (remote has no timestamp/uuid to win)
    expect(out.glyph).toBe('palette')
    expect(out.uuid).toBe(local.uuid)  // uuid unchanged
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/sync/syncManager.test.js -t "labor-type appearance convergence"`
Expected: FAIL — the convergence test fails on `uuid` (old code never rewrites the uuid, so the records stay split) and/or the tie test fails on `color` (old strict `>` skips equal timestamps).

- [ ] **Step 3: Add the helpers**

In `src/sync/syncManager.js`, immediately after the `remapLaborRates` function (ends ~line 57) and before `async function mergeSnapshot`, insert the two helpers exactly as written in the **Reference** section above.

- [ ] **Step 4: Rewrite the labor-type merge branch**

Replace the current labor-type loop body (lines 70–90 — the `for (const lt of remote.laborTypes ?? [])` block) with:

```js
    for (const lt of remote.laborTypes ?? []) {
      const match =
        (lt.uuid && existingLts.find(e => e.uuid === lt.uuid)) ||
        existingLts.find(e => e.name.toLowerCase() === lt.name.toLowerCase())
      if (match) {
        ltMap[lt.id] = match.id
        // Converge identity (adopt the canonical uuid so independently-created
        // same-name copies stop splitting) and resolve appearance by LWW. Either
        // may require a write; skip when neither does.
        const canon = canonicalUuid(match.uuid, lt.uuid)
        const takeRemote = remoteIsNewer(lt, match)
        if (takeRemote || canon !== match.uuid) {
          const fields = takeRemote
            ? { name: lt.name, color: lt.color, glyph: lt.glyph ?? null, isArchived: lt.isArchived ?? false }
            : {}
          const updatedAt = takeRemote ? lt.updatedAt : match.updatedAt
          await db.laborTypes.update(match.id, { ...fields, uuid: canon, updatedAt })
          Object.assign(match, fields, { uuid: canon, updatedAt })
        }
      } else {
        const newId = await db.laborTypes.add({
          name: lt.name, color: lt.color, glyph: lt.glyph ?? null, isArchived: lt.isArchived ?? false,
          uuid: lt.uuid, updatedAt: lt.updatedAt,
        })
        ltMap[lt.id] = newId
        existingLts.push({ id: newId, name: lt.name, uuid: lt.uuid, updatedAt: lt.updatedAt })
      }
    }
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run src/sync/syncManager.test.js -t "labor-type appearance convergence"`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full sync test file to confirm no regressions**

Run: `npx vitest run src/sync/syncManager.test.js`
Expected: PASS — all pre-existing tests (dedup, uuid-identity, tombstones, entry/job/labor LWW) still green. (No-uuid/no-timestamp remotes still don't override; uuid-matched newer remotes still adopt.)

- [ ] **Step 7: Commit**

```bash
git add src/sync/syncManager.js src/sync/syncManager.test.js
git commit -m "fix(sync): converge labor-type color/glyph across devices

Deterministic LWW (ties broken by uuid) + canonical-uuid unification so
independently-created same-name labor types stop splitting and their color
and glyph reliably carry between devices.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Job color sync + identity unification for jobs

**Files:**
- Modify: `src/sync/syncManager.js:92-118` (job branch)
- Test: `src/sync/syncManager.test.js` (new `describe` block)

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `src/sync/syncManager.test.js` (after the labor-type convergence block):

```js
// ---------------------------------------------------------------------------
// runSync — job color sync + convergence
// ---------------------------------------------------------------------------

describe('runSync — job color sync', () => {
  it('imports a job’s own color from a remote device (create path)', async () => {
    await seedSyncSettings()
    const remoteSnapshot = {
      version: 1,
      laborTypes: [],
      jobs: [{ id: 9, uuid: 'job-uuid-x', name: 'Imported', laborTypeId: null, isActive: true, color: '#ABCDEF', updatedAt: 1000 }],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [job] = await db.jobs.toArray()
    expect(job.color).toBe('#ABCDEF')
  })

  it('propagates a newer remote job color to a uuid-matched job (LWW)', async () => {
    await seedSyncSettings()
    const jobId = await db.jobs.add({ name: 'Client', isActive: true, laborRates: {}, color: '#111111', updatedAt: 1000 })
    const job = await db.jobs.get(jobId)

    const remoteSnapshot = {
      version: 1, laborTypes: [],
      jobs: [{ id: 200, uuid: job.uuid, name: 'Client', laborTypeId: null, isActive: true, color: '#222222', updatedAt: 5000 }],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const [out] = await db.jobs.toArray()
    expect(out.color).toBe('#222222')
  })

  it('converges a same-named job created independently on each device (color + uuid)', async () => {
    await seedSyncSettings()
    const jobId = await db.jobs.add({ name: 'Client', isActive: true, laborRates: {}, color: '#111111', updatedAt: 1000 })
    const local = await db.jobs.get(jobId)

    const remoteSnapshot = {
      version: 1, laborTypes: [],
      jobs: [{ id: 200, uuid: 'remote-job-zzz', name: 'Client', laborTypeId: null, isActive: true, color: '#222222', updatedAt: 5000 }],
      entries: [],
    }
    github.fetchAllDeviceData.mockResolvedValueOnce([remoteSnapshot])
    github.pushDeviceData.mockResolvedValueOnce(undefined)
    await runSync()

    const jobs = await db.jobs.toArray()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].color).toBe('#222222')
    expect(jobs[0].uuid).toBe(['remote-job-zzz', local.uuid].sort()[0])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/sync/syncManager.test.js -t "job color sync"`
Expected: FAIL — `job.color` is `undefined`/unchanged because `jobFields` omits `color`, and the convergence test fails on `uuid`.

- [ ] **Step 3: Rewrite the job merge branch**

Replace the current job loop body (lines 92–118 — the `const jobMap = {}` declaration through the end of the `for (const job of remote.jobs ?? [])` block) with:

```js
    const jobMap = {}
    const existingJobs = await db.jobs.toArray()
    for (const job of remote.jobs ?? []) {
      const match =
        (job.uuid && existingJobs.find(j => j.uuid === job.uuid)) ||
        existingJobs.find(j => j.name.toLowerCase() === job.name.toLowerCase())
      const jobFields = {
        name: job.name,
        clientName: job.clientName ?? null,
        laborTypeId: job.laborTypeId ? ltMap[job.laborTypeId] : null,
        isActive: job.isActive !== false,
        laborRates: remapLaborRates(job.laborRates, ltMap),
        color: job.color ?? null,
      }
      if (match) {
        jobMap[job.id] = match.id
        const canon = canonicalUuid(match.uuid, job.uuid)
        const takeRemote = remoteIsNewer(job, match)
        if (takeRemote || canon !== match.uuid) {
          const fields = takeRemote ? jobFields : {}
          const updatedAt = takeRemote ? job.updatedAt : match.updatedAt
          await db.jobs.update(match.id, { ...fields, uuid: canon, updatedAt })
          Object.assign(match, fields, { uuid: canon, updatedAt })
        }
      } else {
        const newId = await db.jobs.add({ ...jobFields, uuid: job.uuid, updatedAt: job.updatedAt })
        jobMap[job.id] = newId
        existingJobs.push({ id: newId, name: job.name, uuid: job.uuid, updatedAt: job.updatedAt })
      }
    }
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run src/sync/syncManager.test.js -t "job color sync"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full sync test file to confirm no regressions**

Run: `npx vitest run src/sync/syncManager.test.js`
Expected: PASS — including the existing `propagates a job rename, archive, and laborRates when the remote is newer` test (it now also writes `color: null` harmlessly, and `uuid: canon` equals the unchanged matched uuid).

- [ ] **Step 6: Commit**

```bash
git add src/sync/syncManager.js src/sync/syncManager.test.js
git commit -m "fix(sync): sync a job's own color across devices + converge job identity

Add color to the job merge field set (it was dropped on the receiving device)
and apply the same deterministic LWW + canonical-uuid unification used for
labor types.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Update code comments to match the new semantics

**Files:**
- Modify: `src/sync/syncManager.js` (comments at ~63–67, ~76, ~107–108)
- Modify: `src/db.js` (typedef comment ~25–26)

No test changes — comment-only accuracy fix (CLAUDE.md "a stale convention is worse than no convention").

- [ ] **Step 1: Update the identity comment in mergeSnapshot**

In `src/sync/syncManager.js`, replace the identity-resolution comment block (currently lines ~63–67, beginning "Identity is resolved per-record:") with:

```js
    // Identity is resolved per-record: a record carrying a `uuid` is matched to
    // the local record with the same uuid. Failing that, records match by name
    // (case-insensitive) — and when a name match spans two DIFFERENT uuids
    // (the same labor type/job created independently on each device), the two
    // converge onto a canonical uuid (the lexicographically smaller) so they
    // stop splitting on every sync. Records without a uuid (legacy v1 snapshots)
    // still match by name. Appearance/field conflicts are resolved by
    // last-write-wins (updatedAt; ties broken deterministically by uuid).
```

- [ ] **Step 2: Update the inline LWW comments**

In the labor-type branch, the old comment `// Last-write-wins for mutable fields (issue #120): name, color, archive.` is replaced by the new block written in Task 1 Step 4 — confirm it reads "Converge identity ... and resolve appearance by LWW." In the job branch, ensure the equivalent intent is clear (the Task 2 rewrite already removed the stale `issue #120` line). No further edit needed if Tasks 1–2 were applied verbatim; otherwise align them.

- [ ] **Step 3: Update the db.js typedef comment**

In `src/db.js`, in the typedef comment (~lines 22–26), replace the sentence:

```
 * `updatedAt` (ms epoch) is bumped on every write and is the basis for
 * last-write-wins conflict resolution.
```

with:

```
 * `updatedAt` (ms epoch) is bumped on every write and is the basis for
 * last-write-wins conflict resolution; ties (equal timestamps) are broken
 * deterministically by `uuid` in the sync merge so two devices converge.
```

- [ ] **Step 4: Commit**

```bash
git add src/sync/syncManager.js src/db.js
git commit -m "docs(sync): document deterministic LWW + identity unification in comments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Version bump, changelog, and full verification

**Files:**
- Modify: `package.json`, `docs/CHANGELOG.md`, `SECURITY.md`, `CLAUDE.md`

This is a bug-fix release → **PATCH**: `0.31.2` → `0.31.3` (per `docs/RELEASING.md`). Read `docs/RELEASING.md` before this task to confirm no extra repo-specific steps have changed.

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "0.31.2"` to `"version": "0.31.3"`.

In `CLAUDE.md`, change the header line `**Version:** 0.31.2` to `**Version:** 0.31.3`.

- [ ] **Step 2: Add the CHANGELOG entry**

In `docs/CHANGELOG.md`, add a new section at the top (matching the existing entry format — keep the same heading style/date format used by the most recent entry):

```markdown
## 0.31.3

### Fixed
- **Cross-device sync:** a job's own color, and a labor type's color and glyph, now reliably carry between synced devices. Previously a job's color was dropped on the receiving device, and labor types created independently on two devices (same name, different internal ids) never reconciled their appearance. Conflicts now resolve by last-write-wins with a deterministic tie-break, and same-named records converge onto one identity.
```

- [ ] **Step 3: Update SECURITY.md supported versions**

In `SECURITY.md`, update the **Supported Versions** table: set the `0.31.x` row (or add it) to **Yes** for the latest, per the `docs/RELEASING.md` rule. (If the table already tracks `0.31.x` as supported, no change is needed — confirm and move on.)

- [ ] **Step 4: Run the full build + test suite**

Run: `npm run build`
Expected: build succeeds (exit 0).

Run: `npm run test:run`
Expected: the full suite passes (the known pre-existing ~5 deviceId jsdom flakes and any date-sensitive flakes are unrelated to this change — confirm no NEW failures in `syncManager.test.js`).

Run: `npm run check:docs`
Expected: PASS — the version bump has a matching CHANGELOG section and SECURITY update, and no new source files were added.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/CHANGELOG.md SECURITY.md CLAUDE.md
git commit -m "chore(release): v0.31.3 — cross-device color/glyph sync fidelity

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed during authoring)

**Spec coverage (§3 of the spec):**
- §3.1 job color → Task 2 (added to `jobFields`).
- §3.2 deterministic resolver → Task 1 Step 3 (`remoteIsNewer`), applied in Tasks 1 & 2.
- §3.3 identity unification → Task 1 Step 3 (`canonicalUuid`), applied in Tasks 1 & 2.
- §3.4 glyph default → no change (documented; covered by the no-uuid-legacy test that the stopwatch fallback is render-side).
- §3.5 tests → Tasks 1 & 2 add convergence, tie, regression, and legacy tests.

**Placeholder scan:** none — every code/test step has complete code; run commands and expected output are concrete.

**Type/name consistency:** `canonicalUuid` and `remoteIsNewer` are defined once (Task 1 Step 3) and called identically in both branches; `jobFields` keeps its existing shape plus `color`; helper signatures match call sites.

**Backward-compatibility note:** traced against the existing dedup (no-uuid remote → no override, uuid now unchanged because `canon === match.uuid`), uuid-identity, tombstone, and job/labor LWW tests — all remain green.
