import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, Briefcase, Calendar, BarChart2, Settings } from 'lucide-react'
import { db } from '../db'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useSettings } from '../hooks/useSettings'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'
import { hasWaitingUpdate } from '../utils/pwa'
import { PunchMark, Wordmark } from './BrandMark'
import { DEFAULT_ACCENT } from '../accentPresets'

const NAV = [
  { id: 'timer',      label: 'Timer',     Icon: Clock      },
  { id: 'jobs',       label: 'Jobs',      Icon: Briefcase  },
  { id: 'timesheets', label: 'Timesheets', Icon: Calendar   },
  { id: 'analytics',  label: 'Analytics', Icon: BarChart2  },
  { id: 'settings',   label: 'Settings',  Icon: Settings   },
]

// Builds inline style overrides for iOS standalone mode only.
// Android's WindowInsets system handles its own bars; no manual padding needed.
function useAdaptiveStyles(isStandalone, os) {
  if (!isStandalone || os !== 'ios') return { header: undefined, nav: undefined }
  return {
    header: { paddingTop: 'env(safe-area-inset-top)' },
    nav:    { paddingBottom: 'env(safe-area-inset-bottom)' },
  }
}

export default function Layout({ activeView, onNavigate, children }) {
  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  const adaptive = useAdaptiveStyles(isStandalone, os)

  const hapticsOn = isStandalone && settings.hapticFeedback !== false
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(hapticsOn ? os : 'web')
  const accentColor = settings.accentColor || DEFAULT_ACCENT
  // Live "On the clock" status for the desktop sidebar (privacy-first wording —
  // never "REC"/"recording"). undefined while loading; a count once resolved.
  const activeCount = useLiveQuery(() => db.entries.filter(e => !e.punchOut).count(), [])

  // Fire the tap haptic synchronously in the click handler (iOS needs the
  // gesture context) before delegating to the parent's navigation.
  const navigate = (id) => { hapticTrigger(); onNavigate(id) }

  const [hasUpdate, setHasUpdate] = useState(() => !!window.__pwaUpdateAvailable)
  useEffect(() => {
    const handler = () => setHasUpdate(true)
    window.addEventListener('pwa:update-ready', handler)
    return () => window.removeEventListener('pwa:update-ready', handler)
  }, [])

  // A worker may already be waiting from a previous page load (the in-memory
  // flag resets on mount); show the badge so the pending update stays visible.
  useEffect(() => {
    let cancelled = false
    hasWaitingUpdate().then(waiting => { if (waiting && !cancelled) setHasUpdate(true) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="h-full flex flex-col md:flex-row bg-appBg">
      {hapticEl}

      {/* Desktop chrome: tablet icon-rail (md) → labelled sidebar (lg+). Replaces
          the phone header + bottom nav, which are hidden from md up. */}
      <aside className="hidden md:flex md:flex-col md:w-16 lg:w-[236px] flex-shrink-0 border-r border-appBorderLight bg-appNav">
        <button
          onClick={() => navigate('timer')}
          aria-label="PunchIn — go to Timer"
          className="flex items-center gap-2 px-3 lg:px-4 py-4 justify-center lg:justify-start transition-opacity active:opacity-70"
        >
          <PunchMark accent={accentColor} />
          <Wordmark className="hidden lg:block text-xl" />
        </button>

        <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={id === 'settings' && hasUpdate ? `${label} — update available` : label}
                className={`relative flex items-center gap-3 rounded-lg py-2.5 justify-center lg:justify-start lg:px-3 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent
                  ${active ? 'bg-appAccent/15 text-appAccent' : 'text-appTextMuted hover:text-appText hover:bg-appInput'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
                <span className="hidden lg:block text-sm font-medium">{label}</span>
                {id === 'settings' && hasUpdate && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 lg:static lg:ml-auto w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Live "On the clock" status + version */}
        <div className="mt-auto px-3 lg:px-4 py-3 border-t border-appBorderLight">
          <div className="flex items-center gap-2 justify-center lg:justify-start">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full flex-shrink-0 ${activeCount ? 'bg-appAccent animate-pulse' : 'bg-appTextDisabled'}`}
            />
            <span className="hidden lg:block text-xs text-appTextMuted">
              {activeCount === undefined
                ? ' '
                : activeCount > 0
                  ? `On the clock · ${activeCount}`
                  : 'Off the clock'}
            </span>
          </div>
          <span className="hidden lg:block font-mono text-[10px] text-appTextMuted select-none mt-2">v{__APP_VERSION__}</span>
        </div>
      </aside>

      {/* Phone header */}
      <header
        style={adaptive.header}
        className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-appBorderLight"
      >
        <button
          onClick={() => navigate('timer')}
          aria-label="PunchIn — go to Timer"
          className="flex items-center gap-2 rounded-lg transition-opacity active:opacity-70"
        >
          <PunchMark accent={accentColor} />
          <Wordmark className="text-xl" />
        </button>
        <span className="font-mono text-[10px] text-appTextMuted select-none">v{__APP_VERSION__}</span>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>

      {/* Phone bottom nav */}
      <nav
        style={adaptive.nav}
        aria-label="Main navigation"
        className="md:hidden flex-shrink-0 flex border-t border-appBorderLight bg-appNav"
      >
        {NAV.map(({ id, label, Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={id === 'settings' && hasUpdate ? 'Settings — update available' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:ring-inset
                ${active ? 'text-appAccent' : 'text-appTextMuted hover:text-appText'}`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
              {id === 'settings' && hasUpdate && (
                <span aria-hidden="true" className="absolute top-1.5 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-red-500" />
              )}
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
