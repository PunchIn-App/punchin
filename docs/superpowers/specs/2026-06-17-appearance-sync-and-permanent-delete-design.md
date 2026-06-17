# Design — Cross-device appearance fidelity & permanent delete

- **Date:** 2026-06-17
- **Status:** Approved (design); pending implementation plan
- **Author:** PunchIn App (via Claude Code)
- **Affected areas:** `src/sync/syncManager.js`, `src/db.js`, `src/views/JobsView.jsx`, entry-rendering views (`TimesheetsView`, `AnalyticsView`, `EditEntryModal`, `InvoiceModal`, `TimerCard`), `src/components/LaborGlyph.jsx`

---

## 1. Problem statement

Two user-reported issues:

1. **Job/labor colors and glyphs don't carry well across devices.** On a second (synced) device, a job's color reverts, a labor type's color comes out wrong, and a labor type's glyph often shows the PunchIn stopwatch instead of the chosen icon.
2. **No way to permanently delete archived jobs (or labor types).** Archiving is soft-only by design; the user wants true deletion of clutter.

This work covers both, as two independently-shippable parts that share the sync subsystem.

---

## 2. Verified diagnosis (Part 1)

An adversarial multi-agent investigation (3 finders + a skeptical synthesizer that re-read every cited line) produced the following **verified** root causes. Two early theories were **refuted**: glyphs are app-bundled SVGs (not emoji — no per-OS drift), and the `LABOR_GLYPHS` id map has been byte-identical across every release (no version-skew fallback between shipped builds).

The three symptoms map to **four** real causes:

| Symptom | Root cause | Evidence |
|---|---|---|
| Job color reverts | Job-merge allow-list omits `color` | `syncManager.js:98–104` — `jobFields = { name, clientName, laborTypeId, isActive, laborRates }`; no `color`. Render falls back `job?.color \|\| laborType?.color` (`TimerCard.jsx:47`, `JobsView.jsx:321`). Color *is* uploaded (`exportSnapshot` ships full rows) — it's dropped on the receiving merge only. |
| Labor color wrong (genuine) + glyph shows stopwatch | (a) Over-strict conflict gate, and (b) split identities that never merge | See 2.1 / 2.2 below. The **glyph** is the proof this is a real labor-type-record failure: jobs carry no glyph, so a wrong glyph cannot be the job bug in disguise. |
| Labor color wrong (partial) | Same as the job-color drop, perceived as "labor color" because the job falls back to its labor type's color | `syncManager.js:98–104` + render fallback. |

### 2.1 Over-strict conflict gate
`syncManager.js:77`:
```js
if (lt.uuid && (lt.updatedAt ?? 0) > (match.updatedAt ?? 0)) { /* write {name,color,glyph,isArchived} */ }
```
Fails to apply the remote's appearance when: timestamps are **equal**; the remote is **older** or has **null/legacy** `updatedAt` (`?? 0` is never `>` a real ms); the record lacks a **uuid** (the leading `lt.uuid &&` short-circuits). It also bundles `name+color+glyph+isArchived` as one unit keyed on a single record-level timestamp, so a peer's newer **non-appearance** edit (rename/archive) overwrites a fresh color/glyph edit with stale values. Per-device wall-clock `Date.now()` (`db.js:120,124`) means clock skew alone can flip the strict `>`.

### 2.2 Split identities never merge
When two devices each create the **same-named** labor type **before** first sync, each gets a distinct random uuid (`db.js:118–121` creating hook). On merge, the uuid match (`syncManager.js:72`) fails, identity falls back to case-insensitive **name** match (`:73`), but the update block (`:77–80`) **never writes `uuid`** — so the two copies keep different uuids forever and re-enter the name-match branch on every sync. Appearance never converges. **Jobs share the same latent shape** (`syncManager.js:95–97`).

### 2.3 Non-bug: glyph default
A labor type whose glyph was never chosen stores `glyph: null` and correctly renders the PunchGlyph stopwatch on **every** device (`LaborGlyph.jsx:37–39`). This is the documented default, not a sync loss; the real fix is making *chosen* glyphs converge. No behavior change here (see 3.4).

### 2.4 Non-bug: theme inking
Light mode darkens the glyph ink 60% toward near-black for WCAG contrast (`index.css` `.light .lg-glyph-ink`); dark mode keeps the full pastel. Two devices on different OS themes render the same stored hex slightly differently. Intentional; out of scope.

---

## 3. Part 1 design — appearance fidelity

