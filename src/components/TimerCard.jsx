import { useState, useEffect } from 'react'
import { Square, Pencil, AlertTriangle } from 'lucide-react'
import { db } from '../db'
import { formatElapsed, formatTime } from '../utils/time'
import EditEntryModal from './EditEntryModal'

export default function TimerCard({ entry, job, laborType }) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(entry.punchIn).getTime())
  const [showEditModal, setShowEditModal] = useState(false)

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
  const isOvernight = elapsed > 43200000 // 12 hours in milliseconds

  return (
    <div className={`relative rounded-xl border bg-appCard overflow-hidden transition-all duration-300 ${
      isOvernight ? 'border-appAccent/40 shadow-lg shadow-appAccent/5 animate-pulse' : 'border-appBorder'
    }`}>
      {/* Color accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display font-semibold text-appText truncate">{job?.name || 'Unknown Job'}</p>
              {isOvernight && (
                <div className="flex items-center gap-1 text-appAccent text-[10px] font-bold uppercase tracking-wider bg-appAccent/10 px-2 py-0.5 rounded-full animate-bounce">
                  <AlertTriangle className="w-3 h-3" />
                  Overnight Run?
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {laborType && (
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: `${color}25`, color }}
                >
                  {laborType.name}
                </span>
              )}
              <div className="flex items-center gap-1 text-appTextDarker text-xs font-mono">
                <span>since {formatTime(entry.punchIn)}</span>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1 rounded hover:bg-appInput text-appTextDarker hover:text-appTextMuted transition-colors"
                  title="Adjust start time / notes"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>
            {entry.notes && (
              <p className="mt-1.5 text-xs text-appTextMuted truncate">{entry.notes}</p>
            )}
          </div>

          <button
            onClick={punchOut}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-appInput border border-appBorder
                       hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400
                       text-appTextMuted transition-all text-sm font-medium"
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

      {showEditModal && (
        <EditEntryModal entry={entry} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  )
}
