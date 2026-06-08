import { format } from 'date-fns'
import { db, getPortableSettings } from '../db'

// Backup/export helpers, kept out of SettingsView so the data plumbing isn't
// tangled with rendering and can be tested directly (issue #144). Each reads the
// db and triggers a browser download.

function downloadBlob(blob, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// Full JSON backup of jobs, entries, labor types, and portable preferences
// (theme, accent, billing profile, currency, … — sync/account keys excluded), so
// restoring on a fresh install / installed PWA brings your settings across too.
export async function exportBackup() {
  const [jobs, entries, laborTypes, settings] = await Promise.all([
    db.jobs.toArray(),
    db.entries.toArray(),
    db.laborTypes.toArray(),
    getPortableSettings(),
  ])
  const json = JSON.stringify({ version: 1, exportedAt: new Date(), jobs, entries, laborTypes, settings }, null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), `punchin-${new Date().toISOString().slice(0, 10)}.json`)
}

// CSV of every completed entry (skips running timers), one row per entry.
export async function exportCsv() {
  const [jobs, entries, laborTypes] = await Promise.all([
    db.jobs.toArray(),
    db.entries.toArray(),
    db.laborTypes.toArray(),
  ])
  const rows = [['Date', 'Job', 'Client', 'Labor Type', 'Start', 'End', 'Duration (h)', 'Notes']]
  for (const e of entries) {
    if (!e.punchOut) continue
    const job = jobs.find(j => j.id === e.jobId)
    const lt  = laborTypes.find(l => l.id === e.laborTypeId)
    const dur = (new Date(e.punchOut) - new Date(e.punchIn)) / 3600000
    rows.push([
      format(new Date(e.punchIn), 'yyyy-MM-dd'),
      job?.name || '',
      job?.clientName || '',
      lt?.name || '',
      format(new Date(e.punchIn), 'HH:mm'),
      format(new Date(e.punchOut), 'HH:mm'),
      dur.toFixed(2),
      e.notes || '',
    ])
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `punchin-all-${new Date().toISOString().slice(0, 10)}.csv`)
}
