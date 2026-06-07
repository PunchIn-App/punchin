import { useState, useEffect } from 'react'
import { Clock, Briefcase, Calendar, BarChart2, Settings } from 'lucide-react'
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
    <div className="h-full flex flex-col bg-appBg">
      {/* Header */}
      <header
        style={adaptive.header}
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-appBorderLight"
      >
        {hapticEl}
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
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        style={adaptive.nav}
        aria-label="Main navigation"
        className="flex-shrink-0 flex border-t border-appBorderLight bg-appNav"
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
