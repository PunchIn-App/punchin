import { useState, useEffect } from 'react'
import { Square } from 'lucide-react'
import { db } from '../db'
import { formatElapsed, formatTime } from '../utils/time'

export default function TimerCard({ entry, job, laborType }) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(entry.punchIn).getTime())

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Date.now() - new Date(entry.punchIn).getTime())
    }, 1000)
    return () => clearInterval(iv)
  }, [entry.punchIn])

  const punchOut = async () => {
    await db.entries.update(entry.id, { punchOut: new Date() })
  }

  const color = laborType?.color || '#6366F1'

  return (
    <div className="relative rounded-xl border border-[#2A2F45] bg-[#161923] overflow-hidden">
      {/* Color accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-white truncate">{job?.name || 'Unknown Job'}</p>
            <div className="flex items-center gap-2 mt-1">
              {laborType && (
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: `${color}25`, color }}
                >
                  {laborType.name}
                </span>
              )}
              <span className="text-[#4B5563] text-xs font-mono">
                since {formatTime(entry.punchIn)}
              </span>
            </div>
            {entry.notes && (
              <p className="mt-1.5 text-xs text-[#6B7280] truncate">{entry.notes}</p>
            )}
          </div>

          <button
            onClick={punchOut}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-[#1E2232] border border-[#2A2F45]
                       hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400
                       text-[#6B7280] transition-all text-sm font-medium"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Out
          </button>
        </div>

        {/* Live clock */}
        <div className="mt-3 font-mono text-4xl font-medium tracking-wider" style={{ color }}>
          {formatElapsed(elapsed)}
        </div>
      </div>
    </div>
  )
}
