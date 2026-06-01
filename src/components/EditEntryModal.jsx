import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

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
  const jobs       = useLiveQuery(() => db.jobs.filter(j => (j.isActive !== false && j.isDeleted !== true) || j.id === entry?.jobId).toArray(), [entry])
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
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      try {
        await db.entries.delete(entry.id)
        onClose()
      } catch (err) {
        console.error(err)
        setError('Failed to delete: ' + err.message)
      }
    }
  }

  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2.5 text-sm
                    placeholder-appTextDisabled focus:outline-none focus:border-amber-500/60 transition-colors`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
          <h2 className="font-display font-semibold text-appText text-lg">
            {isEditMode ? (isActiveTimer ? 'Edit Active Timer' : 'Edit Entry') : 'Add Manual Entry'}
          </h2>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                onClick={handleDelete}
                title="Delete Entry"
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-appTextMuted hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Job Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Job</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)} className={inputCls}>
              <option value="">Select a job...</option>
              {jobs?.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>

          {/* Labor Type Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Labor Type</label>
            <select value={laborTypeId} onChange={e => setLaborTypeId(e.target.value)} className={inputCls}>
              <option value="">Select labor type...</option>
              {laborTypes?.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
            </select>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            {!isActiveTimer && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">End Date</label>
                <input
                  type="date"
                  value={endDateStr}
                  onChange={e => setEndDateStr(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </div>
          {!isActiveTimer && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on?"
              className={inputCls}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                       text-[#0F1117] font-display font-bold text-base transition-colors"
          >
            {isEditMode ? 'Save Changes' : 'Add Time Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
