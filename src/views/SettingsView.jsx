import { useState, useRef } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ChangelogModal from '../components/ChangelogModal'
import ColorPicker from '../components/ColorPicker'
import { Download, Upload, Trash2, Layers, Calendar, Info, Sun, Moon, Monitor, RefreshCw, ExternalLink, ScrollText, AlertTriangle, ChevronDown, Palette } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'

const ACCENT_PRESETS = [
  { name: 'Amber',  hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Lime',   hex: '#84CC16' },
  { name: 'Teal',   hex: '#2DD4BF' },
  { name: 'Sky',    hex: '#38BDF8' },
]

function Toggle({ value, onChange, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border-2
        ${value ? 'bg-appAccent border-appAccent' : 'bg-appInput border-gray-500/60'}`}
    >
      <span className={`absolute top-[1px] left-[1px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform
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

// Exported for unit testing — pure predicate with no DB dependency
export function isEntryDuplicate(backupEntry, existingEntries, newJobId, newLtId) {
  return existingEntries.some(e =>
    e.jobId === newJobId &&
    e.laborTypeId === newLtId &&
    new Date(e.punchIn).getTime() === new Date(backupEntry.punchIn).getTime() &&
    (e.punchOut && backupEntry.punchOut
      ? new Date(e.punchOut).getTime() === new Date(backupEntry.punchOut).getTime()
      : e.punchOut === backupEntry.punchOut)
  )
}

export default function SettingsView() {
  const { settings, updateSetting } = useSettings()
  const fileInputRef = useRef(null)
  const [resetStage, setResetStage] = useState(null) // null | 'warn' | 'final'
  const [dangerOpen, setDangerOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'latest'
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)

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

  const exportCsvAll = async () => {
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
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `punchin-all-${new Date().toISOString().slice(0,10)}.csv`,
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

          const isDuplicate = isEntryDuplicate(backupEntry, existingEntries, newJobId, newLtId)

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

  const checkForUpdates = async () => {
    setUpdateStatus('checking')

    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 2500)
      return
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 2500)
        return
      }

      // Already a new version waiting → reload to apply it
      if (reg.waiting) {
        window.location.reload()
        return
      }

      // With autoUpdate the new SW skips waiting and fires controllerchange on activate
      let updateFound = false
      reg.addEventListener('updatefound', () => { updateFound = true }, { once: true })
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })

      await reg.update()

      // Brief buffer for updatefound / controllerchange to settle after update() resolves
      await new Promise(r => setTimeout(r, 400))

      if (updateFound) {
        // New SW installing; controllerchange will reload — force reload as fallback
        window.location.reload()
      } else {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 2500)
      }
    } catch {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 2500)
    }
  }

  const clearEntries = async () => {
    await db.entries.clear()
    setShowClearConfirm(false)
  }

  const factoryReset = async () => {
    await db.transaction('rw', [db.entries, db.jobs, db.laborTypes, db.settings], async () => {
      await db.entries.clear()
      await db.jobs.clear()
      await db.laborTypes.clear()
      await db.settings.clear()
      await db.settings.bulkPut([
        { key: 'allowConcurrentTimers', value: false },
        { key: 'weekStartsMonday',      value: true  },
        { key: 'theme',                 value: 'auto' },
        { key: 'accentColor',           value: '#F59E0B' },
      ])
    })
    setResetStage(null)
  }

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-6 lg:max-w-2xl lg:mx-auto lg:w-full">

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
                ariaLabel="Allow concurrent timers"
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
                ariaLabel="Week starts Monday"
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
            icon={Monitor}
            title="Theme"
            subtitle="Auto follows your device setting"
            right={
              <div className="flex items-center gap-0.5 bg-appBg rounded-lg p-0.5 border border-appBorder">
                {[
                  { value: 'auto',  label: 'Auto',  Icon: Monitor },
                  { value: 'light', label: 'Light', Icon: Sun     },
                  { value: 'dark',  label: 'Dark',  Icon: Moon    },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => updateSetting('theme', value)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                      ${(settings.theme || 'auto') === value
                        ? 'bg-appAccent text-[#0F1117]'
                        : 'text-appTextMuted hover:text-appText'}`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="flex items-center justify-between px-4 py-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Palette className="w-4 h-4 text-appTextMuted flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">Accent color</p>
                <p className="text-xs text-appTextMuted mt-0.5">Highlight color throughout the app</p>
              </div>
            </div>
            <ColorPicker
              presets={ACCENT_PRESETS}
              value={settings.accentColor || '#F59E0B'}
              onChange={hex => updateSetting('accentColor', hex)}
              size="md"
              label="Choose accent color"
            />
          </div>
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
          <button onClick={exportCsvAll}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left border-b border-appBorderLight">
            <Download className="w-4 h-4 text-appTextMuted flex-shrink-0" />
            <div>
              <p className="text-sm text-appText font-medium">Export CSV</p>
              <p className="text-xs text-appTextMuted mt-0.5">Download all completed entries as a spreadsheet</p>
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
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <button
          onClick={() => { setDangerOpen(o => !o); setResetStage(null) }}
          aria-expanded={dangerOpen}
          className="flex items-center gap-2 mb-2 px-1 w-full group"
        >
          <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-widest">Danger Zone</p>
          <ChevronDown className={`w-3 h-3 text-red-400/70 transition-transform ${dangerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {dangerOpen && (
          <div className="rounded-xl border border-red-500/30 bg-appCard overflow-hidden">
            {/* Clear entries */}
            <button onClick={() => setShowClearConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-500/10 transition-colors text-left group border-b border-appBorderLight">
              <Trash2 className="w-4 h-4 text-appTextMuted group-hover:text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-appText font-medium group-hover:text-red-400">Clear time entries</p>
                <p className="text-xs text-appTextMuted mt-0.5">Permanent — jobs and types are kept</p>
              </div>
            </button>

            {resetStage === null && (
              <button
                onClick={() => setResetStage('warn')}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-500/10 transition-colors text-left group">
                <AlertTriangle className="w-4 h-4 text-appTextMuted group-hover:text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-appText font-medium group-hover:text-red-400">Factory Reset</p>
                  <p className="text-xs text-appTextMuted mt-0.5">Erase all data and restore app to default state</p>
                </div>
              </button>
            )}

            {resetStage === 'warn' && (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-appText font-medium">Reset to factory defaults?</p>
                    <p className="text-xs text-appTextMuted mt-1">This will permanently delete all time entries, jobs, and labor types. Settings will be reset. This action cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResetStage('final')}
                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
                    Continue
                  </button>
                  <button
                    onClick={() => setResetStage(null)}
                    className="flex-1 py-2 rounded-lg bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetStage === 'final' && (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">There is no going back.</p>
                    <p className="text-xs text-appTextMuted mt-1">Every entry, job, and labor type will be permanently erased. Are you absolutely sure?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={factoryReset}
                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors">
                    Yes, wipe everything
                  </button>
                  <button
                    onClick={() => setResetStage(null)}
                    className="flex-1 py-2 rounded-lg bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* About */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">About</p>
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <a
            href="https://github.com/PunchIn-App/punchin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-4 gap-3 hover:bg-appInput transition-colors rounded-t-xl">
            <div className="flex items-center gap-3 min-w-0">
              <Info className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">PunchIn</p>
                <p className="text-xs text-appTextMuted mt-0.5">{`v${__APP_VERSION__} · Data stored on this device`}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          </a>
          <button
            onClick={() => setShowChangelog(true)}
            className="w-full flex items-center justify-between px-4 py-4 gap-3 hover:bg-appInput transition-colors text-left">
            <div className="flex items-center gap-3 min-w-0">
              <ScrollText className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">Changelog</p>
                <p className="text-xs text-appTextMuted mt-0.5">See what's new in each release</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-appTextMuted flex-shrink-0 -rotate-90" aria-hidden="true" />
          </button>
          <button
            onClick={checkForUpdates}
            disabled={updateStatus === 'checking'}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left rounded-b-xl disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 text-appTextMuted flex-shrink-0 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} aria-hidden="true" />
            <div>
              <p className="text-sm text-appText font-medium">Check for updates</p>
              <p className="text-xs text-appTextMuted mt-0.5">
                {updateStatus === 'checking' && 'Checking…'}
                {updateStatus === 'latest'   && 'Already up to date'}
                {!updateStatus               && 'Reload to apply any pending app update'}
              </p>
            </div>
          </button>
        </div>
      </section>

      {showClearConfirm && (
        <ConfirmModal
          title="Clear all time entries?"
          message="Jobs and labor types are kept. This cannot be undone."
          confirmLabel="Clear entries"
          onConfirm={clearEntries}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  )
}
