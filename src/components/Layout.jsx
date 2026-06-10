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
import { formatDurationHM } from '../utils/time'

const NAV = [
  { id: 'timer',      label: 'Timer',     Icon: Clock      },
  { id: 'jobs',       label: 'Jobs',      Icon: Briefcase  },
  { id: 'timesheets', label: 'Timesheets', Icon: Calendar   },
  { id: 'analytics',  label: 'Analytics', Icon: BarChart2  },
  { id: 'settings',   label: 'Settings',  Icon: Settings   },
]

// The TOP and SIDE safe-area insets are applied unconditionally via Tailwind
// classes on the shell (root: left/right · header/aside: top · main: top at md+).
// env() resolves to 0 with no notch/cutout, so this is harmless on devices and
// browsers without one — and it means a non-standalone Safari tab gets them too
// (iPhone landscape: the Dynamic Island sits on a side and would otherwise overlap
// the sidebar rail; iPad standalone: the status bar sits over the top of the rail/
// content). The BOTTOM inset is the exception: it stays runtime-gated to an iOS
// standalone install, where the home indicator overlaps the bottom nav so the bar
// pads its content up. In a browser tab the chrome owns the bottom and Safari's
// bottom-inset semantics differ, so applying it there would open a spurious gap.
function navBottomInset(isStandalone, os) {
  return isStandalone && os === 'ios' ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined
}

export default function Layout({ activeView, onNavigate, children }) {
  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  const navStyle = navBottomInset(isStandalone, os)

  const hapticsOn = isStandalone && settings.hapticFeedback !== false
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(hapticsOn ? os : 'web')
  const accentColor = settings.accentColor || DEFAULT_ACCENT
  // Live "On the clock" status for the chrome (privacy-first wording — never
  // "REC"/"recording"): the running entries, their count, and their combined
  // elapsed time. A coarse 30s ticker keeps the duration fresh without a global
  // per-second re-render.
  const activeEntries = useLiveQuery(() => db.entries.filter(e => !e.punchOut).toArray(), [])
  const activeCount = activeEntries?.length
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeCount) return
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [activeCount])
  const activeMs = (activeEntries || []).reduce((s, e) => s + (now - new Date(e.punchIn).getTime()), 0)

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
    <div className="h-full flex flex-col md:flex-row bg-appBg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {hapticEl}

      {/* Desktop chrome: tablet icon-rail (md) → labelled sidebar (lg+). Replaces
          the phone header + bottom nav, which are hidden from md up. The top inset
          keeps the rail's content clear of the iPad status bar while its appNav
          background bleeds up behind it. */}
      <aside className="hidden md:flex md:flex-col md:w-16 lg:w-[236px] flex-shrink-0 border-r border-appBorderLight bg-appNav pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => navigate('timer')}
          aria-label="PunchIn — go to Timer"
          className="flex items-center gap-2 px-3 lg:px-4 py-4 justify-center lg:justify-start transition-opacity active:opacity-70"
        >
          <PunchMark accent={accentColor} />
          <Wordmark className="hidden lg:block text-xl" />
        </button>

        <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2 mt-3">
          {NAV.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={id === 'settings' && hasUpdate ? `${label} — update available` : label}
                className={`relative flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors
                  lg:flex-row lg:items-center lg:gap-3 lg:py-2.5 lg:px-3 lg:justify-start
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent
                  ${active ? 'bg-appInput text-appText' : 'text-appTextMuted hover:text-appText hover:bg-appInput'}`}
              >
                {/* 3px accent left-rail on the active item (full sidebar only — on the
                    narrow md icon-rail it floats detached left of the highlight, so the
                    bg + brighter text carry the active state there instead) */}
                {active && <span aria-hidden="true" className="hidden lg:block absolute -left-2 top-2 bottom-2 w-[3px] rounded-r bg-appAccent" />}
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.2 : 1.5} aria-hidden="true" />
                {/* Label: under the icon on the tablet icon-rail (md), beside it on the full sidebar (lg+) */}
                <span className="text-[10px] leading-tight text-center font-semibold lg:text-sm lg:text-left">{label}</span>
                {id === 'settings' && hasUpdate && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 lg:static lg:ml-auto w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Live "On the clock" status card (amber 'on the clock' hue per the design) */}
        <div className="mt-auto p-2 lg:p-3">
          <div className="hidden lg:flex items-center gap-2.5 rounded-xl border border-appBorder bg-appCard px-3 py-3">
            <span
              aria-hidden="true"
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeCount ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: activeCount ? 'var(--amber)' : 'var(--text-disabled)' }}
            />
            <div className="min-w-0">
              {activeCount
                ? <>
                    <p className="text-[13px] font-bold text-appText leading-tight">On the clock</p>
                    <p className="text-[11px] text-appTextMuted">{activeCount} timer{activeCount === 1 ? '' : 's'} · {formatDurationHM(activeMs)}</p>
                  </>
                : <p className="text-[13px] font-medium text-appTextMuted">Off the clock</p>}
            </div>
          </div>
          {/* md icon-rail: presence conveys state without relying on hue (WCAG
              1.4.1) — the amber dot renders ONLY when on the clock; its absence
              means off. An sr-only string voices the same state in text, since
              the lg-only status card above is hidden at md. */}
          <div className="lg:hidden flex justify-center py-2">
            {activeCount > 0 && (
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--amber)' }}
              />
            )}
            <span className="sr-only">
              {activeCount
                ? `On the clock — ${activeCount} running`
                : 'Off the clock'}
            </span>
          </div>
        </div>
      </aside>

      {/* Phone header */}
      <header
        className="md:hidden flex-shrink-0 flex items-center justify-between px-4 pb-3 border-b border-appBorderLight bg-appNav pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        <button
          onClick={() => navigate('timer')}
          aria-label="PunchIn — go to Timer"
          className="flex items-center gap-2 rounded-lg transition-opacity active:opacity-70"
        >
          <PunchMark accent={accentColor} />
          <Wordmark className="text-xl" />
        </button>
        {activeCount > 0 && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: 'color-mix(in srgb, var(--amber) 14%, transparent)', color: 'var(--amber-text)' }}
          >
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--amber)' }} />
            On the clock
          </span>
        )}
      </header>

      {/* Main content. At md+ the phone header is gone and the content sits at the
          top of the screen beside the rail, so it takes the top inset itself to
          clear the iPad status bar; on phones the header above it already does. */}
      <main className="flex-1 min-w-0 overflow-hidden md:pt-[env(safe-area-inset-top)]">
        {children}
      </main>

      {/* Phone bottom nav */}
      <nav
        style={navStyle}
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
