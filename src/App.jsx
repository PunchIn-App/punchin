import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import Layout from './components/Layout'
import ErrorBoundary  from './components/ErrorBoundary'
import InstallPromptModal from './components/InstallPromptModal'
import FirstRunImport from './components/FirstRunImport'
import ConfirmModal from './components/ConfirmModal'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import SettingsView   from './views/SettingsView'
// Analytics is the only recharts consumer; lazy-load it so the (large) chart
// library lands in its own chunk fetched on demand, keeping the initial bundle
// small for an offline-first PWA (issue #167).
const AnalyticsView = lazy(() => import('./views/AnalyticsView'))
import { useSettings } from './hooks/useSettings'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useReminders } from './hooks/useReminders'
import { updateFavicon } from './utils/favicon'
import { applyInstallIcon } from './utils/installIcon'
import { DEFAULT_ACCENT, DEFAULT_ACCENT_LIGHT } from './accentPresets'
import { readableInk } from './utils/inkOnAccent'
import { decodeSnapshot } from './utils/transfer'
import { importSnapshot } from './sync/syncManager'
import { fetchGitHubUser } from './sync/providers/github'
import { exchangeOneDriveCode } from './sync/providers/onedrive'
import { consumeOAuthState } from './sync/oauthState'
import { consumePkceVerifier } from './sync/pkce'
import { setSyncToken } from './sync/tokenStore'
import { SYNC_CONFIG } from './sync/config'
import { db } from './db'

// localStorage keys for the first-run install nudge. Kept out of the Dexie
// data model so a factory reset doesn't wipe (or re-trigger) them.
const INSTALL_DISMISSED_KEY = 'pi.installNudgeDismissed'
const FIRSTRUN_DISMISSED_KEY = 'pi.firstRunImportDismissed'
const OPEN_COUNT_KEY        = 'pi.opens'
// Show the nudge once the user has opened the app at least this many times —
// after they've seen some value, which converts far better than a cold first paint.
const NUDGE_MIN_OPENS = 2

