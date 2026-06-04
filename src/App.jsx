import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from './components/Layout'
import ErrorBoundary  from './components/ErrorBoundary'
import InstallPromptModal from './components/InstallPromptModal'
import ConfirmModal from './components/ConfirmModal'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import AnalyticsView  from './views/AnalyticsView'
import SettingsView   from './views/SettingsView'
import { useSettings } from './hooks/useSettings'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useReminders } from './hooks/useReminders'
import { updateFavicon } from './utils/favicon'
import { decodeSnapshot } from './utils/transfer'
import { importSnapshot } from './sync/syncManager'
import { fetchGitHubUser } from './sync/providers/github'
import { db } from './db'

// localStorage keys for the first-run install nudge. Kept out of the Dexie
// data model so a factory reset doesn't wipe (or re-trigger) them.
const INSTALL_DISMISSED_KEY = 'pi.installNudgeDismissed'
const OPEN_COUNT_KEY        = 'pi.opens'
// Show the nudge once the user has opened the app at least this many times —
// after they've seen some value, which converts far better than a cold first paint.
const NUDGE_MIN_OPENS = 2

// Map OAuth callback error codes (which arrive in an attacker-influenceable URL
// fragment) to friendly, fixed messages. Unknown values fall back to a generic
// message, so a crafted `#sync_error=...` can't present arbitrary or misleading
// text in the Settings sync UI (issue #130).
const SYNC_ERROR_MESSAGES = {
  missing_code: 'Sign-in failed: no authorization code was returned.',
  server_error: 'Sign-in failed: the sign-in service had an error.',
  auth_failed:  'Sign-in failed: authorization was denied.',
}
export function describeSyncError(code) {
  return SYNC_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.'
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

const DEFAULT_VIEW = 'timer'

function GitHubAccountConfirm({ username, onConfirm, onDismiss }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.querySelector('[data-autofocus]')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { onDismiss(); return }
      if (e.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button') ?? [])
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => e.target === e.currentTarget && onDismiss()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gh-confirm-title"
        className="w-full max-w-sm bg-appCard rounded-2xl border border-appBorder shadow-xl p-5 space-y-4"
      >
        <div>
          <p id="gh-confirm-title" className="font-display font-semibold text-appText">
            Connect{username ? ` as @${username}` : ' GitHub account'}?
          </p>
          <p className="text-sm text-appTextMuted mt-1">
            {username
              ? `Your data will sync to a private gist owned by @${username}.`
              : 'Your data will sync to a private gist in this GitHub account.'
            }{' '}If this isn&apos;t the right account, tap Cancel, sign out of GitHub in your browser, then try connecting again.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-autofocus
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-appAccent hover:opacity-90 text-white font-semibold text-sm transition-opacity focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            Connect
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeView, setActiveView] = useState(DEFAULT_VIEW)
  const { settings } = useSettings()

  // Drive local reminder notifications (issue #54). No-op unless the user has
  // enabled reminders and granted notification permission.
  useReminders()

  // Track the live view for the navigate callback without re-creating it.
  const activeViewRef = useRef(activeView)
  useEffect(() => { activeViewRef.current = activeView }, [activeView])

  // Hardware/gesture Back navigates between tabs instead of leaving the app,
  // but the back stack is kept shallow: we keep at most one app-managed history
  // entry above the launch entry, no matter how many tabs the user visits.
  // Pressing Back from any non-default tab returns to the default view; Back
  // again exits the app. This stops the stack from growing without bound across
  // a long session (issue #80). Modals manage their own {modal:true} entries on
  // top of these and pop themselves, which composes cleanly with this scheme.
  const hasPushedRef = useRef(false)
  const navigate = useCallback((view) => {
    if (view === activeViewRef.current) {
      // Re-tapping the already-active tab lets a view reset its own internal
      // sub-state — Settings uses this to pop back to its root list from a
      // drilled-in sub-page (matching the hardware Back behaviour).
      window.dispatchEvent(new CustomEvent('pi:reselect-tab', { detail: view }))
      return
    }
    if (view === DEFAULT_VIEW) {
      // Returning home: unwind our single pushed entry so Back from home exits
      // the app. popstate restores the default view for us.
      if (hasPushedRef.current) {
        hasPushedRef.current = false
        history.back()
        return
      }
    } else if (hasPushedRef.current) {
      // Already on the pushed entry: swap views in place, don't grow the stack.
      history.replaceState({ piView: view }, '')
    } else {
      // First step away from home: push the single entry that captures Back.
      history.pushState({ piView: view }, '')
      hasPushedRef.current = true
    }
    setActiveView(view)
  }, [])

  useEffect(() => {
    if (!history.state?.piView) {
      history.replaceState({ piView: DEFAULT_VIEW }, '')
    }
    const onPop = (e) => {
      const view = e.state?.piView
      if (view) {
        setActiveView(view)
        // The launch entry is the default view; anything else is our pushed one.
        hasPushedRef.current = view !== DEFAULT_VIEW
      }
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

  // A snapshot shared from another device via a #import=… transfer link (issue
  // #77). Decoded asynchronously, then confirmed before merging since opening a
  // link shouldn't silently change the user's data.
  const [importPrompt, setImportPrompt] = useState(null) // { snapshot, jobs, entries }

  // GitHub OAuth: token is held here until the user confirms which account to
  // use (#83). We fetch the username before asking so the dialog can show it.
  // The token is never written to the DB until the user taps Connect.
  const [pendingGitHubAuth, setPendingGitHubAuth] = useState(null) // { token, username }

  const confirmGitHubConnect = useCallback(async () => {
    if (!pendingGitHubAuth) return
    await db.settings.bulkPut([
      { key: 'syncProvider', value: 'github' },
      { key: 'syncToken', value: pendingGitHubAuth.token },
      { key: 'syncTokenExpiry', value: null },
      { key: 'syncFileId', value: null },
      { key: 'syncError', value: null },
      { key: 'syncUsername', value: pendingGitHubAuth.username },
    ])
    setPendingGitHubAuth(null)
  }, [pendingGitHubAuth])

  const dismissGitHubConnect = useCallback(() => {
    setPendingGitHubAuth(null)
  }, [])

  // Handle OAuth callback tokens written into the URL hash by the provider.
  // Async resolutions are guarded by `cancelled` so a late fetch/decode can't
  // setState after the effect is torn down (avoids a stale dialog re-appearing).
  useEffect(() => {
    let cancelled = false
    const hash = window.location.hash
    if (!hash || hash === '#') return
    const params = new URLSearchParams(hash.slice(1))

    // Device-to-device transfer link (issue #77)
    if (params.has('import')) {
      const code = params.get('import')
      history.replaceState({ piView: DEFAULT_VIEW }, '', window.location.pathname + window.location.search)
      decodeSnapshot(code)
        .then(snapshot => { if (!cancelled) setImportPrompt({ snapshot, jobs: snapshot.jobs.length, entries: snapshot.entries.length }) })
        .catch(() => { /* invalid/corrupt link — ignore silently */ })

    } else if (params.has('sync_error')) {
      history.replaceState({ piView: DEFAULT_VIEW }, '', window.location.pathname + window.location.search)
      db.settings.put({ key: 'syncError', value: describeSyncError(params.get('sync_error')) })

    // GitHub: hold the token in memory and show a confirmation dialog before
    // saving — GitHub may silently use the already-signed-in account without
    // showing an account chooser, so we ask the user to confirm it's right.
    } else if (params.has('sync_token') && params.get('sync_provider') === 'github') {
      const token = params.get('sync_token')
      history.replaceState({ piView: 'settings' }, '', window.location.pathname + window.location.search)
      setActiveView('settings')
      fetchGitHubUser(token)
        .then(user => { if (!cancelled) setPendingGitHubAuth({ token, username: user?.login ?? null }) })

    // Google / OneDrive: token comes via implicit flow, provider passed as `state`
    } else if (params.has('access_token') && params.has('state')) {
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
        if (cancelled) return
        history.replaceState({ piView: 'settings' }, '', window.location.pathname + window.location.search)
        setActiveView('settings')
      })
    }

    return () => { cancelled = true }
  }, [setActiveView])

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
      {importPrompt && (
        <ConfirmModal
          title="Import shared data?"
          message={`This link contains ${importPrompt.jobs} ${importPrompt.jobs === 1 ? 'job' : 'jobs'} and ${importPrompt.entries} ${importPrompt.entries === 1 ? 'entry' : 'entries'}. They'll be merged into this device — your existing data is kept and duplicates are skipped.`}
          confirmLabel="Import"
          onConfirm={async () => { await importSnapshot(importPrompt.snapshot); setImportPrompt(null) }}
          onCancel={() => setImportPrompt(null)}
        />
      )}
      {pendingGitHubAuth && (
        <GitHubAccountConfirm
          username={pendingGitHubAuth.username}
          onConfirm={confirmGitHubConnect}
          onDismiss={dismissGitHubConnect}
        />
      )}
    </Layout>
  )
}
