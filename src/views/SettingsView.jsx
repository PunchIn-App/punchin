import { useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ChangelogModal from '../components/ChangelogModal'
import LicenseModal from '../components/LicenseModal'
import ColorPicker from '../components/ColorPicker'
import DataTransfer from '../components/DataTransfer'
import { Download, Upload, Trash2, Layers, Calendar, Info, Sun, Moon, Monitor, RefreshCw, ExternalLink, ScrollText, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Palette, Bug, MonitorDown, Cloud, CloudOff, LogOut, Check, Share, Plus, Compass, Vibrate, SlidersHorizontal, Database, Bell, Hourglass, AlarmClock, CalendarClock, CalendarCheck, Share2, Lightbulb, Scale, Heart } from 'lucide-react'
import { notificationsSupported, notificationPermission, requestNotificationPermission } from '../utils/notifications'
import { buildBugReportUrl, buildFeatureRequestUrl } from '../utils/issueUrl'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { usePwaUpdate } from '../hooks/usePwaUpdate'
import { format } from 'date-fns'
import { db, defaultSettingsRows } from '../db'
import { useSettings } from '../hooks/useSettings'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { runSync, disconnectSync, importSnapshot } from '../sync/syncManager'
import { buildGitHubOAuthUrl } from '../sync/providers/github'
import { buildGoogleOAuthUrl } from '../sync/providers/google'
import { buildOneDriveOAuthUrl } from '../sync/providers/onedrive'
import { createOAuthState } from '../sync/oauthState'
import { createPkceChallenge } from '../sync/pkce'
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
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const reminderInputClass = 'bg-appBg border border-appBorder text-appText rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

// Seven toggle chips (Sun–Sat) letting a time-of-day reminder fire only on the
// chosen weekdays. `value` is an array of weekday numbers (0=Sun … 6=Sat);
// undefined is treated as every day so pre-existing reminders are unaffected.
function WeekdayPicker({ value, onChange, label }) {
  const days = Array.isArray(value) ? value : ALL_DAYS
  const toggle = (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b)
    onChange(next)
  }
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {WEEKDAY_INITIALS.map((initial, d) => {
        const on = days.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={on}
            aria-label={WEEKDAYS[d]}
            className={`w-7 h-7 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-appAccent/50
              ${on ? 'bg-appAccent text-[#0F1117]' : 'bg-appBg text-appText border border-appBorder hover:bg-appInput'}`}
          >
            {initial}
          </button>
        )
      })}
    </div>
  )
}

// A tappable category row on the Settings root list. Drilling in shows that
// category's own sub-page (iOS-style master → detail), replacing the former
// single-open accordion so nothing collapses underfoot (issue #60).
function CategoryRow({ icon: Icon, title, subtitle, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
    >
      <span className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-5 h-5 flex-shrink-0 text-appTextMuted" aria-hidden="true" />}
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-appText">{title}</span>
            {badge && <span className="w-2 h-2 rounded-full bg-appAccent flex-shrink-0" aria-hidden="true" />}
          </span>
          {subtitle && <span className="block text-xs text-appTextMuted mt-0.5">{subtitle}</span>}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-appTextMuted" aria-hidden="true" />
    </button>
  )
}