// Map OAuth callback error codes (which arrive in an attacker-influenceable URL
// fragment) to friendly, fixed messages. Unknown values fall back to a generic
// message, so a crafted `#sync_error=...` can't present arbitrary or misleading
// text in the Settings sync UI (issue #130).
const SYNC_ERROR_MESSAGES = {
  missing_code:   'Sign-in failed: no authorization code was returned.',
  server_error:   'Sign-in failed: the sign-in service had an error.',
  auth_failed:    'Sign-in failed: authorization was denied.',
  state_mismatch: 'Sign-in failed: the security check did not match. Please try connecting again.',
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
          <p className="text-xs text-appTextMuted mt-2">
            Connecting grants access to your GitHub gists. GitHub&apos;s gist permission covers{' '}
            <span className="text-appText">all</span> your gists, not just PunchIn&apos;s — you can revoke it
            anytime in your GitHub account settings.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-autofocus
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-appAccent hover:opacity-90 text-appOnAccent font-semibold text-sm transition-opacity focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
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
  // When we leave a drilled-in Settings sub-panel for another tab we can't just
  // replaceState — that would swap the panel entry but strand the {piView:'settings'}
  // entry beneath it, so the next Back would resurface Settings. Instead we unwind
  // the panel entry with history.back() and finish the tab swap once popstate lands;
  // this ref carries the pending target view across that async hop.
  const pendingNavRef = useRef(null)
  const navigate = useCallback((view) => {
    if (view === activeViewRef.current) {
      // Re-tapping the already-active tab lets a view reset its own internal
      // sub-state — Settings uses this to pop back to its root list from a
      // drilled-in sub-page (matching the hardware Back behaviour).
      window.dispatchEvent(new CustomEvent('pi:reselect-tab', { detail: view }))
      return
    }
    if (view === DEFAULT_VIEW) {
      // Returning home: unwind our pushed entry so Back from home exits the app.
      // A Settings drill-in pushes an extra {settingsPanel} entry on top of our
      // tab entry, so a bare history.back() would only close that sub-page and
      // leave us on Settings — unwind past it too so the tap always reaches the
      // default view. popstate restores the default view for us.
      if (hasPushedRef.current) {
        hasPushedRef.current = false
        history.go(history.state?.settingsPanel ? -2 : -1)
        return
      }
    } else if (hasPushedRef.current) {
      if (history.state?.settingsPanel) {
        // We're sitting on a Settings sub-panel entry. Unwind it first so the
        // stale {piView:'settings'} entry beneath doesn't survive the swap and
        // get the user thrown back to Settings on the next Back. popstate (below)
        // completes the swap onto the target tab.
        pendingNavRef.current = view
        history.back()
        return
      }
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
      if (pendingNavRef.current) {
        // This popstate is the unwind we triggered when leaving a Settings panel
        // for another tab. Land the swap on the target tab in place of the entry
        // we just backed onto, regardless of what state it carried.
        const target = pendingNavRef.current
        pendingNavRef.current = null
        history.replaceState({ piView: target }, '')
        setActiveView(target)
        hasPushedRef.current = target !== DEFAULT_VIEW
        return
      }
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
  const accentColor = settings.accentColor || DEFAULT_ACCENT

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

  // One token repaints every accent surface. The DEFAULT accent shifts to a
  // darker blue in light mode for contrast; a user-chosen custom accent is used
  // as-is in both themes (per-theme darkening of custom accents is a later step).
  // --accent (raw hex) backs color-mix tokens like --shadow-accent; --accent-rgb
  // backs the rgb(var(--accent-rgb) / <alpha>) Tailwind token.
  useEffect(() => {
    const effectiveAccent =
      accentColor === DEFAULT_ACCENT && resolvedTheme === 'light'
        ? DEFAULT_ACCENT_LIGHT
        : accentColor
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--accent', effectiveAccent)
    rootStyle.setProperty('--accent-rgb', hexToRgb(effectiveAccent))
    // Legible foreground for text/glyphs ON the accent (white, or dark ink on a
    // light/pastel accent) — used via the appOnAccent token on accent buttons.
    rootStyle.setProperty('--on-accent', readableInk(effectiveAccent))
  }, [accentColor, resolvedTheme])

  // The favicon / install icon follow the stored accent (theme-independent — the
  // browser-tab/home-screen tile is the same in light and dark).
  useEffect(() => {
    updateFavicon(accentColor)
    applyInstallIcon(accentColor)
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
    await setSyncToken(pendingGitHubAuth.token) // encrypted at rest (issue #126)
    await db.settings.bulkPut([
      { key: 'syncProvider', value: 'github' },
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

    // OneDrive Auth Code + PKCE (issue #128) returns a single-use `code` in the
    // query string — exchanged for the token via a direct POST, so the token is
    // never in the URL. (GitHub/Google still use the hash, handled below.)
    const search = new URLSearchParams(window.location.search)
    if (search.get('code') && search.get('state')?.startsWith('onedrive:')) {
      const code = search.get('code')
      const [, nonce] = (search.get('state') || '').split(':')
      // Scrub the single-use code from the launch entry, then push a Settings
      // entry so hardware Back returns home rather than exiting the app — a bare
      // replaceState would leave hasPushedRef stale (issues #139, #141).
      history.replaceState(history.state ?? { piView: DEFAULT_VIEW }, '', window.location.pathname)
      history.pushState({ piView: 'settings' }, '', window.location.pathname)
      hasPushedRef.current = true
      setActiveView('settings')
      if (consumeOAuthState(nonce)) {
        const verifier = consumePkceVerifier()
        exchangeOneDriveCode(SYNC_CONFIG.onedrive.clientId, code, verifier)
          .then(data => {
            if (cancelled || !data?.access_token) throw new Error('no token')
            return setSyncToken(data.access_token).then(() => db.settings.bulkPut([
              { key: 'syncProvider', value: 'onedrive' },
              { key: 'syncTokenExpiry', value: Date.now() + (data.expires_in ?? 3600) * 1000 },
              { key: 'syncFileId', value: null },
              { key: 'syncError', value: null },
            ]))
          })
          .catch(() => { if (!cancelled) db.settings.put({ key: 'syncError', value: describeSyncError('auth_failed') }) })
      } else {
        db.settings.put({ key: 'syncError', value: describeSyncError('state_mismatch') })
      }
      return () => { cancelled = true }
    }

    const hash = window.location.hash
    if (!hash || hash === '#') return () => { cancelled = true }
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
      const cleanUrl = window.location.pathname + window.location.search
      // Scrub the token from the launch entry, then push a Settings entry so
      // hardware Back returns home rather than exiting the app (issues #139, #141).
      history.replaceState(history.state ?? { piView: DEFAULT_VIEW }, '', cleanUrl)
      history.pushState({ piView: 'settings' }, '', cleanUrl)
      hasPushedRef.current = true
      setActiveView('settings')
      // Verify the CSRF nonce the worker echoed back before trusting the token (issue #125).
      if (consumeOAuthState(params.get('state'))) {
        fetchGitHubUser(token)
          .then(user => { if (!cancelled) setPendingGitHubAuth({ token, username: user?.login ?? null }) })
      } else {
        db.settings.put({ key: 'syncError', value: describeSyncError('state_mismatch') })
      }

    // Google: token comes via the implicit flow; `state` is `google:<nonce>`.
    // (OneDrive uses the Auth Code + PKCE query callback handled above, #128.)
    } else if (params.has('access_token') && params.has('state')) {
      const cleanUrl = window.location.pathname + window.location.search
      // Always scrub the token out of the URL first — before the provider check
      // or any await — so an unrecognised state value or a rejected DB write
      // can't leave the access_token sitting in the hash (issue #139).
      history.replaceState(history.state ?? { piView: DEFAULT_VIEW }, '', cleanUrl)
      const [provider, nonce] = (params.get('state') || '').split(':')
      if (provider === 'google') {
        const token = params.get('access_token')
        const expiresIn = parseInt(params.get('expires_in') || '3600', 10) * 1000
        // Push a Settings entry so hardware Back returns home, not exits (#141).
        history.pushState({ piView: 'settings' }, '', cleanUrl)
        hasPushedRef.current = true
        setActiveView('settings')
        // Reject the callback unless the returned nonce matches the one we stored (issue #125).
        if (consumeOAuthState(nonce)) {
          setSyncToken(token).then(() => db.settings.bulkPut([ // encrypted at rest (issue #126)
            { key: 'syncProvider', value: provider },
            { key: 'syncTokenExpiry', value: Date.now() + expiresIn },
            { key: 'syncFileId', value: null },
            { key: 'syncError', value: null },
          ]))
        } else {
          db.settings.put({ key: 'syncError', value: describeSyncError('state_mismatch') })
        }
      }
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

  // --- First-run import nudge --------------------------------------------
  // An installed PWA / fresh browser gets a clean data store, so a returning
  // user lands on an empty app. If there's no data yet (and they haven't
  // dismissed), offer to restore a backup or connect cloud sync. One-shot check
  // on mount; guarded so a stubbed db (tests) never throws.
  const [showFirstRun, setShowFirstRun] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (localStorage.getItem(FIRSTRUN_DISMISSED_KEY)) return
        const [j, e, l] = await Promise.all([db.jobs.count(), db.entries.count(), db.laborTypes.count()])
        if (!cancelled && j === 0 && e === 0 && l === 0) setShowFirstRun(true)
      } catch { /* storage/db unavailable — skip the nudge gracefully */ }
    })()
    return () => { cancelled = true }
  }, [])

  const dismissFirstRun = () => {
    try { localStorage.setItem(FIRSTRUN_DISMISSED_KEY, '1') } catch { /* ignore */ }
    setShowFirstRun(false)
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
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-appTextMuted text-sm" aria-live="polite" aria-busy="true">
            Loading…
          </div>
        }>
          {views[activeView]}
        </Suspense>
      </ErrorBoundary>
      {showInstall && installMode && (
        <InstallPromptModal
          mode={installMode}
          onInstall={handleInstall}
          onClose={dismissInstall}
        />
      )}
      {showFirstRun && (
        <FirstRunImport
          onDismiss={dismissFirstRun}
          onConnectSync={() => { navigate('settings'); dismissFirstRun() }}
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
