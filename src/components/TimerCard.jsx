import { useState, useEffect } from 'react'
import { Square, Pencil, AlertTriangle } from 'lucide-react'
import { db } from '../db'
import { formatElapsed, formatTime } from '../utils/time'
import { formatMoney } from '../utils/format'
import EditEntryModal from './EditEntryModal'
import { LaborTag } from './LaborGlyph'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useSettings } from '../hooks/useSettings'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'

export default function TimerCard({ entry, job, laborType }) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(entry.punchIn).getTime())
  const [showEditModal, setShowEditModal] = useState(false)

  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  const hapticsOn = isStandalone && settings.hapticFeedback !== false
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(hapticsOn ? os : 'web')

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - new Date(entry.punchIn).getTime())
    let iv = null
    const start = () => { if (iv === null) iv = setInterval(tick, 1000) }
    const stop  = () => { if (iv !== null) { clearInterval(iv); iv = null } }
    // Pause the per-second tick while the tab is backgrounded so N concurrent
    // timer cards don't each keep a 1s interval (and animate-pulse/bounce) alive
    // with nothing watching; re-sync and resume the instant it's visible again
    // (issue #142).
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else { tick(); start() }
    }
    if (document.visibilityState !== 'hidden') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [entry.punchIn])

  const punchOut = async () => {
    // Fire synchronously in the gesture context — iOS Taptic no-ops otherwise.
    hapticTrigger()
    await db.entries.update(entry.id, { punchOut: new Date() })
  }

  const color = laborType?.color || '#6366F1'
  const isOvernight = elapsed > 43200000 // 12 hours in milliseconds

  return (
    <div className={`relative rounded-xl border bg-appCard overflow-hidden transition-all duration-300 ${
      isOvernight ? 'border-appAccent/40 shadow-lg shadow-appAccent/5 animate-pulse' : 'border-appBorder'
    }`}>
      {hapticEl}
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
              <LaborTag laborType={laborType} />
              <div className="flex items-center gap-1 text-appTextDarker text-xs font-mono">
                <span>started {formatTime(entry.punchIn, settings.timeFormat)}</span>
                <button
                  onClick={() => setShowEditModal(true)}
                  aria-label="Edit start time and notes"
                  className="p-1 rounded hover:bg-appInput text-appTextMuted hover:text-appText transition-colors"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
            {entry.notes && (
              <p className="mt-1.5 text-xs text-appTextMuted truncate">{entry.notes}</p>
            )}
          </div>

          <button
            onClick={punchOut}
            aria-label={`Stop timer for ${job?.name || 'this job'}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-red-500/10 border border-red-500/25 text-red-400
                       hover:bg-red-500/20 hover:border-red-500/40
                       transition-all text-sm font-medium"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            Stop
          </button>
        </div>

        {/* Live clock */}
        <div
          role="timer"
          aria-live="off"
          aria-label={`Elapsed time: ${formatElapsed(elapsed)}`}
          className="mt-3 font-mono text-4xl font-medium tracking-wider"
          style={{ color }}
        >
          {formatElapsed(elapsed)}
        </div>

        {/* Footer: client + live earnings (when a rate is set for this work) */}
        {(() => {
          const rate = job?.laborRates?.[entry.laborTypeId]
          if (!job?.clientName && rate == null) return null
          return (
            <div className="mt-3 pt-3 border-t border-dashed border-appBorderLight flex items-center justify-between gap-2 text-xs">
              <span className="font-mono uppercase tracking-wider text-appTextDarker truncate">{job?.clientName || ''}</span>
              {rate != null && (
                <span className="font-mono text-appTextMuted flex-shrink-0">{formatMoney((elapsed / 3600000) * rate, settings.defaultCurrency)}</span>
              )}
            </div>
          )
        })()}
      </div>

      {showEditModal && (
        <EditEntryModal entry={entry} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  )
}
