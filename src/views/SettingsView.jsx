import { useState, useRef } from 'react'
import { Download, Upload, Trash2, Layers, Calendar, Info, Sun } from 'lucide-react'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
        ${value ? 'bg-amber-500' : 'bg-appInput'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
        ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SettingsRow({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 text-appTextMuted flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-appText font-medium">{title}</p>
          {subtitle && <p className="text-xs text-appTextMuted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export default function SettingsView() {
  const { settings, updateSetting } = useSettings()
  const fileInputRef = useRef(null)

  const exportData = async () => {
    const [jobs, entries, laborTypes] = await Promise.all([
      db.jobs.toArray(),
      db.entries.toArray(),
      db.laborTypes.toArray(),
    ])
    const json = JSON.stringify({ version: 1, exportedAt: new Date(), jobs, entries, laborTypes }, null, 2)
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      download: `punchin-${new Date().toISOString().slice(0,10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const triggerImport = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!data.version || !Array.isArray(data.jobs) || !Array.isArray(data.entries) || !Array.isArray(data.laborTypes)) {
        alert('Invalid backup file structure.')
        return
      }

      await db.transaction('rw', [db.laborTypes, db.jobs, db.entries], async () => {
        // 1. Import Labor Types
        const ltMap = {} // oldID -> newID
        const existingLts = await db.laborTypes.toArray()
        
        for (const backupLt of data.laborTypes) {
          const matched = existingLts.find(lt => lt.name.toLowerCase() === backupLt.name.toLowerCase())
          if (matched) {
            ltMap[backupLt.id] = matched.id
          } else {
            const newId = await db.laborTypes.add({
              name: backupLt.name,
              color: backupLt.color
            })
            ltMap[backupLt.id] = newId
          }
        }

        // 2. Import Jobs
        const jobMap = {} // oldID -> newID
        const existingJobs = await db.jobs.toArray()

        for (const backupJob of data.jobs) {
          const matched = existingJobs.find(j => j.name.toLowerCase() === backupJob.name.toLowerCase())
          if (matched) {
            jobMap[backupJob.id] = matched.id
          } else {
            const newLtId = backupJob.laborTypeId ? ltMap[backupJob.laborTypeId] : null
            const newId = await db.jobs.add({
              name: backupJob.name,
              clientName: backupJob.clientName || null,
              laborTypeId: newLtId,
              isActive: backupJob.isActive !== false
            })
            jobMap[backupJob.id] = newId
          }
        }

        // 3. Import Entries
        const existingEntries = await db.entries.toArray()
        let importedCount = 0

        for (const backupEntry of data.entries) {
          const newJobId = jobMap[backupEntry.jobId]
          const newLtId = backupEntry.laborTypeId ? ltMap[backupEntry.laborTypeId] : null

          if (!newJobId) continue

          // Deduplicate: check if exact entry already exists
          const isDuplicate = existingEntries.some(e => 
            e.jobId === newJobId &&
            e.laborTypeId === newLtId &&
            new Date(e.punchIn).getTime() === new Date(backupEntry.punchIn).getTime() &&
            (e.punchOut && backupEntry.punchOut ? new Date(e.punchOut).getTime() === new Date(backupEntry.punchOut).getTime() : e.punchOut === backupEntry.punchOut)
          )

          if (!isDuplicate) {
            await db.entries.add({
              jobId: newJobId,
              laborTypeId: newLtId,
              punchIn: new Date(backupEntry.punchIn),
              punchOut: backupEntry.punchOut ? new Date(backupEntry.punchOut) : null,
              notes: backupEntry.notes || null
            })
            importedCount++
          }
        }

        alert(`Import successful!\nRestored: ${importedCount} new time entries.`)
      })
    } catch (err) {
      console.error(err)
      alert('Error importing data: ' + err.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const clearEntries = async () => {
    if (window.confirm('Permanently delete ALL time entries? Jobs and labor types are kept.')) {
      await db.entries.clear()
    }
  }

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-6">

      {/* Timer */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Timer</p>
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <SettingsRow
            icon={Layers}
            title="Concurrent timers"
            subtitle="Run multiple jobs at the same time"
            right={
              <Toggle
                value={!!settings.allowConcurrentTimers}
                onChange={v => updateSetting('allowConcurrentTimers', v)}
              />
            }
          />
        </div>
      </section>

      {/* Calendar */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Calendar</p>
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <SettingsRow
            icon={Calendar}
            title="Week starts Monday"
            subtitle="Off = week starts Sunday"
            right={
              <Toggle
                value={settings.weekStartsMonday !== false}
                onChange={v => updateSetting('weekStartsMonday', v)}
              />
            }
          />
        </div>
      </section>

      {/* Appearance */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Appearance</p>
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <SettingsRow
            icon={Sun}
            title="Light mode"
            subtitle="Enable soft, high-contrast light theme"
            right={
              <Toggle
                value={settings.theme === 'light'}
                onChange={v => updateSetting('theme', v ? 'light' : 'dark')}
              />
            }
          />
        </div>
      </section>

      {/* Data */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Data</p>
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <button onClick={exportData}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left border-b border-appBorderLight">
            <Download className="w-4 h-4 text-appTextMuted flex-shrink-0" />
            <div>
              <p className="text-sm text-appText font-medium">Export data</p>
              <p className="text-xs text-appTextMuted mt-0.5">Download a JSON backup of everything</p>
            </div>
          </button>
          <button onClick={triggerImport}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left">
            <Upload className="w-4 h-4 text-appTextMuted flex-shrink-0" />
            <div>
              <p className="text-sm text-appText font-medium">Import data</p>
              <p className="text-xs text-appTextMuted mt-0.5">Restore jobs, types, and entries from backup JSON</p>
            </div>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <button onClick={clearEntries}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-500/10 transition-colors text-left group">
            <Trash2 className="w-4 h-4 text-appTextMuted group-hover:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-appText font-medium group-hover:text-red-400">Clear time entries</p>
              <p className="text-xs text-appTextMuted mt-0.5">Permanent — jobs and types are kept</p>
            </div>
          </button>
        </div>
      </section>

      {/* About */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">About</p>
        <div className="rounded-xl border border-appBorder bg-appCard">
          <SettingsRow
            icon={Info}
            title="PunchIn"
            subtitle={`v${__APP_VERSION__} · Phase 1 · Data stored on this device`}
            right={null}
          />
        </div>
      </section>
    </div>
  )
}
