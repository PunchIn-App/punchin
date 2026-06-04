import { db } from '../db'
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

async function getSettings() {
  const rows = await db.settings.toArray()
  return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
}

export async function exportSnapshot() {
  const [jobs, entries, laborTypes] = await Promise.all([
    db.jobs.toArray(),
    db.entries.toArray(),
    db.laborTypes.toArray(),
  ])
  return { version: 1, exportedAt: new Date().toISOString(), jobs, entries, laborTypes }
}

// Merge an externally-provided snapshot (e.g. a transfer link, issue #77) into
// the local database, reusing the same name-based dedup as cloud sync. Returns
// the number of new time entries added.
export async function importSnapshot(remote) {
  return mergeSnapshot(remote)
}

async function mergeSnapshot(remote) {
  if (!remote?.version || !Array.isArray(remote.jobs)) return 0

  return db.transaction('rw', [db.laborTypes, db.jobs, db.entries], async () => {
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
      } else {
        const newId = await db.laborTypes.add({
          name: lt.name, color: lt.color, uuid: lt.uuid, updatedAt: lt.updatedAt,
        })
        ltMap[lt.id] = newId
        existingLts.push({ id: newId, name: lt.name, uuid: lt.uuid })
      }
    }

    const jobMap = {}
    const existingJobs = await db.jobs.toArray()
    for (const job of remote.jobs ?? []) {
      const match =
        (job.uuid && existingJobs.find(j => j.uuid === job.uuid)) ||
        existingJobs.find(j => j.name.toLowerCase() === job.name.toLowerCase())
      if (match) {
        jobMap[job.id] = match.id
      } else {
        const newId = await db.jobs.add({
          name: job.name,
          clientName: job.clientName ?? null,
          laborTypeId: job.laborTypeId ? ltMap[job.laborTypeId] : null,
          isActive: job.isActive !== false,
          uuid: job.uuid, updatedAt: job.updatedAt,
        })
        jobMap[job.id] = newId
        existingJobs.push({ id: newId, name: job.name, uuid: job.uuid })
      }
    }

    const existingEntries = await db.entries.toArray()
    let imported = 0
    for (const entry of remote.entries ?? []) {
      const newJobId = jobMap[entry.jobId]
      const newLtId = entry.laborTypeId ? ltMap[entry.laborTypeId] : null
      if (!newJobId) continue
      const dup = entry.uuid
        ? existingEntries.some(e => e.uuid === entry.uuid)
        : existingEntries.some(e =>
            e.jobId === newJobId &&
            e.laborTypeId === newLtId &&
            new Date(e.punchIn).getTime() === new Date(entry.punchIn).getTime() &&
            (e.punchOut && entry.punchOut
              ? new Date(e.punchOut).getTime() === new Date(entry.punchOut).getTime()
              : e.punchOut === entry.punchOut)
          )
      if (!dup) {
        const newId = await db.entries.add({
          jobId: newJobId,
          laborTypeId: newLtId,
          punchIn: new Date(entry.punchIn),
          punchOut: entry.punchOut ? new Date(entry.punchOut) : null,
          notes: entry.notes ?? null,
          uuid: entry.uuid, updatedAt: entry.updatedAt,
        })
        existingEntries.push({ id: newId, uuid: entry.uuid, jobId: newJobId, laborTypeId: newLtId, punchIn: new Date(entry.punchIn), punchOut: entry.punchOut ? new Date(entry.punchOut) : null })
        imported++
      }
    }
    return imported
  })
}

export async function runSync() {
  const s = await getSettings()
  if (!s.syncProvider || !s.syncToken) throw new Error('Not connected')
  if (s.syncTokenExpiry && Date.now() > s.syncTokenExpiry) throw new Error('TOKEN_EXPIRED')

  let fileId = s.syncFileId ?? null

  if (s.syncProvider === 'github') {
    const deviceId = getDeviceId()

    if (!fileId) {
      fileId = await findExistingPunchInGist(s.syncToken)
      if (fileId) await db.settings.put({ key: 'syncFileId', value: fileId })
    }

    if (fileId) {
      const snapshots = await fetchAllDeviceData(s.syncToken, fileId)
      for (const snapshot of snapshots) await mergeSnapshot(snapshot)
    }

    const snapshot = await exportSnapshot()

    if (fileId) {
      await pushDeviceData(s.syncToken, fileId, deviceId, snapshot)
    } else {
      fileId = await createGist(s.syncToken, deviceId, snapshot)
      await db.settings.put({ key: 'syncFileId', value: fileId })
    }
  } else if (s.syncProvider === 'google') {
    const remote = await pullFromDrive(s.syncToken)
    if (remote) await mergeSnapshot(remote)
    const snapshot = await exportSnapshot()
    await pushToDrive(s.syncToken, snapshot)
  } else if (s.syncProvider === 'onedrive') {
    const remote = await pullFromOneDrive(s.syncToken)
    if (remote) await mergeSnapshot(remote)
    const snapshot = await exportSnapshot()
    await pushToOneDrive(s.syncToken, snapshot)
  }

  const now = Date.now()
  await db.settings.put({ key: 'lastSyncedAt', value: now })
  return now
}

export async function disconnectSync() {
  const s = await getSettings()

  // Best-effort: delete this device's file from the gist before clearing credentials
  if (s.syncProvider === 'github' && s.syncToken && s.syncFileId) {
    try { await deleteDeviceFile(s.syncToken, s.syncFileId, getDeviceId()) } catch {}
  }

  await db.settings.bulkPut([
    { key: 'syncProvider', value: null },
    { key: 'syncToken', value: null },
    { key: 'syncTokenExpiry', value: null },
    { key: 'syncFileId', value: null },
    { key: 'lastSyncedAt', value: null },
    { key: 'syncUsername', value: null },
  ])
}
