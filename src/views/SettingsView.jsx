import { useState, useEffect } from 'react'
import { SlidersHorizontal, Palette, Bell, MonitorDown, Database, Info, Receipt } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { usePwaUpdate } from '../hooks/usePwaUpdate'
import { notificationPermission } from '../utils/notifications'
import { CategoryRow } from './settings/components'
import GeneralPanel from './settings/GeneralPanel'
import AppearancePanel from './settings/AppearancePanel'
import RemindersPanel from './settings/RemindersPanel'
import InstallPanel from './settings/InstallPanel'
import DataSyncPanel from './settings/DataSyncPanel'
import BillingPanel from './settings/BillingPanel'
import AboutPanel from './settings/AboutPanel'

// Thin router for the iOS-style drill-in Settings (issue #60): a root list of
// categories, each of which renders its own panel component (issue #144). The
// panels self-serve settings/platform/install via hooks; the two signals the
// root list also needs — the Reminders badge (notifPerm) and the About update
// badge (usePwaUpdate) — are owned here once and passed down so they stay a
// single source of truth.
export default function SettingsView() {
  const { settings } = useSettings()
  // Deep-link straight to About when an update is already waiting so the user
  // can act on it without hunting (the row also shows a dot — see badge below).
  const [activePanel, setActivePanel] = useState(() =>
    (typeof window !== 'undefined' && window.__pwaUpdateAvailable) ? 'about' : null
  )
  const [notifPerm, setNotifPerm] = useState(() => notificationPermission())
  const pwaUpdate = usePwaUpdate()
  const { canInstall, isInstalled, isIOS } = useInstallPrompt()

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

  const remindersOn = !!settings.remindersEnabled && notifPerm === 'granted'

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
          <CategoryRow icon={Receipt} title="Billing" subtitle="Invoice identity, currency, numbering" onClick={() => openPanel('billing')} />
          <CategoryRow icon={Database} title="Data & Sync" subtitle="Backup, sync, transfer, reset" onClick={() => openPanel('data')} />
          <CategoryRow icon={Info} title="About" subtitle={`v${__APP_VERSION__}`} badge={pwaUpdate.updateAvailable} onClick={() => openPanel('about')} />
        </div>
      )}

      {activePanel === 'general'    && <GeneralPanel onBack={closePanel} />}
      {activePanel === 'appearance' && <AppearancePanel onBack={closePanel} />}
      {activePanel === 'reminders'  && <RemindersPanel onBack={closePanel} notifPerm={notifPerm} setNotifPerm={setNotifPerm} />}
      {activePanel === 'install'    && <InstallPanel onBack={closePanel} />}
      {activePanel === 'billing'    && <BillingPanel onBack={closePanel} />}
      {activePanel === 'data'       && <DataSyncPanel onBack={closePanel} />}
      {activePanel === 'about'      && (
        <AboutPanel
          onBack={closePanel}
          updateAvailable={pwaUpdate.updateAvailable}
          updateStatus={pwaUpdate.updateStatus}
          checkForUpdates={pwaUpdate.checkForUpdates}
        />
      )}
    </div>
  )
}
