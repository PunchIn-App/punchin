import { useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ChangelogModal from '../components/ChangelogModal'
import ColorPicker from '../components/ColorPicker'
import { Download, Upload, Trash2, Layers, Calendar, Info, Sun, Moon, Monitor, RefreshCw, ExternalLink, ScrollText, AlertTriangle, ChevronDown, Palette, Bug, MonitorDown, Cloud, CloudOff, Github, LogOut } from 'lucide-react'
import { getInstallPrompt, applyUpdate } from '../utils/pwa'
import { format } from 'date-fns'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { runSync, disconnectSync } from '../sync/syncManager'
import { buildGitHubOAuthUrl } from '../sync/providers/github'
import { buildGoogleOAuthUrl } from '../sync/providers/google'
import { buildOneDriveOAuthUrl } from '../sync/providers/onedrive'
import { SYNC_CONFIG } from '../sync/config'

const ACCENT_PRESETS = [
  { name: 'Blue',   hex: '#1f6feb' },
  { name: 'Amber',  hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Lime',   hex: '#84CC16' },
  { name: 'Teal',   hex: '#2DD4BF' },
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

export function buildBugReportUrl(appVersion, isStandalone, os) {
  const ua = navigator.userAgent

  let browser = 'Unknown'
  if (/Edg\/(\d+)/.test(ua))                   browser = `Edge ${ua.match(/Edg\/(\d+)/)[1]}`
  else if (/CriOS\/(\d+)/.test(ua))             browser = `Chrome ${ua.match(/CriOS\/(\d+)/)[1]} (iOS)`
  else if (/FxiOS\/(\d+)/.test(ua))             browser = `Firefox ${ua.match(/FxiOS\/(\d+)/)[1]} (iOS)`
  else if (/Chrome\/(\d+)/.test(ua))            browser = `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}`
  else if (/Version\/(\d+).*Safari/.test(ua))   browser = `Safari ${ua.match(/Version\/(\d+)/)[1]}`
  else if (/Firefox\/(\d+)/.test(ua))           browser = `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}`

  let osStr = 'Unknown'
  if (os === 'ios') {
    const m = ua.match(/OS (\d+[_\d]*)/)
    osStr = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS'
  } else if (os === 'android') {
    const m = ua.match(/Android (\d+\.?\d*)/)
    osStr = m ? `Android ${m[1]}` : 'Android'
  } else {
    const mac = ua.match(/Mac OS X (\d+[_\d]*)/)
    const win = ua.match(/Windows NT (\d+\.\d+)/)
    if (mac) osStr = `macOS ${mac[1].replace(/_/g, '.')}`
    else if (win) {
      const ntMap = { '10.0': 'Windows 10 / 11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' }
      osStr = ntMap[win[1]] ?? `Windows NT ${win[1]}`
    } else osStr = 'Linux / other'
  }

  let device = 'Unknown'
  if (os === 'ios') {
    device = /iPad/.test(ua) ? 'iPad' : 'iPhone'
  } else if (os === 'android') {
    const m = ua.match(/\(Linux; Android [^;]+; ([^)]+)\)/)
    device = m ? m[1].trim() : 'Android device'
  } else {
    device = `Desktop (${screen.width}×${screen.height})`
  }

  const params = new URLSearchParams({
    template: 'bug_report.yml',
    version: appVersion,
    'install-type': isStandalone ? 'PWA (installed to home screen)' : 'Browser tab',
    browser,
    os: osStr,
    device,
  })

  return `https://github.com/PunchIn-App/punchin/issues/new?${params}`
}

const PROVIDER_LABEL = { github: 'GitHub Gist', google: 'Google Drive', onedrive: 'OneDrive' }

function formatLastSync(ts) {
  if (!ts) return 'Never synced'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function SettingsView() {
  const { settings, updateSetting } = useSettings()
  const { isStandalone, os } = usePlatformContext()
  const fileInputRef = useRef(null)
  const [resetStage, setResetStage] = useState(null) // null | 'warn' | 'final'
  const [dangerOpen, setDangerOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'latest'
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(() => !!window.__pwaUpdateAvailable)
  const [installPrompt, setInstallPrompt] = useState(getInstallPrompt)
  const [syncing, setSyncing] = useState(false)

  const syncSettings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
  }, [])

  useEffect(() => {
    const onUpdateReady = () => setUpdateAvailable(true)
    const onInstallReady = () => setInstallPrompt(getInstallPrompt())
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('pwa:update-ready', onUpdateReady)
    window.addEventListener('pwa:install-ready', onInstallReady)
    window.addEventListener('pwa:installed', onInstalled)
    return () => {
      window.removeEventListener('pwa:update-ready', onUpdateReady)
      window.removeEventListener('pwa:install-ready', onInstallReady)
      window.removeEventListener('pwa:installed', onInstalled)
    }
  }, [])

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
    if (updateAvailable) {
      applyUpdate()
      return
    }

    setUpdateStatus('checking')

    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 3000)
      return
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3000)
        return
      }

      // Prompt the browser to fetch the SW from the server right now.
      // If a new version is found, onNeedRefresh in main.jsx fires and
      // dispatches pwa:update-ready, which sets updateAvailable via the
      // useEffect listener above.
      await reg.update()

      // Wait long enough for the new SW to download and trigger onNeedRefresh.
      await new Promise(r => setTimeout(r, 2500))

      if (!window.__pwaUpdateAvailable) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3000)
      }
      // If an update was found during the wait, updateAvailable is already
      // true and the button will reflect it — no further action needed here.
    } catch {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 3000)
    }
  }

  const handleInstall = async () => {
    const prompt = getInstallPrompt()
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      window.__pwaInstallPrompt = null
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
        { key: 'syncProvider',          value: null },
        { key: 'syncToken',             value: null },
        { key: 'syncTokenExpiry',       value: null },
        { key: 'syncFileId',            value: null },
        { key: 'lastSyncedAt',          value: null },
      ])
    })
    setResetStage(null)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await runSync()
      await db.settings.put({ key: 'syncError', value: null })
    } catch (err) {
      await db.settings.put({ key: 'syncError', value: err.message })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect sync? Your local data is kept.')) return
    await disconnectSync()
  }

  const tokenExpired = syncSettings?.syncTokenExpiry && Date.now() > syncSettings.syncTokenExpiry

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
              value={settings.accentColor || '#1f6feb'}
              onChange={hex => updateSetting('accentColor', hex)}
              size="md"
              label="Choose accent color"
            />
          </div>
        </div>
      </section>

      {/* Install — only shown when the browser has offered a native install prompt */}
      {installPrompt && (
        <section>
          <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Install</p>
          <div className="rounded-xl border border-appBorder bg-appCard">
            <button
              onClick={handleInstall}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left rounded-xl">
              <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm text-appText font-medium">Add to Home Screen</p>
                <p className="text-xs text-appTextMuted mt-0.5">Install as a standalone app for faster access</p>
              </div>
            </button>
          </div>
        </section>
      )}

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
            aria-label="Import backup JSON file"
            className="hidden"
          />
        </div>
      </section>

      {/* Sync */}
      <section>
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2 px-1">Sync</p>
        <div className="rounded-xl border border-appBorder bg-appCard overflow-hidden">
          {syncSettings?.syncProvider ? (
            <>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-appBorderLight">
                <Cloud className={`w-4 h-4 flex-shrink-0 ${tokenExpired ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-appText font-medium">
                    {PROVIDER_LABEL[syncSettings.syncProvider] ?? syncSettings.syncProvider}
                  </p>
                  <p className="text-xs text-appTextMuted mt-0.5">
                    {tokenExpired
                      ? 'Token expired — reconnect to continue syncing'
                      : `Last synced: ${formatLastSync(syncSettings.lastSyncedAt)}`}
                  </p>
                  {syncSettings.syncError && !tokenExpired && (
                    <p className="text-xs text-red-400 mt-0.5 truncate">{syncSettings.syncError}</p>
                  )}
                </div>
              </div>
              <div className="flex divide-x divide-appBorderLight">
                <button
                  onClick={handleSync}
                  disabled={syncing || !!tokenExpired}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 hover:bg-appInput transition-colors text-sm text-appText disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 hover:bg-appInput transition-colors text-sm text-appTextMuted hover:text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-appBorderLight">
                <CloudOff className="w-4 h-4 text-appTextMuted flex-shrink-0" />
                <div>
                  <p className="text-sm text-appText font-medium">Sync across devices</p>
                  <p className="text-xs text-appTextMuted mt-0.5">Store your data in your own cloud account</p>
                </div>
              </div>
              <div className="px-4 py-4 space-y-2">
                {SYNC_CONFIG.github.clientId && (
                  <button
                    onClick={() => { window.location.href = buildGitHubOAuthUrl(SYNC_CONFIG.github.clientId, SYNC_CONFIG.github.callbackBase) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-left"
                  >
                    <Github className="w-4 h-4 text-appTextMuted flex-shrink-0" />
                    <div>
                      <p className="text-sm text-appText font-medium">GitHub Gist</p>
                      <p className="text-xs text-appTextMuted">Private gist in your GitHub account</p>
                    </div>
                  </button>
                )}
                {SYNC_CONFIG.google.clientId && (
                  <button
                    onClick={() => { window.location.href = buildGoogleOAuthUrl(SYNC_CONFIG.google.clientId) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-left"
                  >
                    <Cloud className="w-4 h-4 text-appTextMuted flex-shrink-0" />
                    <div>
                      <p className="text-sm text-appText font-medium">Google Drive</p>
                      <p className="text-xs text-appTextMuted">Stored in a hidden app folder</p>
                    </div>
                  </button>
                )}
                {SYNC_CONFIG.onedrive.clientId && (
                  <button
                    onClick={() => { window.location.href = buildOneDriveOAuthUrl(SYNC_CONFIG.onedrive.clientId) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-left"
                  >
                    <Cloud className="w-4 h-4 text-appTextMuted flex-shrink-0" />
                    <div>
                      <p className="text-sm text-appText font-medium">OneDrive</p>
                      <p className="text-xs text-appTextMuted">Stored in your OneDrive app folder</p>
                    </div>
                  </button>
                )}
                {!SYNC_CONFIG.github.clientId && !SYNC_CONFIG.google.clientId && !SYNC_CONFIG.onedrive.clientId && (
                  <p className="text-xs text-appTextMuted px-1">
                    Set <code className="font-mono">VITE_GITHUB_CLIENT_ID</code>, <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code>, or <code className="font-mono">VITE_ONEDRIVE_CLIENT_ID</code> to enable sync.
                    See <code className="font-mono">.env.example</code> for setup instructions.
                  </p>
                )}
              </div>
            </>
          )}
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
            onClick={() => window.open(buildBugReportUrl(__APP_VERSION__, isStandalone, os), '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
            <div className="flex items-center gap-3 min-w-0">
              <Bug className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">Report a bug</p>
                <p className="text-xs text-appTextMuted mt-0.5">Opens a pre-filled GitHub issue with your device info</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          </button>
          <button
            onClick={checkForUpdates}
            disabled={updateStatus === 'checking'}
            className={`w-full flex items-center gap-3 px-4 py-4 transition-colors text-left rounded-b-xl disabled:opacity-60
              ${updateAvailable ? 'hover:bg-appAccent/10' : 'hover:bg-appInput'}`}>
            <RefreshCw
              className={`w-4 h-4 flex-shrink-0 ${updateStatus === 'checking' ? 'animate-spin' : ''} ${updateAvailable ? 'text-appAccent' : 'text-appTextMuted'}`}
              aria-hidden="true"
            />
            <div>
              <p className={`text-sm font-medium ${updateAvailable ? 'text-appAccent' : 'text-appText'}`}>
                {updateAvailable ? 'Update available' : 'Check for updates'}
              </p>
              <p className="text-xs text-appTextMuted mt-0.5">
                {updateAvailable                         && 'Tap to reload and apply the new version'}
                {!updateAvailable && updateStatus === 'checking' && 'Checking…'}
                {!updateAvailable && updateStatus === 'latest'   && 'Already up to date'}
                {!updateAvailable && !updateStatus               && 'Tap to check for a new version'}
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
