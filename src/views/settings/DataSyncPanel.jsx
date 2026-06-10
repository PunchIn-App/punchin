import { useState, useRef } from 'react'
import { Download, Upload, Trash2, AlertTriangle, Cloud, CloudOff, RefreshCw, LogOut, Check, ChevronRight } from 'lucide-react'
import { db, defaultSettingsRows } from '../../db'
import { useSettings } from '../../hooks/useSettings'
import { runSync, disconnectSync, importSnapshot } from '../../sync/syncManager'
import { buildGitHubOAuthUrl } from '../../sync/providers/github'
import { buildGoogleOAuthUrl } from '../../sync/providers/google'
import { buildOneDriveOAuthUrl } from '../../sync/providers/onedrive'
import { createOAuthState } from '../../sync/oauthState'
import { SYNC_CONFIG } from '../../sync/config'
import { exportBackup, exportCsv } from '../../utils/backup'
import ConfirmModal from '../../components/ConfirmModal'
import DataTransfer from '../../components/DataTransfer'
import { Panel, PanelGroup, DangerZone, Toggle } from './components'

const PROVIDER_LABEL = { github: 'GitHub Gist', google: 'Google Drive', onedrive: 'OneDrive' }

function formatLastSync(ts) {
  if (!ts) return 'Never synced'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function DataSyncPanel({ onBack }) {
  const { settings, updateSetting } = useSettings()
  const fileInputRef = useRef(null)
  // Local to the panel: it unmounts when you leave Data & Sync, so the multi-
  // stage reset flow always re-opens neutral with no extra effect needed.
  const [resetStage, setResetStage] = useState(null) // null | 'warn' | 'final'
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Sync fields come from the same useSettings() object as everything else (#147).
  // "Reconnect" reflects ONLY a real failure to refresh (issue #243): a lapsed
  // access-token expiry is now recovered silently in the background, so it must
  // not show as expired or disable Sync Now — only syncError === 'TOKEN_EXPIRED'
  // (a dead/absent refresh token) means the user truly needs to reconnect.
  const tokenExpired = settings.syncError === 'TOKEN_EXPIRED'

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

  return (
    <Panel title="Data & Sync" onBack={onBack}>
      <PanelGroup title="Backup">
      <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
        <button onClick={exportBackup}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left border-b border-appBorderLight">
          <Download className="w-4 h-4 text-appTextMuted flex-shrink-0" />
          <div>
            <p className="text-sm text-appText font-medium">Export data</p>
            <p className="text-xs text-appTextMuted mt-0.5">Download a JSON backup of everything</p>
          </div>
        </button>
        <button onClick={exportCsv}
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
        {settings.syncProvider ? (
          <>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-appBorderLight">
              <Cloud className={`w-4 h-4 flex-shrink-0 ${tokenExpired ? 'text-red-400' : 'text-green-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-appText font-medium">
                    {PROVIDER_LABEL[settings.syncProvider] ?? settings.syncProvider}
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
                {settings.syncUsername && (
                  <p className="text-xs text-appTextMuted mt-0.5">
                    {settings.syncProvider === 'github' ? '@' : ''}{settings.syncUsername}
                  </p>
                )}
                <p className="text-xs text-appTextMuted mt-0.5">
                  {tokenExpired
                    ? 'Token expired — reconnect to continue syncing'
                    : `Last synced: ${formatLastSync(settings.lastSyncedAt)}`}
                </p>
                {settings.syncError && !tokenExpired && (
                  <p className="text-xs text-red-400 mt-0.5 truncate">{settings.syncError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-appBorderLight">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-appText font-medium">Auto-sync</p>
                <p className="text-xs text-appTextMuted mt-0.5">Sync automatically on open, when you make changes, and periodically</p>
              </div>
              <Toggle value={settings.autoSync !== false} onChange={(v) => updateSetting('autoSync', v)} ariaLabel="Auto-sync" />
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
                  onClick={() => { window.location.href = buildGoogleOAuthUrl(SYNC_CONFIG.google.clientId, SYNC_CONFIG.google.callbackBase, createOAuthState()) }}
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
                  onClick={() => { window.location.href = buildOneDriveOAuthUrl(SYNC_CONFIG.onedrive.clientId, SYNC_CONFIG.onedrive.callbackBase, createOAuthState()) }}
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

      {/* Danger Zone — collapsed by default so destructive actions aren't a mis-tap away */}
      <DangerZone>
      <div className="rounded-xl border border-appBorder bg-appCard overflow-hidden">
        {/* Clear entries */}
        <button onClick={() => setShowClearConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left border-b border-appBorderLight">
          <span className="w-[34px] h-[34px] rounded-[9px] bg-appInput text-red-400 grid place-items-center flex-shrink-0">
            <Trash2 className="w-[18px] h-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-400">Clear time entries</p>
            <p className="text-xs text-appTextMuted mt-0.5">Permanent — jobs and types are kept</p>
          </div>
          <ChevronRight className="ml-auto w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
        </button>

        {resetStage === null && (
          <button
            onClick={() => setResetStage('warn')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left">
            <span className="w-[34px] h-[34px] rounded-[9px] bg-appInput text-red-400 grid place-items-center flex-shrink-0">
              <AlertTriangle className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-400">Factory Reset</p>
              <p className="text-xs text-appTextMuted mt-0.5">Erase all data and restore app to default state</p>
            </div>
            <ChevronRight className="ml-auto w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
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
      </DangerZone>

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
    </Panel>
  )
}
