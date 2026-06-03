import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from './components/Layout'
import ErrorBoundary  from './components/ErrorBoundary'
import InstallPromptModal from './components/InstallPromptModal'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import AnalyticsView  from './views/AnalyticsView'
import SettingsView   from './views/SettingsView'
import { useSettings } from './hooks/useSettings'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { updateFavicon } from './utils/favicon'
import { db } from './db'

// localStorage keys for the first-run install nudge. Kept out of the Dexie
// data model so a factory reset doesn't wipe (or re-trigger) them.
const INSTALL_DISMISSED_KEY = 'pi.installNudgeDismissed'
const OPEN_COUNT_KEY        = 'pi.opens'
// Show the nudge once the user has opened the app at least this many times —
// after they've seen some value, which converts far better than a cold first paint.
const NUDGE_MIN_OPENS = 2

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

const DEFAULT_VIEW = 'timer'

export default function App() {
  const [activeView, setActiveView] = useState(DEFAULT_VIEW)
  const { settings } = useSettings()

  // Track the live view for the navigate callback without re-creating it.
  const activeViewRef = useRef(activeView)
  useEffect(() => { activeViewRef.current = activeView }, [activeView])

  // Hardware/gesture Back navigates between tabs instead of leaving the app.
  // Each tab change pushes a history entry tagged with the view; popstate
  // restores it. Modals manage their own {modal:true} entries on top of these,
  // so closing a modal with Back pops to the same view (a harmless no-op here).
  const navigate = useCallback((view) => {
    if (view === activeViewRef.current) return
    history.pushState({ piView: view }, '')
    setActiveView(view)
  }, [])

  useEffect(() => {
    if (!history.state?.piView) {
      history.replaceState({ piView: DEFAULT_VIEW }, '')
    }
    const onPop = (e) => {
      const view = e.state?.piView
      if (view) setActiveView(view)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const theme       = settings.theme       || 'auto'
  const accentColor = settings.accentColor || '#1f6feb'

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = e => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = window.document.documentElement
    if (resolvedTheme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accentColor))
    updateFavicon(accentColor)
  }, [accentColor])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'light' ? '#F3F4F6' : '#0F1117')
  }, [resolvedTheme])

  // Handle OAuth callback tokens written into the URL hash by the provider
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return
    const params = new URLSearchParams(hash.slice(1))

    if (params.has('sync_error')) {
      history.replaceState({ piView: DEFAULT_VIEW }, '', window.location.pathname + window.location.search)
      db.settings.put({ key: 'syncError', value: params.get('sync_error') })
      return
    }

    // GitHub: token comes via our Cloudflare Worker callback
    if (params.has('sync_token') && params.get('sync_provider') === 'github') {
      const token = params.get('sync_token')
      db.settings.bulkPut([
        { key: 'syncProvider', value: 'github' },
        { key: 'syncToken', value: token },
        { key: 'syncTokenExpiry', value: null },
        { key: 'syncFileId', value: null },
        { key: 'syncError', value: null },
      ]).then(() => {
        history.replaceState({ piView: DEFAULT_VIEW }, '', window.location.pathname + window.location.search)
      })
      return
    }

    // Google / OneDrive: token comes via implicit flow, provider passed as `state`
    if (params.has('access_token') && params.has('state')) {
      const provider = params.get('state')
      if (provider !== 'google' && provider !== 'onedrive') return
      const token = params.get('access_token')
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10) * 1000
      db.settings.bulkPut([
        { key: 'syncProvider', value: provider },
        { key: 'syncToken', value: token },
        { key: 'syncTokenExpiry', value: Date.now() + expiresIn },
        { key: 'syncFileId', value: null },
        { key: 'syncError', value: null },
      ]).then(() => {
        history.replaceState({ piView: DEFAULT_VIEW }, '', window.location.pathname + window.location.search)
      })
    }
  }, [])

  // --- First-run install nudge -------------------------------------------
  const { canInstall, isIOS, isIOSSafari, isInstalled, os, promptInstall } = useInstallPrompt()
  const [showInstall, setShowInstall] = useState(false)

  // What kind of install guidance applies, or null if none is possible here.
  const installMode = canInstall ? 'native'
    : isIOSSafari ? 'ios-safari'
    : isIOS ? 'ios-other'
    : null

  // Count app opens once per mount.
  useEffect(() => {
    try {
      const opens = Number(localStorage.getItem(OPEN_COUNT_KEY) || '0') + 1
      localStorage.setItem(OPEN_COUNT_KEY, String(opens))
    } catch { /* storage unavailable (private mode); skip the nudge gracefully */ }
  }, [])

  // Decide whether to surface the nudge. Re-runs when installMode resolves
  // (beforeinstallprompt can fire shortly after load). The auto-nudge is
  // mobile-only — on desktop the Settings install entry is enough, popping a
  // sheet there is pushier than it's worth.
  useEffect(() => {
    if (isInstalled) return
    if (os !== 'ios' && os !== 'android') return
    if (!installMode) return
    let opens = 0
    try {
      if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return
      opens = Number(localStorage.getItem(OPEN_COUNT_KEY) || '0')
    } catch { return }
    if (opens < NUDGE_MIN_OPENS) return
    setShowInstall(true)
  }, [installMode, isInstalled, os])

  const dismissInstall = () => {
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1') } catch { /* ignore */ }
    setShowInstall(false)
  }

  const handleInstall = async () => {
    await promptInstall()
    dismissInstall()
  }

  const views = {
    timer:      <TimerView />,
    jobs:       <JobsView />,
    timesheets: <TimesheetsView />,
    analytics:  <AnalyticsView />,
    settings:   <SettingsView />,
  }

  return (
    <Layout activeView={activeView} onNavigate={navigate}>
      <ErrorBoundary key={activeView}>
        {views[activeView]}
      </ErrorBoundary>
      {showInstall && installMode && (
        <InstallPromptModal
          mode={installMode}
          onInstall={handleInstall}
          onClose={dismissInstall}
        />
      )}
    </Layout>
  )
}
