import { useState, useEffect, useCallback, useId } from 'react'
import { X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useSwipeDismiss, useAndroidBackDismiss, useSheetStyles } from '../hooks/useBottomSheet'

export default function StartTimerModal({ onClose }) {
  const [jobId, setJobId]             = useState('')
  const [laborTypeId, setLaborTypeId] = useState('')
  const [notes, setNotes]             = useState('')
  const [error, setError]             = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const uid = useId()
  const titleId   = `${uid}-title`
  const jobId_    = `${uid}-job`
  const ltId_     = `${uid}-lt`
  const notesId_  = `${uid}-notes`
  const errorId_  = `${uid}-error`

  const { settings }             = useSettings()
  const { isStandalone, os }     = usePlatformContext()
  const hapticsOn = isStandalone && settings.hapticFeedback !== false
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(hapticsOn ? os : 'web')

  const jobs       = useLiveQuery(() => db.jobs.filter(j => j.isActive !== false).toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.orderBy('name').filter(lt => !lt.isArchived).toArray(), [])

  const stableClose   = useCallback(onClose, [onClose])
  const noopClose     = useCallback(() => {}, [])
  const noopHaptic    = useCallback(() => {}, [])

  const swipeRef = useSwipeDismiss(
    isStandalone && os === 'ios'     ? stableClose : noopClose,
    isStandalone && os === 'ios'     ? hapticTrigger : noopHaptic,
  )
  useAndroidBackDismiss(
    isStandalone && os === 'android' ? stableClose : noopClose,
    isStandalone && os === 'android' ? hapticTrigger : noopHaptic,
  )

  const { scrim, sheet, handle } = useSheetStyles(isStandalone, os)

  // Focus trap, Escape, and focus restoration (issues #151/#152/#154)
  useFocusTrap(swipeRef, stableClose)

  useEffect(() => {
    if (!jobId || !jobs) return
    const job = jobs.find(j => j.id === Number(jobId))
    if (job?.laborTypeId) setLaborTypeId(String(job.laborTypeId))
  }, [jobId, jobs])

  const handleStart = async () => {
    setError('')
    if (!jobId)       { setError('Please select a job'); return }
    if (!laborTypeId) { setError('Please select a labor type'); return }

    // Fire synchronously in the gesture context — iOS Taptic no-ops otherwise.
    hapticTrigger()
    setSubmitting(true)
    try {
      await db.transaction('rw', db.entries, async () => {
        if (!settings.allowConcurrentTimers) {
          const now = new Date()
          const running = await db.entries.filter(e => !e.punchOut).toArray()
          for (const e of running) {
            await db.entries.update(e.id, { punchOut: now })
          }
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
      setSubmitting(false)
    }
  }

  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2.5 text-sm
                    placeholder-appTextDisabled focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors`

  return (
    <div className={scrim}>
      {/* Hidden iOS Taptic Engine trigger — zero layout impact, sr-only */}
      {hapticEl}

      <div
        ref={swipeRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId_ : undefined}
        className={sheet}
      >

        {/* Platform drag handle (iOS / Android standalone only) */}
        {handle}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
          <h2 id={titleId} className="font-display font-semibold text-appText text-lg">Start Timer</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={jobId_} className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Job</label>
            <select id={jobId_} value={jobId} onChange={e => setJobId(e.target.value)} className={inputCls}>
              <option value="">Select a job...</option>
              {jobs?.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={ltId_} className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Labor Type</label>
            <select id={ltId_} value={laborTypeId} onChange={e => setLaborTypeId(e.target.value)} className={inputCls}>
              <option value="">Select labor type...</option>
              {laborTypes?.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={notesId_} className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">
              Notes <span className="text-appTextMuted normal-case font-normal">— optional</span>
            </label>
            <input
              id={notesId_}
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="What are you working on?"
              className={inputCls}
            />
          </div>

          {error && (
            <p id={errorId_} role="alert" className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <button
            onClick={handleStart}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                       text-[#0F1117] font-display font-bold text-base transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Starting…' : 'Punch In'}
          </button>
        </div>

      </div>
    </div>
  )
}
