import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'

export default function StartTimerModal({ onClose }) {
  const [jobId, setJobId]           = useState('')
  const [laborTypeId, setLaborTypeId] = useState('')
  const [notes, setNotes]           = useState('')
  const [error, setError]           = useState('')

  const { settings } = useSettings()
  const jobs       = useLiveQuery(() => db.jobs.filter(j => j.isActive !== false && j.isDeleted !== true).toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.orderBy('name').toArray(), [])

  // Pre-fill labor type from job default
  useEffect(() => {
    if (!jobId || !jobs) return
    const job = jobs.find(j => j.id === Number(jobId))
    if (job?.laborTypeId) setLaborTypeId(String(job.laborTypeId))
  }, [jobId, jobs])

  const handleStart = async () => {
    setError('')
    if (!jobId)       { setError('Please select a job'); return }
    if (!laborTypeId) { setError('Please select a labor type'); return }

    try {
      await db.transaction('rw', db.entries, async () => {
        if (!settings.allowConcurrentTimers) {
          const running = await db.entries.filter(e => !e.punchOut).count()
          if (running > 0) throw new Error('Concurrent timers are off. Punch out first, or enable them in Settings.')
        }
        await db.entries.add({
          jobId:       Number(jobId),
          laborTypeId: Number(laborTypeId),
          punchIn:     new Date(),
          punchOut:    null,
          notes:       notes.trim() || null,
        })
      })
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2.5 text-sm
                    placeholder-appTextDisabled focus:outline-none focus:border-amber-500/60 transition-colors`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
          <h2 className="font-display font-semibold text-appText text-lg">Start Timer</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Job</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)} className={inputCls}>
              <option value="">Select a job...</option>
              {jobs?.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Labor Type</label>
            <select value={laborTypeId} onChange={e => setLaborTypeId(e.target.value)} className={inputCls}>
              <option value="">Select labor type...</option>
              {laborTypes?.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">
              Notes <span className="text-appTextDisabled normal-case font-normal">— optional</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="What are you working on?"
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <button
            onClick={handleStart}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                       text-[#0F1117] font-display font-bold text-base transition-colors"
          >
            Punch In
          </button>
        </div>
      </div>
    </div>
  )
}