### 3.1 Job color (trivial)
Add `color: job.color ?? null` to `jobFields` (`syncManager.js:98–104`). It then rides the existing per-record path (both the add at `:114` and the LWW update at `:110`). No schema change — `color` is unindexed and already nullable. `?? null` matches the local save semantics (`JobsView.jsx:57` `color: color || null`).

### 3.2 Deterministic conflict resolver
Replace the gate with a resolver that is a **pure function of the record pair** (so both devices independently compute the same winner — the property that guarantees convergence):

```
resolveWinner(a, b):                      # a, b are the two records (order-independent)
  if a.updatedAt > b.updatedAt: return a
  if b.updatedAt > a.updatedAt: return b
  # tie (incl. equal/both-null): deterministic, symmetric tiebreaker
  return (a.uuid >= b.uuid) ? a : b
```
- Drop the hard `lt.uuid &&` requirement so name-matched records can resolve appearance.
- Ties now converge to the **same** winner on both devices instead of each keeping its own.
- The winning record's `{ name, color, glyph, isArchived }` (and the job equivalent incl. `color`) are written; `updatedAt` is set to the winner's timestamp so the merge is idempotent (re-running is a no-op).

### 3.3 Identity unification
When a record matches by **name** but the uuids differ (or the remote lacks a uuid):
- `canonicalUuid = min(localUuid, remoteUuid)` (deterministic, symmetric; if the remote lacks a uuid, keep the local uuid as canonical).
- Write onto the **existing local record** (`match.id` preserved): `uuid = canonicalUuid`, fields = `resolveWinner(...)`, `updatedAt = winner.updatedAt`.
- Because every device computes the same `canonicalUuid` and the same winning fields, all copies converge to one identity within a bounded number of sync rounds; the operation is **idempotent** and **order-independent** across the multi-file gist pull. The next sync is a clean uuid match.
- `match.id` is unchanged, so entry/job references (local autoincrement ids remapped via `ltMap`/`jobMap`) are untouched.
- Apply to **both** labor types and jobs.

### 3.4 Glyph default
No change. Documented as the intended "read by shape" default. (A future option — distinguishing "explicitly chose the stopwatch" from "never chose a glyph" — is explicitly out of scope unless requested.)

### 3.5 Tests (Part 1)
New regression tests in `syncManager.test.js` (none today assert `color`):
- Job `color` survives merge on both create and LWW-update paths.
- Same-name / different-uuid labor types converge to one uuid + the winning appearance, symmetrically from either device's perspective.
- Tie / equal-updatedAt resolves to the same winner on both sides.
- Clock-skew case (remote newer edit but smaller `updatedAt`) — document the LWW-by-timestamp semantics it produces.
- Legacy / null-`updatedAt` and uuid-less remote records resolve without dropping appearance.
- Same coverage for the job identity-unification path.

---

## 4. Part 2 design — permanent delete (jobs + labor types)

### 4.1 Decisions (from brainstorming)
- **Scope:** jobs **and** labor types.
- **Affected entries:** kept, shown as frozen **"unlinked" plaintext** (name + color, + glyph for labor types) — not "—".
- **Labor type referenced by a *live* (non-archived) job:** **block** the delete; the user must archive/relink those jobs first.

### 4.2 Data model
- **`entry.frozenRefs`** (new optional, unindexed field on `entries` — no Dexie version bump): populated at delete time, e.g.
  ```js
  entry.frozenRefs = {
    job?:       { name, color },
    laborType?: { name, color, glyph },
  }
  ```
  Only the deleted dimension(s) are frozen; an entry can carry both. This makes each entry **self-describing**, which is what lets it render and **survive sync** without its parent record.
- **Tombstones:** reuse the existing uuid-keyed `deletions` table (currently entry-only) for jobs and labor types. uuids are globally unique (`genUuid`), so no record-type discriminator and **no version bump** are needed.

