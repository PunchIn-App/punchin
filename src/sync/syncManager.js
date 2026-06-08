import { db, getPortableSettings, applyPortableSettings } from '../db'
import { getDeviceId } from '../utils/deviceId'
import {
  createGist,
  fetchAllDeviceData,
  pushDeviceData,
  deleteDeviceFile,
  findExistingPunchInGist,
} from './providers/github'
import { pushToDrive, pullFromDrive } from './providers/google'
import { pushToOneDrive, pullFromOneDrive } from './providers/onedrive'
import { getSyncToken, getFreshAccessToken, clearSyncToken } from './tokenStore'

async function getSettings() {
  const rows = await db.settings.toArray()
  return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
}

export async function exportSnapshot() {
  const [jobs, entries, laborTypes, deletions, settings] = await Promise.all([
    db.jobs.toArray(),
    db.entries.toArray(),
    db.laborTypes.toArray(),
    db.deletions.toArray(),
    getPortableSettings(), // portable preferences ride along (sync/account keys excluded)
  ])
  return { version: 1, exportedAt: new Date().toISOString(), jobs, entries, laborTypes, deletions, settings }
}

// True when this device has no user data yet — used to decide whether a cloud
// pull should SEED preferences (a fresh install / installed PWA) vs leave an
// established device's own preferences alone.
async function isLocalDataEmpty() {
  const [j, e, l] = await Promise.all([db.jobs.count(), db.entries.count(), db.laborTypes.count()])
  return j === 0 && e === 0 && l === 0
}

// Merge an externally-provided snapshot (e.g. a transfer link, issue #77) into
// the local database, reusing the same name-based dedup as cloud sync. Returns
// the number of new time entries added. This is an EXPLICIT user import (file /
// transfer link), so the snapshot's portable preferences are applied.
export async function importSnapshot(remote) {
  return mergeSnapshot(remote, { applySettings: true })
}

// laborRates is a map keyed by laborTypeId — a device-local autoincrement id.
// Remap the keys through ltMap (remote laborTypeId -> local id) so per-type rates
// land under the right labor type on the receiving device. Rates whose labor type
// isn't present in the snapshot are dropped.
function remapLaborRates(rates, ltMap) {
  const out = {}
  for (const [remoteLtId, rate] of Object.entries(rates ?? {})) {
    const localLtId = ltMap[remoteLtId]
    if (localLtId != null) out[localLtId] = rate
  }
  return out
}

