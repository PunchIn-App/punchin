import { useState, useEffect, useRef, useId } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteEntry } from '../db'
import { useFocusTrap } from '../hooks/useFocusTrap'
import ConfirmModal from './ConfirmModal'
import EntitySelect from './EntitySelect'

// Helper helpers for date/time controls — exported for unit testing
export function formatDateToYYYYMMDD(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const r = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${r}`
}

export function formatTimeToHHMM(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0)
}

export default function EditEntryModal({ entry, onClose }) {
  const isEditMode = !!entry
  const isActiveTimer = isEditMode && !entry.punchOut

  // Database lists
  const jobs       = useLiveQuery(() => db.jobs.filter(j => j.isActive !== false || j.id === entry?.jobId).toArray(), [entry])
  const laborTypes = useLiveQuery(() =>
    db.laborTypes.orderBy('name').filter(lt => !lt.isArchived || lt.id === entry?.laborTypeId).toArray(),
  [entry])

  // Form states
  const [jobId, setJobId]           = useState('')
  const [laborTypeId, setLaborTypeId] = useState('')
  const [dateStr, setDateStr]       = useState(formatDateToYYYYMMDD(new Date()))
  const [startTime, setStartTime]   = useState(formatTimeToHHMM(new Date()))
  const [endDateStr, setEndDateStr] = useState(formatDateToYYYYMMDD(new Date()))
  const [endTime, setEndTime]       = useState(formatTimeToHHMM(new Date(Date.now() + 3600000)))
  const [notes, setNotes]           = useState('')
  const [error, setError]           = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const uid = useId()
  const titleId    = `${uid}-title`
  const startDate_ = `${uid}-start-date`
  const startTime_ = `${uid}-start-time`
  const endDate_   = `${uid}-end-date`
  const endTime_   = `${uid}-end-time`
  const notesId_   = `${uid}-notes`
  const errorId_   = `${uid}-error`

  const dialogRef  = useRef(null)

  // Focus trap, Escape, and focus restoration (issues #151/#152/#154)
  useFocusTrap(dialogRef, onClose)

  // Pre-fill on edit mode
  useEffect(() => {
    if (entry) {
      setJobId(String(entry.jobId))
      setLaborTypeId(String(entry.laborTypeId))
      setDateStr(formatDateToYYYYMMDD(entry.punchIn))
      setStartTime(formatTimeToHHMM(entry.punchIn))
      if (entry.punchOut) {
        setEndDateStr(formatDateToYYYYMMDD(entry.punchOut))
        setEndTime(formatTimeToHHMM(entry.punchOut))
      } else {
        setEndDateStr(formatDateToYYYYMMDD(entry.punchIn))
      }
      setNotes(entry.notes || '')
    }
  }, [entry])

  // Pre-fill default labor type on job selection (only in manual mode or if not set)
  useEffect(() => {
    if (!jobId || !jobs || laborTypeId) return
    const job = jobs.find(j => j.id === Number(jobId))
    if (job?.laborTypeId) setLaborTypeId(String(job.laborTypeId))
  }, [jobId, jobs])

  const handleSave = async () => {
    setError('')
    if (!jobId) { setError('Please select a job'); return }
    if (!laborTypeId) { setError('Please select a labor type'); return }
    if (!dateStr) { setError('Please select a date'); return }
    if (!startTime) { setError('Please select a start time'); return }
    if (!isActiveTimer && !endTime) { setError('Please select an end time'); return }

    const punchInDate = combineDateAndTime(dateStr, startTime)
    let punchOutDate = null

    // An active timer can't start in the future: a future punchIn with no
    // punchOut makes getEntryDuration (now − punchIn) negative, so the live
    // TimerCard renders garbage. Completed entries are bounded by the end-after-
    // start check below, so this targets the active-timer path (issue #153).
    if (isActiveTimer && punchInDate.getTime() > Date.now()) {
      setError('Start can’t be in the future.')
      return
    }

    if (!isActiveTimer) {
      punchOutDate = combineDateAndTime(endDateStr, endTime)
      if (punchOutDate.getTime() <= punchInDate.getTime()) {
        setError('End must be after start.')
        return
      }
    }

    const payload = {
      jobId: Number(jobId),
      laborTypeId: Number(laborTypeId),
      punchIn: punchInDate,
      punchOut: punchOutDate,
      notes: notes.trim() || null,
    }

    try {
      if (isEditMode) {
        await db.entries.update(entry.id, payload)
      } else {
        await db.entries.add(payload)
      }
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to save entry: ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (!entry?.id) return
    try {
      await deleteEntry(entry.id)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to delete: ' + err.message)
    }
  }

  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2.5 text-sm
                    placeholder-appTextDisabled focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors`
  const labelCls = 'block mb-1.5 font-mono text-[10.5px] font-semibold text-appTextMuted uppercase tracking-[0.14em]'

  // A job's dot colour is its own colour, else its labor type's. Both lists
  // already include the entry's own (possibly archived) job/type from the
  // queries above, so editing an old entry never drops its reference.
  const laborColorOf = (id) => laborTypes?.find(lt => lt.id === Number(id))?.color
  const jobOptions = (jobs ?? []).map(j => ({
    value: String(j.id),
    label: j.name,
    sublabel: j.clientName || undefined,
    color: j.color || laborColorOf(j.laborTypeId),
  }))
  const laborOptions = (laborTypes ?? []).map(lt => ({
    value: String(lt.id),
    label: lt.name,
    color: lt.color,
    glyph: lt.glyph,
  }))

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={error ? errorId_ : undefined}
          className="w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden flex flex-col shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
            <h2 id={titleId} className="font-display font-semibold text-appText text-lg">
              {isEditMode ? (isActiveTimer ? 'Edit Active Timer' : 'Edit Entry') : 'Add Manual Entry'}
            </h2>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete entry"
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-appTextMuted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[85vh]">
            {/* Job — bespoke colour/client picker (replaces the native select) */}
            <EntitySelect
              label="Job"
              value={jobId}
              onChange={setJobId}
              options={jobOptions}
              placeholder="Select a job…"
            />

            {/* Labor type — bespoke glyph/colour picker */}
            <EntitySelect
              label="Labor type"
              value={laborTypeId}
              onChange={setLaborTypeId}
              options={laborOptions}
              placeholder="Select labor type…"
            />

            {/* Start Date */}
            <div className="space-y-1.5">
              <label htmlFor={startDate_} className={labelCls}>Start Date</label>
              <input
                id={startDate_}
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <label htmlFor={startTime_} className={labelCls}>Start Time</label>
              <input
                id={startTime_}
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* End Date */}
            {!isActiveTimer && (
              <div className="space-y-1.5">
                <label htmlFor={endDate_} className={labelCls}>End Date</label>
                <input
                  id={endDate_}
                  type="date"
                  value={endDateStr}
                  onChange={e => setEndDateStr(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {/* End Time */}
            {!isActiveTimer && (
              <div className="space-y-1.5">
                <label htmlFor={endTime_} className={labelCls}>End Time</label>
                <input
                  id={endTime_}
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor={notesId_} className={labelCls}>Notes</label>
              <input
                id={notesId_}
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you work on?"
                className={inputCls}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>

            {error && <p id={errorId_} role="alert" className="text-red-400 text-sm mt-1">{error}</p>}
          </div>

          {/* CTA */}
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={handleSave}
              className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                         text-appOnAccent font-display font-bold text-base transition-colors"
            >
              {isEditMode ? 'Save Changes' : 'Add Time Entry'}
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete this time entry?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
