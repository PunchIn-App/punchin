import { useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ChangelogModal from '../components/ChangelogModal'
import ColorPicker from '../components/ColorPicker'
import DataTransfer from '../components/DataTransfer'
import { Download, Upload, Trash2, Layers, Calendar, Info, Sun, Moon, Monitor, RefreshCw, ExternalLink, ScrollText, AlertTriangle, ChevronDown, Palette, Bug, MonitorDown, Cloud, CloudOff, Github, LogOut, Check, Share, Plus, Compass, Vibrate, SlidersHorizontal, Database, Bell, Hourglass, AlarmClock, CalendarClock, CalendarCheck, Share2 } from 'lucide-react'
import { notificationsSupported, notificationPermission, requestNotificationPermission } from '../utils/notifications'
import { applyUpdate, hasWaitingUpdate } from '../utils/pwa'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
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

// A reminder sub-option: a labelled toggle row with an optional control area
// (time / minutes / weekday) revealed when the toggle is on (issue #54).
function ReminderRow({ icon: Icon, title, subtitle, enabled, onToggle, children }) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-appText font-medium">{title}</p>
            {subtitle && <p className="text-xs text-appTextMuted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <Toggle value={enabled} onChange={onToggle} ariaLabel={title} />
      </div>
      {enabled && children && <div className="mt-3 pl-7 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const reminderInputClass = 'bg-appBg border border-appBorder text-appText rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

// Collapsible settings group. Only one section is open at a time (single-open
// accordion) — the parent owns the open state and closes siblings when one
// opens. Keeps the long settings list decluttered (issue #60).
function AccordionSection({ title, icon: Icon, danger, badge, open, onToggle, children }) {
  const borderColor = danger ? 'border-red-500/30' : 'border-appBorder'
  const titleColor = danger ? 'text-red-400' : 'text-appText'
  const iconColor = danger ? 'text-red-400/80' : 'text-appTextMuted'
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border ${borderColor} bg-appCard hover:bg-appInput transition-colors text-left`}
      >
        <span className="flex items-center gap-3 min-w-0">
          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} aria-hidden="true" />}
          <span className={`text-sm font-medium ${titleColor}`}>{title}</span>
          {badge && <span className="w-2 h-2 rounded-full bg-appAccent flex-shrink-0" aria-hidden="true" />}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${iconColor} ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
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
  const { isStandalone, os, isIPad } = usePlatformContext()
  const fileInputRef = useRef(null)
  const [resetStage, setResetStage] = useState(null) // null | 'warn' | 'final'
  // Single-open accordion: which section is expanded (null = all collapsed).
  // Open straight to About when an update is already waiting so the user can
  // act on it without hunting (the header also shows a dot — see badge below).
  const [openSection, setOpenSection] = useState(() =>
    (typeof window !== 'undefined' && window.__pwaUpdateAvailable) ? 'about' : null
  )
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'latest'
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(() => !!window.__pwaUpdateAvailable)
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [notifPerm, setNotifPerm] = useState(() => notificationPermission())
  const { canInstall, isInstalled, isIOS, isIOSSafari, os: installOs, promptInstall } = useInstallPrompt()

  const toggleSection = (id) => setOpenSection(cur => (cur === id ? null : id))

  // Reset the multi-stage factory-reset flow whenever the Danger Zone collapses,
  // so re-opening it always starts from the neutral state.
  useEffect(() => {
    if (openSection !== 'danger') setResetStage(null)
  }, [openSection])

  const syncSettings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
  }, [])

  useEffect(() => {
    const onUpdateReady = () => setUpdateAvailable(true)
    window.addEventListener('pwa:update-ready', onUpdateReady)
    return () => window.removeEventListener('pwa:update-ready', onUpdateReady)
  }, [])

  // An update may have downloaded in a previous page load and still be waiting
  // to activate, but the in-memory flag resets on mount. Re-surface it so the
  // "Update available" affordance survives reloads / factory reset (issue #57).
  useEffect(() => {
    let cancelled = false
    hasWaitingUpdate().then(waiting => {
      if (waiting && !cancelled) {
        window.__pwaUpdateAvailable = true
        setUpdateAvailable(true)
      }
    })
    return () => { cancelled = true }
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

      // Treat the update as available if either onNeedRefresh fired during the
      // wait OR a worker is already sitting in reg.waiting (downloaded earlier,
      // e.g. before a reload, so the in-memory flag never got set). Without the
      // reg.waiting check, a pending update reports "Already up to date" and
      // can never be applied (issue #57).
      const updateReady = window.__pwaUpdateAvailable || await hasWaitingUpdate()

      if (!updateReady) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3000)
      } else {
        // An update is ready. Surface it and clear the 'checking' status so the
        // button re-enables — otherwise it stays disabled/greyed out and the
        // user can't tap again to apply the update.
        window.__pwaUpdateAvailable = true
        setUpdateAvailable(true)
        setUpdateStatus(null)
      }
    } catch {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 3000)
    }
  }

  const handleInstall = async () => {
    await promptInstall()
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
        { key: 'accentColor',           value: '#1f6feb' },
        { key: 'hapticFeedback',        value: true  },
        { key: 'remindersEnabled',          value: false   },
        { key: 'remindLongRunning',         value: true    },
        { key: 'remindLongRunningMinutes',  value: 60      },
        { key: 'remindIdle',                value: false   },
        { key: 'remindIdleTime',            value: '09:00' },
        { key: 'remindStillRunning',        value: false   },
        { key: 'remindStillRunningTime',    value: '17:00' },
        { key: 'remindTimesheetDaily',      value: false   },
        { key: 'remindTimesheetDailyTime',  value: '17:00' },
        { key: 'remindTimesheetWeekly',     value: false   },
        { key: 'remindTimesheetWeeklyDay',  value: 5       },
        { key: 'remindTimesheetWeeklyTime', value: '16:00' },
        { key: 'syncProvider',          value: null },
        { key: 'syncToken',             value: null },
        { key: 'syncTokenExpiry',       value: null },
        { key: 'syncFileId',            value: null },
        { key: 'lastSyncedAt',          value: null },
        { key: 'syncError',             value: null },
        { key: 'syncUsername',          value: null },
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
    await disconnectSync()
    setShowDisconnectConfirm(false)
  }

  // Turning reminders on requests notification permission first; we only flip
  // the setting if the user grants it, so an enabled toggle always means alerts
  // can actually be shown (issue #54).
  const handleRemindersToggle = async (on) => {
    if (!on) {
      await updateSetting('remindersEnabled', false)
      return
    }
    const perm = await requestNotificationPermission()
    setNotifPerm(perm)
    await updateSetting('remindersEnabled', perm === 'granted')
  }

  const notifSupported = notificationsSupported()
  const remindersOn = !!settings.remindersEnabled && notifPerm === 'granted'

  const tokenExpired = syncSettings?.syncTokenExpiry && Date.now() > syncSettings.syncTokenExpiry

  // Haptics only fire on phones (iPhone via the Taptic polyfill, Android via
  // vibrate). iPads have no vibration motor and desktop has none, so hide the
  // toggle there.
  const canHaptic = os === 'android' || (os === 'ios' && !isIPad)

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-3 lg:max-w-2xl lg:mx-auto lg:w-full">

      {/* General — concurrent timers, week start, and (on phones) haptics live
          together so they aren't lonely one-item categories (issue #60) */}
      <AccordionSection
        title="General"
        icon={SlidersHorizontal}
        open={openSection === 'general'}
        onToggle={() => toggleSection('general')}
      >
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
          {canHaptic && (
            <SettingsRow
              icon={Vibrate}
              title="Haptic feedback"
              subtitle="Vibrate on key actions and navigation"
              right={
                <Toggle
                  ariaLabel="Haptic feedback"
                  value={settings.hapticFeedback !== false}
                  onChange={v => updateSetting('hapticFeedback', v)}
                />
              }
            />
          )}
        </div>
      </AccordionSection>

      {/* Appearance */}
      <AccordionSection
        title="Appearance"
        icon={Palette}
        open={openSection === 'appearance'}
        onToggle={() => toggleSection('appearance')}
      >
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
      </AccordionSection>

      {/* Reminders — local notifications (no backend); only deliver while the
          app is open or installed (issue #54) */}
      <AccordionSection
        title="Reminders"
        icon={Bell}
        badge={remindersOn}
        open={openSection === 'reminders'}
        onToggle={() => toggleSection('reminders')}
      >
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          {!notifSupported ? (
            <div className="px-4 py-4">
              <p className="text-sm text-appText font-medium">Reminders aren't available here</p>
              <p className="text-xs text-appTextMuted mt-0.5">
                This browser doesn't support notifications. On iPhone or iPad, add PunchIn to your
                Home Screen first, then reminders become available.
              </p>
            </div>
          ) : (
            <>
              <SettingsRow
                icon={Bell}
                title="Reminders"
                subtitle="Alerts fire while PunchIn is open or installed — keep it on your Home Screen for the most reliable nudges"
                right={
                  <Toggle
                    ariaLabel="Enable reminders"
                    value={remindersOn}
                    onChange={handleRemindersToggle}
                  />
                }
              />

              {notifPerm === 'denied' && (
                <div className="px-4 py-3 bg-red-500/5">
                  <p className="text-xs text-red-400">
                    Notifications are blocked. Allow notifications for PunchIn in your browser or
                    device settings, then turn reminders on again.
                  </p>
                </div>
              )}

              {remindersOn && (
                <>
                  <ReminderRow
                    icon={Hourglass}
                    title="Long-running timer"
                    subtitle="If a timer runs longer than your chosen time"
                    enabled={settings.remindLongRunning !== false}
                    onToggle={v => updateSetting('remindLongRunning', v)}
                  >
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      Notify after
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={settings.remindLongRunningMinutes ?? 60}
                        onChange={e => updateSetting('remindLongRunningMinutes', Math.min(1440, Math.max(1, Number(e.target.value) || 60)))}
                        aria-label="Minutes before a long-running timer reminder"
                        className={`${reminderInputClass} w-16`}
                      />
                      minutes
                    </label>
                  </ReminderRow>

                  <ReminderRow
                    icon={AlarmClock}
                    title="No timer running"
                    subtitle="If nothing is tracking by a time of day"
                    enabled={!!settings.remindIdle}
                    onToggle={v => updateSetting('remindIdle', v)}
                  >
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      At
                      <input
                        type="time"
                        value={settings.remindIdleTime || '09:00'}
                        onChange={e => updateSetting('remindIdleTime', e.target.value)}
                        aria-label="No-timer reminder time"
                        className={reminderInputClass}
                      />
                    </label>
                  </ReminderRow>

                  <ReminderRow
                    icon={CalendarClock}
                    title="Timer still running"
                    subtitle="If a timer is still going at a time of day"
                    enabled={!!settings.remindStillRunning}
                    onToggle={v => updateSetting('remindStillRunning', v)}
                  >
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      At
                      <input
                        type="time"
                        value={settings.remindStillRunningTime || '17:00'}
                        onChange={e => updateSetting('remindStillRunningTime', e.target.value)}
                        aria-label="Still-running reminder time"
                        className={reminderInputClass}
                      />
                    </label>
                  </ReminderRow>

                  <ReminderRow
                    icon={CalendarCheck}
                    title="Daily timesheet"
                    subtitle="A nudge to review today's hours"
                    enabled={!!settings.remindTimesheetDaily}
                    onToggle={v => updateSetting('remindTimesheetDaily', v)}
                  >
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      At
                      <input
                        type="time"
                        value={settings.remindTimesheetDailyTime || '17:00'}
                        onChange={e => updateSetting('remindTimesheetDailyTime', e.target.value)}
                        aria-label="Daily timesheet reminder time"
                        className={reminderInputClass}
                      />
                    </label>
                  </ReminderRow>

                  <ReminderRow
                    icon={CalendarCheck}
                    title="Weekly timesheet"
                    subtitle="A weekly nudge to submit your hours"
                    enabled={!!settings.remindTimesheetWeekly}
                    onToggle={v => updateSetting('remindTimesheetWeekly', v)}
                  >
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      On
                      <select
                        value={settings.remindTimesheetWeeklyDay ?? 5}
                        onChange={e => updateSetting('remindTimesheetWeeklyDay', Number(e.target.value))}
                        aria-label="Weekly timesheet reminder day"
                        className={reminderInputClass}
                      >
                        {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-appTextMuted">
                      at
                      <input
                        type="time"
                        value={settings.remindTimesheetWeeklyTime || '16:00'}
                        onChange={e => updateSetting('remindTimesheetWeeklyTime', e.target.value)}
                        aria-label="Weekly timesheet reminder time"
                        className={reminderInputClass}
                      />
                    </label>
                  </ReminderRow>
                </>
              )}
            </>
          )}
        </div>
      </AccordionSection>

      {/* Install — behaviour adapts to the platform's install capabilities */}
      {(isInstalled || canInstall || isIOS) && (
        <AccordionSection
          title="Install"
          icon={MonitorDown}
          open={openSection === 'install'}
          onToggle={() => toggleSection('install')}
        >
          <div className="rounded-xl border border-appBorder bg-appCard overflow-hidden">
            {isInstalled ? (
              <SettingsRow
                icon={Check}
                title="Installed"
                subtitle="PunchIn is installed on this device"
              />
            ) : canInstall ? (
              <button
                onClick={handleInstall}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left rounded-xl">
                <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm text-appText font-medium">{installOs === 'android' ? 'Add to Home Screen' : 'Install app'}</p>
                  <p className="text-xs text-appTextMuted mt-0.5">Install as a standalone app for faster access</p>
                </div>
              </button>
            ) : isIOSSafari ? (
              <>
                <button
                  onClick={() => setIosHelpOpen(o => !o)}
                  aria-expanded={iosHelpOpen}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left">
                  <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-appText font-medium">Add to Home Screen</p>
                    <p className="text-xs text-appTextMuted mt-0.5">Install as a standalone app for faster access</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-appTextMuted flex-shrink-0 transition-transform ${iosHelpOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {iosHelpOpen && (
                  <div className="px-4 pb-4 -mt-1 space-y-2.5 text-sm text-appText">
                    <p className="text-xs text-appTextMuted">From Safari, install in two steps:</p>
                    <p className="flex items-center gap-3">
                      <Share className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                      <span>Tap the <span className="font-semibold">Share</span> button</span>
                    </p>
                    <p className="flex items-center gap-3">
                      <Plus className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                      <span>Choose <span className="font-semibold">Add to Home Screen</span></span>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setIosHelpOpen(o => !o)}
                  aria-expanded={iosHelpOpen}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left">
                  <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-appText font-medium">Add to Home Screen</p>
                    <p className="text-xs text-appTextMuted mt-0.5">Open in Safari to install</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-appTextMuted flex-shrink-0 transition-transform ${iosHelpOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {iosHelpOpen && (
                  <div className="px-4 pb-4 -mt-1 space-y-2.5 text-sm text-appText">
                    <p className="text-xs text-appTextMuted">Only Safari can install web apps on iOS.</p>
                    <p className="flex items-center gap-3">
                      <Compass className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                      <span>Open <span className="font-semibold">trackmytime.today</span> in Safari</span>
                    </p>
                    <p className="flex items-center gap-3">
                      <Share className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                      <span>Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span></span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </AccordionSection>
      )}

      {/* Data */}
      <AccordionSection
        title="Data"
        icon={Database}
        open={openSection === 'data'}
        onToggle={() => toggleSection('data')}
      >
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
      </AccordionSection>

      {/* Sync */}
      <AccordionSection
        title="Sync"
        icon={Cloud}
        open={openSection === 'sync'}
        onToggle={() => toggleSection('sync')}
      >
        <div className="rounded-xl border border-appBorder bg-appCard overflow-hidden">
          {syncSettings?.syncProvider ? (
            <>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-appBorderLight">
                <Cloud className={`w-4 h-4 flex-shrink-0 ${tokenExpired ? 'text-red-400' : 'text-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-appText font-medium">
                      {PROVIDER_LABEL[syncSettings.syncProvider] ?? syncSettings.syncProvider}
                    </p>
                    {tokenExpired ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 uppercase tracking-wide">
                        Reconnect
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                        <Check className="w-3 h-3" aria-hidden="true" /> Connected
                      </span>
                    )}
                  </div>
                  {syncSettings.syncUsername && (
                    <p className="text-xs text-appTextMuted mt-0.5">@{syncSettings.syncUsername}</p>
                  )}
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
                  onClick={() => setShowDisconnectConfirm(true)}
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
                  <div className="px-1 space-y-1">
                    <p className="text-sm text-appText font-medium">Sync isn’t set up on this version</p>
                    <p className="text-xs text-appTextMuted">
                      Cloud sync hasn’t been configured for this deployment. Your data stays safe on this
                      device — use <span className="text-appText">Export data</span> above to back it up or move
                      it to another device.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </AccordionSection>

      {/* Transfer — account-free device-to-device data move via link + QR (issue #77) */}
      <AccordionSection
        title="Transfer"
        icon={Share2}
        open={openSection === 'transfer'}
        onToggle={() => toggleSection('transfer')}
      >
        <DataTransfer />
      </AccordionSection>

      {/* Danger Zone */}
      <AccordionSection
        title="Danger Zone"
        icon={AlertTriangle}
        danger
        open={openSection === 'danger'}
        onToggle={() => toggleSection('danger')}
      >
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
      </AccordionSection>

      {/* About */}
      <AccordionSection
        title="About"
        icon={Info}
        badge={updateAvailable}
        open={openSection === 'about'}
        onToggle={() => toggleSection('about')}
      >
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
      </AccordionSection>

      {showClearConfirm && (
        <ConfirmModal
          title="Clear all time entries?"
          message="Jobs and labor types are kept. This cannot be undone."
          confirmLabel="Clear entries"
          onConfirm={clearEntries}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {showDisconnectConfirm && (
        <ConfirmModal
          title="Disconnect sync?"
          message="Your local data is kept on this device. You can reconnect any time."
          confirmLabel="Disconnect"
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  )
}
