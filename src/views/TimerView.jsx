import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Clock } from 'lucide-react'
import { db } from '../db'
import TimerCard from '../components/TimerCard'
import StartTimerModal from '../components/StartTimerModal'
import { formatDurationHM, formatTime } from '../utils/time'

export default function TimerView() {
  const [showModal, setShowModal] = useState(false)

  const active     = useLiveQuery(() => db.entries.filter(e => !e.punchOut).toArray(), [])
  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])
  const lastEntry  = useLiveQuery(async () => {
    const results = await db.entries
      .orderBy('punchOut')
      .filter(e => !!e.punchOut)
      .reverse()
      .limit(1)
      .toArray()
    return results[0] ?? null
  }, [])

  // Build id→record lookups once per data change instead of an O(n) array.find
  // on every render and every card lookup (issue #138).
  const jobMap = useMemo(() => new Map((jobs ?? []).map(j => [j.id, j])), [jobs])
  const ltMap  = useMemo(() => new Map((laborTypes ?? []).map(lt => [lt.id, lt])), [laborTypes])
  const getJob = id => jobMap.get(id)
  const getLT  = id => ltMap.get(id)

  return (
    <div className="h-full flex flex-col scrollable">
      <div className="flex-1 px-4 pt-4 pb-24 lg:max-w-3xl lg:mx-auto lg:w-full">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-appText text-2xl leading-none">Active</h1>
            <p className="text-appTextMuted text-sm mt-0.5">
              {active === undefined
                ? ' ' /* still loading — don't flash "No active timers" (issue #135) */
                : active.length
                  ? `${active.length} timer${active.length !== 1 ? 's' : ''} running`
                  : 'No active timers'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                       bg-appAccent hover:brightness-110 active:brightness-90
                       text-[#0F1117] font-display font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Punch In
          </button>
        </div>

        {/* Empty state */}
        {active?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-appCard border border-appBorderLight flex items-center justify-center mb-5">
              <Clock className="w-9 h-9 text-appTextDisabled" />
            </div>
            <p className="font-display font-semibold text-appTextMuted text-xl">Nothing running</p>
            <p className="text-appTextDisabled text-sm mt-1.5">Tap Punch In to start tracking time</p>
          </div>
        )}

        {/* Timer cards */}
        <div className="space-y-3">
          {active?.map(entry => (
            <TimerCard
              key={entry.id}
              entry={entry}
              job={getJob(entry.jobId)}
              laborType={getLT(entry.laborTypeId)}
            />
          ))}
        </div>

        {/* Last completed session */}
        {lastEntry && active?.length === 0 && (() => {
          const job = getJob(lastEntry.jobId)
          const lt  = getLT(lastEntry.laborTypeId)
          const color = lt?.color || '#6366F1'
          const duration = new Date(lastEntry.punchOut) - new Date(lastEntry.punchIn)
          return (
            <div className="mt-8">
              <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2">Last Session</p>
              <div className="relative rounded-xl border border-appBorder bg-appCard overflow-hidden opacity-70">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                <div className="pl-5 pr-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || 'Unknown Job'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lt && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${color}25`, color }}>
                          {lt.name}
                        </span>
                      )}
                      <span className="text-xs text-appTextMuted font-mono">
                        {formatTime(lastEntry.punchIn)} – {formatTime(lastEntry.punchOut)}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-appTextMuted text-sm flex-shrink-0">{formatDurationHM(duration)}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {showModal && <StartTimerModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
