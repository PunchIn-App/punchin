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
import { useFocusTrap } from './hooks/useFocusTrap'
import { useSettings } from './hooks/useSettings'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useReminders } from './hooks/useReminders'
import { useAutoSync } from './hooks/useAutoSync'
import { updateFavicon } from './utils/favicon'
import { applyInstallIcon } from './utils/installIcon'
import { DEFAULT_ACCENT, DEFAULT_ACCENT_LIGHT } from './accentPresets'
import { readableInk } from './utils/inkOnAccent'
import { hexToRgb } from './utils/color'
import { decodeSnapshot } from './utils/transfer'
import { importSnapshot } from './sync/syncManager'
import { fetchGitHubUser } from './sync/providers/github'
import { fetchGoogleUser } from './sync/providers/google'
import { fetchOneDriveUser } from './sync/providers/onedrive'
import { fetchDropboxUser } from './sync/providers/dropbox'
import { consumeOAuthState } from './sync/oauthState'
import { setSyncToken, setRefreshToken } from './sync/tokenStore'
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

const DEFAULT_VIEW = 'timer'

// Per-provider copy for the connect-confirmation dialog. `prefix` is the handle
// sigil (GitHub logins render as @login; Google/OneDrive show the bare email).
// `note` reassures what access the grant actually gives — for Google/OneDrive
// that's an app-folder-only scope, for GitHub the (broader) all-gists scope.
const PROVIDER_CONNECT = {
  github: {
    label: 'GitHub',
    prefix: '@',
    storage: 'a private gist in this account',
    note: (
      <>
        Connecting grants access to your GitHub gists. GitHub&apos;s gist permission covers{' '}
        <span className="text-appText">all</span> your gists, not just PunchIn&apos;s — you can revoke it
        anytime in your GitHub account settings.
      </>
    ),
  },
  google: {
    label: 'Google Drive',
    prefix: '',
    storage: 'a hidden app folder in your Google Drive',
    note: 'PunchIn only ever sees the files it creates in its own hidden app folder — never the rest of your Drive. You can revoke access anytime in your Google account settings.',
  },
  onedrive: {
    label: 'OneDrive',
    prefix: '',
    storage: 'an app folder in your OneDrive',
    note: 'PunchIn only ever accesses its own app folder — never the rest of your OneDrive. You can revoke access anytime in your Microsoft account settings.',
  },
  dropbox: {
    label: 'Dropbox',
    prefix: '',
    storage: 'an app folder in your Dropbox',
    note: 'PunchIn only ever accesses its own app folder — never the rest of your Dropbox. You can revoke access anytime in your Dropbox account settings.',
  },
}