### 4.3 Delete behavior
New `db.js` helpers mirroring the `deleteEntry` atomic pattern (`db.js:132–141`) — tombstone + delete in one transaction:
- **`deleteJob(id)`:** in one transaction — for each entry referencing the job (`db.entries.where('jobId').equals(id)`), write `frozenRefs.job = { name, color }`; write the job's `uuid` to `deletions`; delete the job.
- **`deleteLaborType(id)`:** first **guard** — if any **active** job (`isActive !== false`) references it via `laborRates` keys or the legacy `laborTypeId`, throw/return a blocked result naming those jobs (the UI surfaces them). Otherwise, in one transaction — freeze `frozenRefs.laborType = { name, color, glyph }` onto referencing entries (and onto archived jobs' rate-row display as needed); tombstone its `uuid`; delete it.

### 4.4 Merge changes (correctness-critical)
In `syncManager.js mergeSnapshot`:
- **Tombstone suppression for jobs and labor types.** Today only entries check tombstones (`:120–155`). Before re-adding a job/labor type (`db.jobs.add` `:114` / `db.laborTypes.add` `:83`), skip if a tombstone covers its uuid and no strictly-newer edit exists (same delete-wins-by-timestamp rule entries use at `:139`/`:154`). Prevents resurrection from a peer snapshot. `exportSnapshot` already ships `deletions`, so propagation works once the readers exist.
- **Import frozen entries even when the job ref can't be remapped.** Today `if (!newJobId) continue` (`syncManager.js:~150`) silently drops any entry whose job isn't in `jobMap` — which would **delete the user's frozen entries** on a device that never had the job. New rule: if the entry carries `frozenRefs.job`, import it with a null job link and render from the frozen data; only skip when there's no frozen data (genuinely transient / not-yet-synced). (Labor-type refs already don't skip — `:149` sets `newLtId = null` — so only the job path needs this change.)

### 4.5 Rendering — frozen plaintext fallback
Where views resolve a job/labor type (`TimesheetsView`, `AnalyticsView`, `EditEntryModal`, `InvoiceModal`, `TimerCard`): when the live lookup misses **and** `frozenRefs` exists, render the frozen name + color (+ glyph for labor types) as **non-interactive plaintext** instead of "—". Frozen entries still count toward totals and still appear in exports/invoices (preserves billing history). Frozen references get a **subtle "unlinked/deleted" visual treatment** (muted, no chip interactivity) so they're distinguishable at a glance from live entries.

### 4.6 UI
Add a **"Delete permanently"** action beside **Restore** in the archived-jobs folder and archived-labor-types folder (`JobsView.jsx`, around the archived maps at `:405–411` / `:514–518`). Route through `ConfirmModal` (project convention #9). The dialog surfaces the count of affected historical entries; for labor types it shows the **block** message naming any live jobs that must be archived/relinked first.

### 4.7 Tests (Part 2)
- `deleteJob` / `deleteLaborType` helpers: tombstone written, record deleted, entries frozen, atomicity; labor-type block when a live job references it.
- Merge: tombstone suppression (no resurrection of a deleted job/labor type from a peer); frozen entry survives merge on a device that never had the parent job; non-frozen unresolvable entry still skipped (transient case preserved).
- Render: frozen entry shows plaintext name/color/glyph and still sums into totals/exports.

---

## 5. Documentation obligations (this repo's CI enforces these)
- **`CLAUDE.md`:** update the Collections table (entries gain `frozenRefs`; `deletions` now covers jobs/labor types) and the **Soft-Delete / Archive Pattern** section (which currently states "no Delete button in the UI" and "records are never hard-deleted").
- **`docs/ARCHITECTURE.md`:** note the new `db.js` delete helpers and any new component, if added.
- **`docs/CHANGELOG.md`:** user-visible entries for both parts (with version bumps — Part 1 = PATCH/bug-fix, Part 2 = MINOR/new feature per `docs/RELEASING.md`).
- **`SECURITY.md`:** supported-versions table on each version bump (RELEASING rule).
- **`docs/TEST-COVERAGE.md`:** rows for any new test files.
- **Screenshots:** regenerate if the archived-folder UI / frozen-entry rendering changes any captured view.

---

## 6. Sequencing & risk
- **Part 1 first.** Lower risk, fixes active pain, and lands the sound merge that Part 2's tombstone/identity logic builds on. Within Part 1: 3.1 (job color) and 3.2 (resolver) are small and safe; 3.3 (identity unification) is the highest-risk piece — it mutates uuids during merge, so it needs the determinism/idempotence/order-independence properties proven by tests.
- **Part 2 second.** Independently shippable, but reuses the merge and the `deletions` table that Part 1 leaves clean.
- **Identity ↔ tombstone interaction:** a job/labor tombstone is keyed by the (now canonical) uuid. A device that has never synced since divergence could still hold the losing uuid; shipping identity unification (Part 1) before deletion (Part 2) minimizes the window. If needed, job/labor tombstone suppression can match by name as a secondary key (mirroring the merge's name-match) — note as an implementation safeguard.

---

## 7. Out of scope (YAGNI)
- Per-field timestamping / CRDT-style merge (record-level LWW with a deterministic tiebreaker is sufficient for the reported problem).
- Changing the "no glyph chosen → brand stopwatch" default.
- Changing theme-dependent glyph inking.
- A new sync provider or any backend/auth change.
