import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Clock } from 'lucide-react'
import { db } from '../db'
import TimerCard from '../components/TimerCard'
import StartTimerModal from '../components/StartTimerModal'

export default function TimerView() {
  const [showModal, setShowModal] = useState(false)

  const active     = useLiveQuery(() => db.entries.filter(e => !e.punchOut).toArray(), [])
  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])

  const getJob = id => jobs?.find(j => j.id === id)
  const getLT  = id => laborTypes?.find(lt => lt.id === id)

  return (
    <div className="h-full flex flex-col scrollable">
      <div className="flex-1 px-4 pt-4 pb-24">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display font-bold text-appText text-2xl leading-none">Active</h1>
            <p className="text-appTextMuted text-sm mt-0.5">
              {active?.length
                ? `${active.length} timer${active.length !== 1 ? 's' : ''} running`
                : 'No active timers'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                       bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                       text-[#0F1117] font-display font-bold text-sm transition-colors"
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
      </div>

      {showModal && <StartTimerModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