// Confirm WHICH account is being linked before any token is written (#83, #243
// follow-up). Generalised from the original GitHub-only dialog so Google and
// OneDrive get the same "Connect as <you>?" gate — the fix for connecting as the
// wrong account with nothing on screen to catch it.
function AccountConfirm({ provider, username, onConfirm, onDismiss }) {
  const dialogRef = useRef(null)
  const cfg = PROVIDER_CONNECT[provider] ?? PROVIDER_CONNECT.github
  const display = username ? `${cfg.prefix}${username}` : null

  // Shared modal focus management (issue #151): focus the [data-autofocus]
  // Connect button on open, trap Tab within the dialog (all focusable nodes, not
  // just buttons), pull focus back if it wanders out, restore focus to the opener
  // on close, and close on Escape — the full a11y contract the inline trap missed.
  useFocusTrap(dialogRef, onDismiss)

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => e.target === e.currentTarget && onDismiss()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-confirm-title"
        className="w-full max-w-sm bg-appCard rounded-2xl border border-appBorder shadow-xl p-5 space-y-4"
      >
        <div>
          <p id="connect-confirm-title" className="font-display font-semibold text-appText">
            Connect {cfg.label}{display ? ` as ${display}` : ''}?
          </p>
          <p className="text-sm text-appTextMuted mt-1">
            Your data will sync to {cfg.storage}{display ? `, signed in as ${display}` : ''}.{' '}
            If this isn&apos;t the right account, tap Cancel, sign out of {cfg.label} in your browser, then try connecting again.
          </p>
          <p className="text-xs text-appTextMuted mt-2">{cfg.note}</p>
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

  // Background auto-sync (opt-in, default ON once connected). No-op unless a
  // provider is connected, auto-sync is on, and the token is live.
  useAutoSync()

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
    // 4.5:1 threshold because --on-accent styles normal-size button TEXT, not just
    // the graphic mark; a custom accent whose white contrast falls in [3, 4.5) now
    // flips to dark ink instead of failing AA (the brand renderers keep the 3:1 default).
    rootStyle.setProperty('--on-accent', readableInk(effectiveAccent, 4.5))
  }, [accentColor, resolvedTheme])

  // The favicon / install icon follow the stored accent (theme-independent — the
  // browser-tab/home-screen tile is the same in light and dark).
  useEffect(() => {
    updateFavicon(accentColor)
    applyInstallIcon(accentColor)
  }, [accentColor])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    // Keep in sync with --bg-primary in index.css (#F4F5F7 light / #0F1117 dark)
    // so the OS chrome bar matches the app surface.
    if (meta) meta.setAttribute('content', resolvedTheme === 'light' ? '#F4F5F7' : '#0F1117')
  }, [resolvedTheme])

  // A snapshot shared from another device via a #import=… transfer link (issue
  // #77). Decoded asynchronously, then confirmed before merging since opening a
  // link shouldn't silently change the user's data.
  const [importPrompt, setImportPrompt] = useState(null) // { snapshot, jobs, entries }

  // OAuth: the token is held here until the user confirms WHICH account to link
  // (#83, generalised to all providers in the #243 follow-up). We fetch the
  // account identity before asking so the dialog can name it; nothing is written
  // to the DB until the user taps Connect. Shape:
  //   { provider, token, username, refresh?, expiresIn? }
  // GitHub has no refresh token / expiry (its gist token doesn't expire), so
  // those are absent for github and present for google/onedrive.
  const [pendingAuth, setPendingAuth] = useState(null)

  const confirmConnect = useCallback(async () => {
    if (!pendingAuth) return
    const { provider, token, username, refresh, expiresIn } = pendingAuth
    await setSyncToken(token) // encrypted at rest (issue #126)
    if (refresh) await setRefreshToken(refresh) // encrypted at rest (issue #243)
    await db.settings.bulkPut([
      { key: 'syncProvider', value: provider },
      // github's gist token never expires (no refresh); google/onedrive carry a
      // real expiry so the background refresh knows when to renew (issue #243).
      { key: 'syncTokenExpiry', value: expiresIn ? Date.now() + expiresIn : null },
      { key: 'syncFileId', value: null },
      { key: 'syncError', value: null },
      { key: 'syncUsername', value: username ?? null },
      { key: 'autoSync', value: true }, // default background sync ON at connect
    ])
    setPendingAuth(null)
  }, [pendingAuth])

  const dismissConnect = useCallback(() => {
    // Drop the in-memory token without writing it (matches GitHub's original
    // cancel: nothing was persisted, so there's nothing to clean up).
    setPendingAuth(null)
  }, [])

  // Handle OAuth callback tokens written into the URL hash by the provider.
  // Async resolutions are guarded by `cancelled` so a late fetch/decode can't
  // setState after the effect is torn down (avoids a stale dialog re-appearing).
  useEffect(() => {
    let cancelled = false

    // All OAuth callbacks now arrive in the URL hash: the worker exchanges every
    // provider's code server-side and redirects with #sync_token=…&sync_provider=…
    // (plus #sync_refresh/#sync_expires for Google/OneDrive — issue #243).
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

    // OAuth success: the worker hands back the access token (+ refresh token and
    // expiry for Google/OneDrive) in the hash, with the provider named explicitly
    // and the CSRF nonce echoed in `state` (issue #243).
    } else if (params.has('sync_token') && params.has('state')) {
      const token = params.get('sync_token')
      const provider = params.get('sync_provider')
      const cleanUrl = window.location.pathname + window.location.search
      // Scrub the token out of the URL FIRST — before the state check or any
      // await — so a mismatched nonce or a rejected write can't leave it sitting
      // in the hash (issue #139). Then push a Settings entry so hardware Back
      // returns home rather than exiting the app (issues #139, #141).
      history.replaceState(history.state ?? { piView: DEFAULT_VIEW }, '', cleanUrl)
      history.pushState({ piView: 'settings' }, '', cleanUrl)
      hasPushedRef.current = true
      setActiveView('settings')
      // Verify the CSRF nonce the worker echoed back before trusting the token (issue #125).
      if (!consumeOAuthState(params.get('state'))) {
        db.settings.put({ key: 'syncError', value: describeSyncError('state_mismatch') })
      } else if (provider === 'github') {
        // GitHub may silently reuse the already-signed-in account, so fetch the
        // account identity and hold the token in memory until the user confirms
        // WHICH account to link (#83). GitHub gist tokens don't expire, so no
        // refresh token / expiry travels along.
        fetchGitHubUser(token)
          .then(user => { if (!cancelled) setPendingAuth({ provider, token, username: user?.login ?? null }) })
      } else if (provider === 'google' || provider === 'onedrive' || provider === 'dropbox') {
        // Google/OneDrive/Dropbox: the worker already did the confidential-client
        // code→token exchange and returned a refresh token + expiry. Same as
        // GitHub, hold them in memory and confirm the account first (issue #243
        // follow-up) — nothing is persisted until the user taps Connect, so the
        // refresh token (encrypted at rest, issue #126) is only saved on confirm.
        const refresh = params.get('sync_refresh')
        const expiresIn = parseInt(params.get('sync_expires') || '3600', 10) * 1000
        const fetchUser = provider === 'google' ? fetchGoogleUser
                        : provider === 'onedrive' ? fetchOneDriveUser
                        : fetchDropboxUser
        fetchUser(token)
          .then(username => { if (!cancelled) setPendingAuth({ provider, token, username: username ?? null, refresh, expiresIn }) })
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
  // The carry-over problem is specific to an INSTALLED PWA (it gets a clean data
  // store, separate from the browser), so only nudge there — a casual web/mobile
  // tab shouldn't be nagged. Show it at most ONCE per install: mark it seen the
  // moment it appears, so closing the app (without dismissing) doesn't re-pop it
  // on the next open. Import stays reachable from Settings → Data & Sync after.
  // Guarded so a stubbed db (tests) never throws.
  const [showFirstRun, setShowFirstRun] = useState(false)
  useEffect(() => {
    if (!isInstalled) return
    let cancelled = false
    ;(async () => {
      try {
        if (localStorage.getItem(FIRSTRUN_DISMISSED_KEY)) return
        const [j, e, l] = await Promise.all([db.jobs.count(), db.entries.count(), db.laborTypes.count()])
        if (!cancelled && j === 0 && e === 0 && l === 0) {
          try { localStorage.setItem(FIRSTRUN_DISMISSED_KEY, '1') } catch { /* ignore */ }
          setShowFirstRun(true)
        }
      } catch { /* storage/db unavailable — skip the nudge gracefully */ }
    })()
    return () => { cancelled = true }
  }, [isInstalled])

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
      {pendingAuth && (
        <AccountConfirm
          provider={pendingAuth.provider}
          username={pendingAuth.username}
          onConfirm={confirmConnect}
          onDismiss={dismissConnect}
        />
      )}
    </Layout>
  )
}
