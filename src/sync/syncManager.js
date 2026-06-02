import { db } from '../db'
import { createGist, updateGist, fetchGist } from './providers/github'
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

async function mergeSnapshot(remote) {
  if (!remote?.version || !Array.isArray(remote.jobs)) return 0

  return db.transaction('rw', [db.laborTypes, db.jobs, db.entries], async () => {
    const ltMap = {}
    const existingLts = await db.laborTypes.toArray()
    for (const lt of remote.laborTypes ?? []) {
      const match = existingLts.find(e => e.name.toLowerCase() === lt.name.toLowerCase())
      if (match) {
        ltMap[lt.id] = match.id
      } else {
        ltMap[lt.id] = await db.laborTypes.add({ name: lt.name, color: lt.color })
      }
    }

    const jobMap = {}
    const existingJobs = await db.jobs.toArray()
    for (const job of remote.jobs ?? []) {
      const match = existingJobs.find(j => j.name.toLowerCase() === job.name.toLowerCase())
      if (match) {
        jobMap[job.id] = match.id
      } else {
        jobMap[job.id] = await db.jobs.add({
          name: job.name,
          clientName: job.clientName ?? null,
          laborTypeId: job.laborTypeId ? ltMap[job.laborTypeId] : null,
          isActive: job.isActive !== false,
        })
      }
    }

    const existingEntries = await db.entries.toArray()
    let imported = 0
    for (const entry of remote.entries ?? []) {
      const newJobId = jobMap[entry.jobId]
      const newLtId = entry.laborTypeId ? ltMap[entry.laborTypeId] : null
      if (!newJobId) continue
      const dup = existingEntries.some(e =>
        e.jobId === newJobId &&
        e.laborTypeId === newLtId &&
        new Date(e.punchIn).getTime() === new Date(entry.punchIn).getTime() &&
        (e.punchOut && entry.punchOut
          ? new Date(e.punchOut).getTime() === new Date(entry.punchOut).getTime()
          : e.punchOut === entry.punchOut)
      )
      if (!dup) {
        await db.entries.add({
          jobId: newJobId,
          laborTypeId: newLtId,
          punchIn: new Date(entry.punchIn),
          punchOut: entry.punchOut ? new Date(entry.punchOut) : null,
          notes: entry.notes ?? null,
        })
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

  let remote = null
  let fileId = s.syncFileId ?? null

  if (s.syncProvider === 'github') {
    if (fileId) remote = await fetchGist(s.syncToken, fileId)
  } else if (s.syncProvider === 'google') {
    remote = await pullFromDrive(s.syncToken)
  } else if (s.syncProvider === 'onedrive') {
    remote = await pullFromOneDrive(s.syncToken)
  }

  if (remote) await mergeSnapshot(remote)

  const snapshot = await exportSnapshot()

  if (s.syncProvider === 'github') {
    if (fileId) {
      await updateGist(s.syncToken, fileId, snapshot)
    } else {
      fileId = await createGist(s.syncToken, snapshot)
      await db.settings.put({ key: 'syncFileId', value: fileId })
    }
  } else if (s.syncProvider === 'google') {
    await pushToDrive(s.syncToken, snapshot)
  } else if (s.syncProvider === 'onedrive') {
    await pushToOneDrive(s.syncToken, snapshot)
  }

  const now = Date.now()
  await db.settings.put({ key: 'lastSyncedAt', value: now })
  return now
}

export async function disconnectSync() {
  await db.settings.bulkPut([
    { key: 'syncProvider', value: null },
    { key: 'syncToken', value: null },
    { key: 'syncTokenExpiry', value: null },
    { key: 'syncFileId', value: null },
    { key: 'lastSyncedAt', value: null },
  ])
}