async function mergeSnapshot(remote, { applySettings = false } = {}) {
  if (!remote?.version || !Array.isArray(remote.jobs)) return 0

  const imported = await db.transaction('rw', [db.laborTypes, db.jobs, db.entries, db.deletions], async () => {
    // Identity is resolved per-record: a record that carries a `uuid` (written
    // by current app versions) is matched to the local record with the same
    // uuid — stable across renames and edits. Records without a uuid (legacy
    // v1 snapshots from older app versions) fall back to the original
    // name/value matching, so old and new snapshots both merge correctly.
    const ltMap = {}
    const existingLts = await db.laborTypes.toArray()
    for (const lt of remote.laborTypes ?? []) {
      const match =
        (lt.uuid && existingLts.find(e => e.uuid === lt.uuid)) ||
        existingLts.find(e => e.name.toLowerCase() === lt.name.toLowerCase())
      if (match) {
        ltMap[lt.id] = match.id
        // Last-write-wins for mutable fields (issue #120): name, color, archive.
        if (lt.uuid && (lt.updatedAt ?? 0) > (match.updatedAt ?? 0)) {
          const fields = { name: lt.name, color: lt.color, glyph: lt.glyph ?? null, isArchived: lt.isArchived ?? false }
          await db.laborTypes.update(match.id, { ...fields, updatedAt: lt.updatedAt })
          Object.assign(match, fields, { updatedAt: lt.updatedAt })
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
      }
      if (match) {
        jobMap[job.id] = match.id
        // Last-write-wins for mutable fields (issue #120): name, client, active,
        // labor type, and per-type rates (which were previously dropped entirely).
        if (job.uuid && (job.updatedAt ?? 0) > (match.updatedAt ?? 0)) {
          await db.jobs.update(match.id, { ...jobFields, updatedAt: job.updatedAt })
          Object.assign(match, jobFields, { updatedAt: job.updatedAt })
        }
      } else {
        const newId = await db.jobs.add({ ...jobFields, uuid: job.uuid, updatedAt: job.updatedAt })
        jobMap[job.id] = newId
        existingJobs.push({ id: newId, name: job.name, uuid: job.uuid, updatedAt: job.updatedAt })
      }
    }

    // Tombstones (issue #118): the union of local + remote deletions, keyed by
    // entry uuid. A tombstone deletes a local entry and suppresses re-importing
    // it — unless a strictly newer local edit exists (delete-wins by timestamp,
    // an edit after the delete "undeletes"). Remote tombstones are persisted
    // locally so the deletion keeps propagating onward.
    const tomb = new Map()
    for (const d of await db.deletions.toArray()) tomb.set(d.uuid, d.deletedAt)
    for (const d of remote.deletions ?? []) {
      if (!d?.uuid) continue
      if (d.deletedAt > (tomb.get(d.uuid) ?? 0)) {
        tomb.set(d.uuid, d.deletedAt)
        await db.deletions.put({ uuid: d.uuid, deletedAt: d.deletedAt })
      }
    }

    // Apply tombstones to local entries; keep the survivors for dedup below.
    const liveEntries = []
    for (const e of await db.entries.toArray()) {
      const deletedAt = e.uuid ? tomb.get(e.uuid) : undefined
      if (deletedAt != null && (e.updatedAt ?? 0) <= deletedAt) {
        await db.entries.delete(e.id)
      } else {
        liveEntries.push(e)
      }
    }

    let imported = 0
    for (const entry of remote.entries ?? []) {
      const newJobId = jobMap[entry.jobId]
      const newLtId = entry.laborTypeId ? ltMap[entry.laborTypeId] : null
      if (!newJobId) continue
      // Don't resurrect an entry covered by a tombstone (unless it's a newer edit).
      if (entry.uuid) {
        const deletedAt = tomb.get(entry.uuid)
        if (deletedAt != null && deletedAt >= (entry.updatedAt ?? 0)) continue
      }
      const fields = {
        jobId: newJobId,
        laborTypeId: newLtId,
        punchIn: new Date(entry.punchIn),
        punchOut: entry.punchOut ? new Date(entry.punchOut) : null,
        notes: entry.notes ?? null,
      }
      const local = entry.uuid
        ? liveEntries.find(e => e.uuid === entry.uuid)
        : liveEntries.find(e =>
            e.jobId === newJobId &&
            e.laborTypeId === newLtId &&
            new Date(e.punchIn).getTime() === new Date(entry.punchIn).getTime() &&
            (e.punchOut && entry.punchOut
              ? new Date(e.punchOut).getTime() === new Date(entry.punchOut).getTime()
              : e.punchOut === entry.punchOut)
          )
      if (local) {
        // Last-write-wins (issue #119): apply the remote edit in place when it is
        // newer than the local copy. Only uuid-matched records can resolve this;
        // legacy value-matched entries are left as-is (a field change wouldn't
        // value-match anyway, and they carry no updatedAt to compare).
        if (entry.uuid && (entry.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          await db.entries.update(local.id, { ...fields, updatedAt: entry.updatedAt })
          Object.assign(local, fields, { updatedAt: entry.updatedAt })
        }
        continue
      }
      const newId = await db.entries.add({ ...fields, uuid: entry.uuid, updatedAt: entry.updatedAt })
      liveEntries.push({ id: newId, uuid: entry.uuid, updatedAt: entry.updatedAt, ...fields })
      imported++
    }
    return imported
  })

  // Apply the snapshot's portable preferences after the data transaction (the
  // settings table isn't in its scope). Gated by the caller: an explicit import
  // (file / transfer link) applies always; a cloud pull seeds a fresh install only.
  if (applySettings && remote.settings) await applyPortableSettings(remote.settings)
  return imported
}

// Tag a sync network step so a failure says which side broke (issue #122).
// `download` failures leave local data untouched; `upload` failures mean the
// remote was merged into the local db but this device's changes didn't reach
// the cloud — they upload on the next sync. Both are safe to retry because
// mergeSnapshot is idempotent (records match by stable uuid, so re-running never
// duplicates). The TOKEN_EXPIRED signal is preserved so the UI can prompt re-auth.
async function syncStep(phase, work) {
  try {
    return await work()
  } catch (err) {
    if (err?.message === 'TOKEN_EXPIRED') throw err
    throw new Error(`Sync ${phase} failed: ${err.message}`)
  }
}

export async function runSync() {
  const s = await getSettings()
  // Single access-token chokepoint (issue #126): decrypts the at-rest token and
  // throws TOKEN_EXPIRED if it's past (within the safety margin of) expiry, so a
  // sync can't start and then have the (~1h, non-refreshable) Google/OneDrive
  // token die mid-flight. Refresh-token support will land inside it.
  const token = await getFreshAccessToken()
  if (!s.syncProvider || !token) throw new Error('Not connected')

  // Capture freshness BEFORE merging: a cloud pull seeds preferences only into a
  // brand-new install (after that, each established device keeps its own).
  const wasEmpty = await isLocalDataEmpty()
  let fileId = s.syncFileId ?? null

  if (s.syncProvider === 'github') {
    const deviceId = getDeviceId()

    if (!fileId) {
      fileId = await syncStep('download', () => findExistingPunchInGist(token))
      if (fileId) await db.settings.put({ key: 'syncFileId', value: fileId })
    }

    if (fileId) {
      const snapshots = await syncStep('download', () => fetchAllDeviceData(token, fileId))
      for (const snapshot of snapshots) await mergeSnapshot(snapshot)
      if (wasEmpty) {
        const seed = snapshots.find(snap => snap?.settings)
        if (seed) await applyPortableSettings(seed.settings)
      }
    }

    const snapshot = await exportSnapshot()

    if (fileId) {
      await syncStep('upload', () => pushDeviceData(token, fileId, deviceId, snapshot))
    } else {
      fileId = await syncStep('upload', () => createGist(token, deviceId, snapshot))
      await db.settings.put({ key: 'syncFileId', value: fileId })
    }
  } else if (s.syncProvider === 'google') {
    const remote = await syncStep('download', () => pullFromDrive(token))
    if (remote) await mergeSnapshot(remote)
    if (wasEmpty && remote?.settings) await applyPortableSettings(remote.settings)
    const snapshot = await exportSnapshot()
    await syncStep('upload', () => pushToDrive(token, snapshot))
  } else if (s.syncProvider === 'onedrive') {
    const remote = await syncStep('download', () => pullFromOneDrive(token))
    if (remote) await mergeSnapshot(remote)
    if (wasEmpty && remote?.settings) await applyPortableSettings(remote.settings)
    const snapshot = await exportSnapshot()
    await syncStep('upload', () => pushToOneDrive(token, snapshot))
  }

  const now = Date.now()
  await db.settings.put({ key: 'lastSyncedAt', value: now })
  return now
}

// Ask our Cloudflare Worker to revoke this device's OAuth token at the provider. The
// worker holds the GitHub client secret (required for GitHub's revoke) and also
// proxies Google's revoke so the app gets a real status without widening the
// browser CSP — see worker/oauth.js `handleRevoke`. Best-effort and same-origin.
async function revokeViaWorker(provider, token) {
  await fetch('/oauth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, token }),
  })
}

export async function disconnectSync() {
  const s = await getSettings()
  const token = await getSyncToken()

  // Best-effort: delete this device's file from the gist before clearing
  // credentials — and before the revoke below, which invalidates the token (so
  // a revoke-first ordering would 401 this PATCH and orphan the device file).
  if (s.syncProvider === 'github' && token && s.syncFileId) {
    try { await deleteDeviceFile(token, s.syncFileId, getDeviceId()) } catch {}
  }

  // Best-effort: kill THIS device's token at the provider so disconnect revokes
  // access provider-side, not merely locally — wiping the encrypted token below
  // only forgets it on this device, and the still-signed-in browser session
  // could otherwise be handed a fresh token silently ("pushed right through").
  // Deliberately device-scoped: GitHub uses DELETE …/token (other devices keep
  // syncing — not …/grant, which is account-wide), Google revokes just this
  // token (~1h-lived anyway). Drops the app's ACCESS only — the cloud copy of
  // the data is untouched and reconnecting re-discovers it. Both go through the
  // worker; OneDrive has no client-side revoke (its ~1h token simply expires —
  // the account chooser is forced via prompt=select_account instead).
  if (token && (s.syncProvider === 'github' || s.syncProvider === 'google')) {
    try { await revokeViaWorker(s.syncProvider, token) } catch {}
  }

  await clearSyncToken() // remove the encrypted token (and any legacy plaintext)
  await db.settings.bulkPut([
    { key: 'syncProvider', value: null },
    { key: 'syncTokenExpiry', value: null },
    { key: 'syncFileId', value: null },
    { key: 'lastSyncedAt', value: null },
    { key: 'syncUsername', value: null },
  ])
}
