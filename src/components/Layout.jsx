import { Clock, Briefcase, Calendar, BarChart2, Settings } from 'lucide-react'

const NAV = [
  { id: 'timer',      label: 'Timer',     Icon: Clock      },
  { id: 'jobs',       label: 'Jobs',      Icon: Briefcase  },
  { id: 'timesheets', label: 'Sheets',    Icon: Calendar   },
  { id: 'analytics',  label: 'Analytics', Icon: BarChart2  },
  { id: 'settings',   label: 'Settings',  Icon: Settings   },
]

export default function Layout({ activeView, onNavigate, children }) {
  return (
    <div className="h-full flex flex-col bg-appBg">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-appBorderLight">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#0F1117]" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-appText tracking-tight text-xl">PunchIn</span>
        </div>
        <span className="font-mono text-[10px] text-appTextDisabled select-none">v0.1</span>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="flex-shrink-0 flex border-t border-appBorderLight bg-appNav">
        {NAV.map(({ id, label, Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                active ? 'text-amber-400' : 'text-appTextDisabled hover:text-appTextMuted'
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
