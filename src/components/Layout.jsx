import { Clock, Briefcase, Calendar, BarChart2, Settings } from 'lucide-react'
import { usePlatformContext } from '../hooks/usePlatformContext'

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
  const adaptive = useAdaptiveStyles(isStandalone, os)

  return (
    <div className="h-full flex flex-col bg-appBg">
      {/* Header */}
      <header
        style={adaptive.header}
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-appBorderLight"
      >
        <button
          onClick={() => onNavigate('timer')}
          className="flex items-center gap-2 rounded-lg transition-opacity active:opacity-70"
        >
          <div className="w-7 h-7 rounded-lg bg-appAccent flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#0F1117]" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-appText tracking-tight text-xl">PunchIn</span>
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
        className="flex-shrink-0 flex border-t border-appBorderLight bg-appNav"
      >
        {NAV.map(({ id, label, Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                active ? 'text-appAccent' : 'text-appTextMuted hover:text-appText'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.5} />
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