// A drilled-in sub-page: an iOS-style back affordance ("‹ Settings") plus the
// category title, then the section's content. The Back button unwinds the
// pushed history entry so the hardware/gesture Back gesture composes with it.
function Panel({ title, onBack, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 -ml-1.5 pr-2 py-1 rounded-lg text-appAccent text-sm font-medium hover:bg-appInput transition-colors"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          Settings
        </button>
      </div>
      <h2 className="text-xl font-display font-semibold text-appText mb-3 px-1">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// A labelled group within a sub-page (used inside Data &amp; Sync to keep
// Backup / Sync / Transfer / Danger Zone visually distinct).
function PanelGroup({ title, danger, children }) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide px-1 mb-2 ${danger ? 'text-red-400' : 'text-appTextMuted'}`}>{title}</h3>
      {children}
    </div>
  )
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
  // iOS-style drill-in: which category sub-page is open (null = root list).
  // Deep-link straight to About when an update is already waiting so the user
  // can act on it without hunting (the row also shows a dot — see badge below).
  const [activePanel, setActivePanel] = useState(() =>
    (typeof window !== 'undefined' && window.__pwaUpdateAvailable) ? 'about' : null
  )
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showLicense, setShowLicense] = useState(false)
  // PWA update state + check action live in usePwaUpdate (issue #149).
  const { updateAvailable, updateStatus, checkForUpdates } = usePwaUpdate()
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [notifPerm, setNotifPerm] = useState(() => notificationPermission())
  const { canInstall, isInstalled, isIOS, isIOSSafari, os: installOs, promptInstall } = useInstallPrompt()

  // Open a category sub-page. Push a history entry (mirroring the modal pattern)
  // so the hardware/gesture Back closes the panel instead of switching tabs;
  // App.jsx's popstate handler ignores states without `piView`, so this composes.
  const openPanel = (id) => {
    history.pushState({ settingsPanel: id }, '')
    setActivePanel(id)
  }
  const closePanel = () => {
    if (history.state?.settingsPanel) history.back()
    else setActivePanel(null)
  }

  useEffect(() => {
    const onPop = (e) => setActivePanel(e.state?.settingsPanel ?? null)
    window.addEventListener('popstate', onPop)
    // If we deep-linked straight into a panel (update waiting), push a matching
    // entry once on mount so Back returns to the root list, not another tab.
    if (typeof window !== 'undefined' && window.__pwaUpdateAvailable && history.state?.settingsPanel !== 'about') {
      history.pushState({ settingsPanel: 'about' }, '')
    }
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-tapping the Settings tab in the bottom nav returns to the root list,
  // matching the hardware Back gesture (App.jsx dispatches this on re-select).
  useEffect(() => {
    const onReselect = (e) => {
      if (e.detail !== 'settings') return
      if (history.state?.settingsPanel) history.back()
      else setActivePanel(null)
    }
    window.addEventListener('pi:reselect-tab', onReselect)
    return () => window.removeEventListener('pi:reselect-tab', onReselect)
  }, [])

  // Reset the multi-stage factory-reset flow whenever we leave the Data & Sync
  // page (which now hosts the Danger Zone), so re-opening always starts neutral.
  useEffect(() => {
    if (activePanel !== 'data') setResetStage(null)
  }, [activePanel])

  const syncSettings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
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

      // Reuse the cloud-sync merge instead of a second hand-rolled dedup: same
      // {version,jobs,entries,laborTypes} shape, and a single place to maintain
      // the uuid/name matching, tombstones and last-write-wins (issue #145).
      const importedCount = await importSnapshot(data)
      alert(`Import successful!\nRestored: ${importedCount} new time entries.`)
    } catch (err) {
      console.error(err)
      alert('Error importing data: ' + err.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    // Tear down sync first, while the credentials still exist: disconnectSync
    // deletes this device's remote file (punchin-data-{deviceId}.json) before
    // clearing creds. Without it a "wipe everything" leaves the file orphaned in
    // the gist, and since pi.deviceId survives, reconnecting reuses the filename
    // and merges the old data back in — defeating the erase (issue #143).
    await disconnectSync()
    await db.transaction('rw', [db.entries, db.jobs, db.laborTypes, db.settings, db.deletions, db.secrets], async () => {
      await db.entries.clear()
      await db.jobs.clear()
      await db.laborTypes.clear()
      await db.deletions.clear()
      await db.secrets.clear() // wipe the encrypted sync token + key (issue #126)
      await db.settings.clear()
      await db.settings.bulkPut(defaultSettingsRows()) // single source of truth (issue #131)
    })
    // Clear app-local storage the DB wipe doesn't reach (issue #143). pi.deviceId
    // is kept intentionally so re-enabling sync keeps this device's identity.
    try {
      localStorage.removeItem('pi.reminderState')
      localStorage.removeItem('pi.opens')
      localStorage.removeItem('pi.installNudgeDismissed')
    } catch { /* storage unavailable (private mode) — nothing to clear */ }
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

  // Writing a reminder's chosen weekdays. Clearing the last day reads as "I
  // don't want this reminder" — so instead of saving an empty (never-fires) set,
  // switch the reminder off and restore all days for a clean re-enable later.
  const setReminderDays = (enabledKey, daysKey, days) => {
    if (days.length === 0) {
      updateSetting(enabledKey, false)
      updateSetting(daysKey, ALL_DAYS)
    } else {
      updateSetting(daysKey, days)
    }
  }

  const notifSupported = notificationsSupported()
  const remindersOn = !!settings.remindersEnabled && notifPerm === 'granted'

  const tokenExpired =
    (syncSettings?.syncTokenExpiry && Date.now() > syncSettings.syncTokenExpiry) ||
    syncSettings?.syncError === 'TOKEN_EXPIRED'

  // Haptics only fire on phones (iPhone via the Taptic polyfill, Android via
  // vibrate). iPads have no vibration motor and desktop has none, so hide the
  // toggle there.
  const canHaptic = os === 'android' || (os === 'ios' && !isIPad)

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-3 lg:max-w-2xl lg:mx-auto lg:w-full">

      {/* Root list — tap a category to drill into its sub-page (issue #60) */}
      {activePanel === null && (
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
          <CategoryRow icon={SlidersHorizontal} title="General" subtitle="Timers, week start, haptics" onClick={() => openPanel('general')} />
          <CategoryRow icon={Palette} title="Appearance" subtitle="Theme and accent color" onClick={() => openPanel('appearance')} />
          <CategoryRow icon={Bell} title="Reminders" subtitle="Local notification nudges" badge={remindersOn} onClick={() => openPanel('reminders')} />
          {(isInstalled || canInstall || isIOS) && (
            <CategoryRow icon={MonitorDown} title="Install" subtitle="Add PunchIn to your device" onClick={() => openPanel('install')} />
          )}
          <CategoryRow icon={Database} title="Data & Sync" subtitle="Backup, sync, transfer, reset" onClick={() => openPanel('data')} />
          <CategoryRow icon={Info} title="About" subtitle={`v${__APP_VERSION__}`} badge={updateAvailable} onClick={() => openPanel('about')} />
        </div>
      )}

      {/* General — concurrent timers, week start, and (on phones) haptics */}
      {activePanel === 'general' && (
        <Panel title="General" onBack={closePanel}>
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
        </Panel>
      )}

      {/* Appearance */}
      {activePanel === 'appearance' && (
        <Panel title="Appearance" onBack={closePanel}>
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
        </Panel>
      )}

      {/* Reminders — local notifications (no backend); only deliver while the
          app is open or installed (issue #54) */}
      {activePanel === 'reminders' && (
        <Panel title="Reminders" onBack={closePanel}>
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
                    <WeekdayPicker
                      value={settings.remindIdleDays}
                      onChange={days => setReminderDays('remindIdle', 'remindIdleDays', days)}
                      label="Days for the no-timer reminder"
                    />
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
                    <WeekdayPicker
                      value={settings.remindStillRunningDays}
                      onChange={days => setReminderDays('remindStillRunning', 'remindStillRunningDays', days)}
                      label="Days for the still-running reminder"
                    />
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
                    <WeekdayPicker
                      value={settings.remindTimesheetDailyDays}
                      onChange={days => setReminderDays('remindTimesheetDaily', 'remindTimesheetDailyDays', days)}
                      label="Days for the daily timesheet reminder"
                    />
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
        </Panel>
      )}

      {/* Install — behaviour adapts to the platform's install capabilities;
          only reachable when the root list offered the row */}
      {activePanel === 'install' && (
        <Panel title="Install" onBack={closePanel}>
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
        </Panel>
      )}

      {/* Data & Sync — Backup, Sync, Transfer, and Danger Zone consolidated into
          one page since they all govern where your data lives (issue #60) */}
      {activePanel === 'data' && (
        <Panel title="Data & Sync" onBack={closePanel}>
        <PanelGroup title="Backup">
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
        </PanelGroup>

        {/* Sync */}
        <PanelGroup title="Sync">
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
                    onClick={() => { window.location.href = buildGitHubOAuthUrl(SYNC_CONFIG.github.clientId, SYNC_CONFIG.github.callbackBase, createOAuthState()) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-left"
                  >
                    <Cloud className="w-4 h-4 text-appTextMuted flex-shrink-0" />
                    <div>
                      <p className="text-sm text-appText font-medium">GitHub Gist</p>
                      <p className="text-xs text-appTextMuted">Private gist in your GitHub account</p>
                    </div>
                  </button>
                )}
                {SYNC_CONFIG.google.clientId && (
                  <button
                    onClick={() => { window.location.href = buildGoogleOAuthUrl(SYNC_CONFIG.google.clientId, createOAuthState()) }}
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
                    onClick={async () => { window.location.href = buildOneDriveOAuthUrl(SYNC_CONFIG.onedrive.clientId, createOAuthState(), await createPkceChallenge()) }}
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
        </PanelGroup>

        {/* Transfer — account-free device-to-device move via link + QR (issue #77) */}
        <PanelGroup title="Transfer">
        <DataTransfer />
        </PanelGroup>

        {/* Danger Zone */}
        <PanelGroup title="Danger Zone" danger>
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
        </PanelGroup>
        </Panel>
      )}

      {/* About */}
      {activePanel === 'about' && (
        <Panel title="About" onBack={closePanel}>
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
            onClick={() => window.open(buildFeatureRequestUrl(__APP_VERSION__), '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
            <div className="flex items-center gap-3 min-w-0">
              <Lightbulb className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">Help improve PunchIn</p>
                <p className="text-xs text-appTextMuted mt-0.5">Suggest a feature — opens a GitHub feature request</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          </button>
          <button
            onClick={() => setShowLicense(true)}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
            <div className="flex items-center gap-3 min-w-0">
              <Scale className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-appText font-medium">License &amp; legal</p>
                <p className="text-xs text-appTextMuted mt-0.5">App license and third-party attributions</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-appTextMuted flex-shrink-0 -rotate-90" aria-hidden="true" />
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

        {/* Support — links out to Buy Me a Coffee (no third-party script: a plain
            link keeps the app self-contained and tracker-free). Styled with the
            user's accent so it follows their theme. */}
        <a
          href="https://www.buymeacoffee.com/PunchIn-App"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-appAccent text-[#0F1117] font-display font-bold text-sm hover:brightness-110 active:brightness-90 transition-all focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
        >
          <Heart className="w-4 h-4" aria-hidden="true" />
          Support the App
          <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
        </a>
        </Panel>
      )}

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
      {showLicense && <LicenseModal onClose={() => setShowLicense(false)} />}
    </div>
  )
}
