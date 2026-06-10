import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { X, Play, Check, ChevronDown } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, startTimer } from '../db'
import { useSettings } from '../hooks/useSettings'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useSwipeDismiss, useAndroidBackDismiss, useSheetStyles } from '../hooks/useBottomSheet'
import { glyphComponent, DEFAULT_LABOR_COLOR } from './LaborGlyph'

export default function StartTimerModal({ onClose, initialJobId = null }) {
  const [jobId, setJobId]             = useState(initialJobId ? String(initialJobId) : '')
  const [laborTypeId, setLaborTypeId] = useState('')
  const [notes, setNotes]             = useState('')
  const [error, setError]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [jobMenuOpen, setJobMenuOpen] = useState(false)
  // Listbox roving tabindex: which option is the active (tabbable, focused) one.
  const [activeJobIndex, setActiveJobIndex] = useState(-1)

  const uid = useId()
  const titleId   = `${uid}-title`
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

  // Swipe-down-to-dismiss on ANY touch platform, not just installed iOS — the
  // drag handle is shown on iOS+Android standalone, and a user dragging it
  // expects it to close (issue: the sheet ignored the handle on Android/web).
  // hapticTrigger already self-noops off-iOS, and desktop fires no touch events,
  // so this is inert where it shouldn't act.
  const swipeRef = useSwipeDismiss(stableClose, hapticTrigger)
  useAndroidBackDismiss(
    isStandalone && os === 'android' ? stableClose : noopClose,
    isStandalone && os === 'android' ? hapticTrigger : noopHaptic,
  )

  const { scrim, sheet, handle } = useSheetStyles(isStandalone, os)

  // Focus trap, Escape, and focus restoration (issues #151/#152/#154)
  useFocusTrap(swipeRef, stableClose)

  // Selecting a job auto-fills its default labor type (the chip lights up) — but
  // NOT for a job preselected via initialJobId (quick-punch opens the sheet with
  // no task so the user picks it). Subsequent manual job changes still auto-fill.
  const skipInitialLabor = useRef(initialJobId != null)
  useEffect(() => {
    if (!jobId || !jobs) return
    if (skipInitialLabor.current) { skipInitialLabor.current = false; return }
    const job = jobs.find(j => j.id === Number(jobId))
    if (job?.laborTypeId) setLaborTypeId(String(job.laborTypeId))
  }, [jobId, jobs])

  // Job picker popover: outside-click + capture-phase Escape so closing the menu
  // doesn't fall through to the modal's Escape→onClose (same contract as the
  // ColorPicker / GlyphPicker popovers, issue #155).
  const jobWrapRef = useRef(null)
  const jobTriggerRef = useRef(null)   // refocus target on job select/Escape (WCAG 2.4.3)
  const jobOptionRefs = useRef([])      // one <button role="option"> per job, for roving focus
  const laborRadioRefs = useRef([])     // one <button role="radio"> per labor type, for roving focus
  useEffect(() => {
    if (!jobMenuOpen) return
    const onOutside = (e) => {
      if (jobWrapRef.current && !jobWrapRef.current.contains(e.target)) setJobMenuOpen(false)
    }
    const onEscape = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      setJobMenuOpen(false)
      // Restore focus to the job trigger before the menu unmounts so focus doesn't
      // drop to <body> (WCAG 2.4.3). The trigger node stays mounted.
      jobTriggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [jobMenuOpen])

  // Listbox keyboard model (WAI-ARIA APG): on open, move focus INTO the listbox,
  // landing on the selected option (else the first). Roving tabindex + focus then
  // follow activeJobIndex (set by the arrow/Home/End handler below).
  useEffect(() => {
    if (!jobMenuOpen || !jobs?.length) return
    const selIdx = jobs.findIndex(j => j.id === Number(jobId))
    setActiveJobIndex(selIdx >= 0 ? selIdx : 0)
  }, [jobMenuOpen, jobs, jobId])

  // Drive focus onto the active option whenever it changes while the menu is open.
  useEffect(() => {
    if (!jobMenuOpen || activeJobIndex < 0) return
    jobOptionRefs.current[activeJobIndex]?.focus()
  }, [jobMenuOpen, activeJobIndex])

  // Arrow / Home / End navigation inside the job listbox (no wrap at the ends).
  // Enter/Space fall through to the option's native onClick (select + close).
  const onJobListKeyDown = (e) => {
    const count = jobs?.length ?? 0
    if (!count) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveJobIndex(i => Math.min((i < 0 ? -1 : i) + 1, count - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveJobIndex(i => Math.max((i < 0 ? count : i) - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActiveJobIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveJobIndex(count - 1)
        break
      default:
        break
    }
  }

  // Radiogroup keyboard model (WAI-ARIA APG): arrow keys move the selection (in a
  // radio group, moving focus selects), wrapping at the ends; Home/End jump to the
  // first/last. The chips are laid out horizontally, so Right/Left are primary, but
  // Up/Down are accepted too. Space/Enter still select via the native button click.
  const onLaborRadioKeyDown = (e) => {
    const count = laborTypes?.length ?? 0
    if (!count) return
    const cur = laborTypes.findIndex(lt => lt.id === Number(laborTypeId))
    let next = cur
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        next = cur < 0 ? 0 : (cur + 1) % count          // wrap forward
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        next = cur < 0 ? count - 1 : (cur - 1 + count) % count  // wrap back
        break
      case 'Home':
        e.preventDefault()
        next = 0
        break
      case 'End':
        e.preventDefault()
        next = count - 1
        break
      default:
        return
    }
    setLaborTypeId(String(laborTypes[next].id))
    laborRadioRefs.current[next]?.focus()
  }

  const handleStart = async () => {
    setError('')
    if (!jobId)       { setError('Please select a job'); return }
    if (!laborTypeId) { setError('Please select a labor type'); return }

    // Fire synchronously in the gesture context — iOS Taptic no-ops otherwise.
    hapticTrigger()
    setSubmitting(true)
    try {
      await startTimer({
        jobId,
        laborTypeId,
        notes: notes.trim() || null,
        allowConcurrentTimers: settings.allowConcurrentTimers,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  // A job's dot colour is its own colour, else its labor type's, else neutral.
  const laborColorOf = (id) => laborTypes?.find(lt => lt.id === Number(id))?.color
  const jobDotColor  = (job) => job?.color || laborColorOf(job?.laborTypeId) || DEFAULT_LABOR_COLOR

  const selectedJob = jobs?.find(j => j.id === Number(jobId)) || null
  const jobTriggerName = selectedJob
    ? `Job, ${selectedJob.name}${selectedJob.clientName ? ', ' + selectedJob.clientName : ''}`
    : 'Job, none selected'

  // Mono uppercase overline — the design system's field-label treatment (.pcm-lbl).
  const overlineCls = 'block mb-2 ds-overline text-appTextMuted'
  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-xl px-4 py-3 text-[14.5px]
                    placeholder-appTextPlaceholder focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors`

  return (
    // Tap the backdrop (the scrim itself, not a bubbled click from the sheet) to
    // dismiss — matches the ConfirmModal idiom and every platform's expectation.
    <div className={scrim} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
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

        {/* Header — title + subtitle, bordered close affordance */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-appBorder">
          <div>
            <h2 id={titleId} className="font-display font-extrabold text-appText text-[22px] tracking-tight leading-tight">Start Timer</h2>
            <p className="text-[13px] text-appTextMuted mt-0.5">Pick a job and what you're working on</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 p-2 rounded-lg border border-appBorder bg-appBg text-appTextMuted hover:bg-appInput transition-colors"
          >
            <X className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          {/* Job — custom combobox (colour dot + client line, beyond a native select) */}
          <div>
            <span className={overlineCls} aria-hidden="true">Job</span>
            <div ref={jobWrapRef} className="relative">
              <button
                ref={jobTriggerRef}
                type="button"
                onClick={() => setJobMenuOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={jobMenuOpen}
                aria-label={jobTriggerName}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-appBg text-left transition-colors
                  ${jobMenuOpen ? 'border-appAccent ring-2 ring-appAccent/20' : 'border-appBorder hover:border-appAccent/40'}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedJob ? jobDotColor(selectedJob) : 'var(--text-disabled)' }}
                  aria-hidden="true"
                />
                {selectedJob ? (
                  <>
                    <span className="text-[15px] font-bold text-appText truncate">{selectedJob.name}</span>
                    {selectedJob.clientName && (
                      <span className="text-xs text-appTextMuted truncate">{selectedJob.clientName}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[15px] text-appTextMuted">Select a job…</span>
                )}
                <ChevronDown
                  className={`w-[18px] h-[18px] ml-auto flex-shrink-0 text-appTextMuted transition-transform ${jobMenuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {jobMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Job"
                  onKeyDown={onJobListKeyDown}
                  className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-1.5 max-h-60 overflow-y-auto"
                >
                  {jobs?.length ? jobs.map((j, i) => {
                    const sel = j.id === Number(jobId)
                    return (
                      <button
                        key={j.id}
                        ref={el => { jobOptionRefs.current[i] = el }}
                        type="button"
                        role="option"
                        aria-selected={sel}
                        // Roving tabindex: only the active option is tab-reachable.
                        tabIndex={i === activeJobIndex ? 0 : -1}
                        // Selecting a job unmounts the menu — refocus the (still-mounted)
                        // trigger first or focus falls to <body> (WCAG 2.4.3).
                        onClick={() => { setJobId(String(j.id)); setJobMenuOpen(false); jobTriggerRef.current?.focus() }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-appInput transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: jobDotColor(j) }} aria-hidden="true" />
                        <span className="text-sm font-bold text-appText truncate">{j.name}</span>
                        {j.clientName && <span className="text-xs text-appTextMuted truncate">{j.clientName}</span>}
                        {sel && <Check className="w-4 h-4 ml-auto flex-shrink-0 text-appAccent" aria-hidden="true" />}
                      </button>
                    )
                  }) : (
                    <p className="px-3 py-2 text-xs text-appTextMuted">No active jobs — add one first.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Labor type — selectable chips (radiogroup), each carrying its glyph */}
          <div>
            <span className={overlineCls} id={`${uid}-lt`}>Labor type</span>
            {laborTypes === undefined ? null : laborTypes.length === 0 ? (
              <p className="text-xs text-appTextMuted">No labor types yet — add one in Jobs.</p>
            ) : (
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby={`${uid}-lt`}
                onKeyDown={onLaborRadioKeyDown}
              >
                {(() => {
                  // Roving tabindex: exactly one radio is tabbable — the checked one,
                  // or the first when none is checked yet.
                  const checkedIdx = laborTypes.findIndex(lt => lt.id === Number(laborTypeId))
                  const tabbableIdx = checkedIdx >= 0 ? checkedIdx : 0
                  return laborTypes.map((lt, i) => {
                  const sel = lt.id === Number(laborTypeId)
                  const color = lt.color || DEFAULT_LABOR_COLOR
                  const Glyph = glyphComponent(lt.glyph)
                  return (
                    <button
                      key={lt.id}
                      ref={el => { laborRadioRefs.current[i] = el }}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      tabIndex={i === tabbableIdx ? 0 : -1}
                      onClick={() => setLaborTypeId(String(lt.id))}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border text-[13.5px] font-semibold transition-colors
                        ${sel ? 'border-transparent' : 'border-appBorder text-appTextMuted hover:text-appText hover:border-appBorderLight'}`}
                      style={sel ? { backgroundColor: `${color}22`, borderColor: `${color}99`, color } : undefined}
                    >
                      <Glyph className="w-4 h-4 flex-shrink-0" style={{ color }} strokeWidth={2} aria-hidden="true" />
                      {lt.name}
                    </button>
                  )
                  })
                })()}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor={notesId_} className={overlineCls}>
              Notes <span className="text-appTextMuted normal-case font-normal tracking-normal">· optional</span>
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
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={handleStart}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[13px] bg-appAccent
                       text-appOnAccent font-display font-bold text-base shadow-[var(--shadow-accent)]
                       hover:brightness-110 active:brightness-90 transition
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 flex-shrink-0" fill="currentColor" aria-hidden="true" />
            {submitting ? 'Starting…' : 'PunchIn'}
          </button>
        </div>

      </div>
    </div>
  )
}
