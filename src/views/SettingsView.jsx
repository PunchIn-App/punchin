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
  // Desktop (lg+) shows a persistent category rail + detail pane (master-detail);
  // narrower viewports keep the iOS-style drill-in. jsdom's matchMedia stub
  // returns matches:false, so tests exercise the mobile path unchanged.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)')?.matches
  )
  const pwaUpdate = usePwaUpdate()
  const { canInstall, isInstalled, isIOS } = useInstallPrompt()

  // Open a category sub-page. Push a history entry (mirroring the modal pattern)
  // so the hardware/gesture Back closes the panel instead of switching tabs;
  // App.jsx's popstate handler ignores states without `piView`, so this composes.
  const openPanel = (id) => {
    // On the desktop master-detail there's no Back affordance — selecting a
    // category just swaps the detail pane, so don't push a history entry.
    if (isWide) { setActivePanel(id); return }
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

  // Track the lg breakpoint so the layout switches between drill-in and
  // master-detail live on resize (guarded for environments without matchMedia).
  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)')
    if (!mq) return
    const onChange = () => setIsWide(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const remindersOn = !!settings.remindersEnabled && notifPerm === 'granted'

  // Desktop detail pane defaults to General when nothing is drilled into; mobile
  // shows the root list (effectivePanel null) until the user picks a category.
  const effectivePanel = isWide ? (activePanel ?? 'general') : activePanel

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 lg:max-w-5xl lg:mx-auto lg:w-full">
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:items-start">

        {/* Category rail — the root list on mobile (tap to drill in, issue #60);
            a persistent selectable rail on desktop. Conditionally rendered (not
            CSS-hidden) so drilling in on mobile truly removes the root list.
            Kept a plain div, not a nav landmark, so it adds no third navigation
            region to the page. */}
        {(activePanel === null || isWide) && (
          <div className="lg:sticky lg:top-0">
            <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
              <CategoryRow icon={SlidersHorizontal} title="General" subtitle="Timers, week start, haptics" active={effectivePanel === 'general'} onClick={() => openPanel('general')} />
              <CategoryRow icon={Palette} title="Appearance" subtitle="Theme and accent color" active={effectivePanel === 'appearance'} onClick={() => openPanel('appearance')} />
              <CategoryRow icon={Bell} title="Reminders" subtitle="Local notification nudges" badge={remindersOn} active={effectivePanel === 'reminders'} onClick={() => openPanel('reminders')} />
              {(isInstalled || canInstall || isIOS) && (
                <CategoryRow icon={MonitorDown} title="Install" subtitle="Add PunchIn to your device" active={effectivePanel === 'install'} onClick={() => openPanel('install')} />
              )}
              <CategoryRow icon={Receipt} title="Billing" subtitle="Invoice identity, currency, numbering" active={effectivePanel === 'billing'} onClick={() => openPanel('billing')} />
              <CategoryRow icon={Database} title="Data & Sync" subtitle="Backup, sync, transfer, reset" active={effectivePanel === 'data'} onClick={() => openPanel('data')} />
              <CategoryRow icon={Info} title="About" subtitle={`v${__APP_VERSION__}`} badge={pwaUpdate.updateAvailable} active={effectivePanel === 'about'} onClick={() => openPanel('about')} />
            </div>
          </div>
        )}

        {/* Detail pane — the drilled-in sub-page on mobile; always visible on
            desktop (defaults to General via effectivePanel). */}
        {(activePanel !== null || isWide) && (
        <div>
          {effectivePanel === 'general'    && <GeneralPanel onBack={closePanel} />}
          {effectivePanel === 'appearance' && <AppearancePanel onBack={closePanel} />}
          {effectivePanel === 'reminders'  && <RemindersPanel onBack={closePanel} notifPerm={notifPerm} setNotifPerm={setNotifPerm} />}
          {effectivePanel === 'install'    && <InstallPanel onBack={closePanel} />}
          {effectivePanel === 'billing'    && <BillingPanel onBack={closePanel} />}
          {effectivePanel === 'data'       && <DataSyncPanel onBack={closePanel} />}
          {effectivePanel === 'about'      && (
            <AboutPanel
              onBack={closePanel}
              updateAvailable={pwaUpdate.updateAvailable}
              updateStatus={pwaUpdate.updateStatus}
              checkForUpdates={pwaUpdate.checkForUpdates}
            />
          )}
        </div>
        )}
      </div>
    </div>
  )
}
