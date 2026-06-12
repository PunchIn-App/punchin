import { useState, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Play } from 'lucide-react'
import { db } from '../db'
import TimerCard from '../components/TimerCard'
import StartTimerModal from '../components/StartTimerModal'
import TimerRail from '../components/TimerRail'
import { LaborTag } from '../components/LaborGlyph'
import { PunchMark } from '../components/BrandMark'
import { DEFAULT_JOB_COLOR } from '../accentPresets'
import { useSettings } from '../hooks/useSettings'
import { useNowTicker } from '../hooks/useNowTicker'
import { formatDurationHM, formatTime, formatDate, getDayRange, getWeekRange, getEntryDurationInRange } from '../utils/time'

// A compact stat tile (TODAY / THIS WEEK / AVG·DAY) under the header.
function StatTile({ label, value, className = '' }) {
  return (
    <div className={`rounded-xl border border-appBorder bg-appCard px-4 py-3 ${className}`}>
      <p className="ds-overline text-appTextMuted">{label}</p>
      <p className="font-mono text-2xl font-extrabold text-appText mt-1">{value}</p>
    </div>
  )
}

export default function TimerView() {
  const [showModal, setShowModal] = useState(false)
  const [quickJobId, setQuickJobId] = useState(null)
  const { settings } = useSettings()

  const active     = useLiveQuery(() => db.entries.filter(e => !e.punchOut).toArray(), [])
  const completed  = useLiveQuery(() => db.entries.filter(e => !!e.punchOut).toArray(), [])
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

  // Header stat tiles: today / this-week totals (clipped to each window) and a
  // simple per-day average across the 7-day week. Running timers are INCLUDED and
  // valued at a ticking `now`, so the tiles update live instead of going stale
  // until punch-out (issue #265). The ticker only runs while a timer is active.
  const now = useNowTicker((active?.length ?? 0) > 0, 1000)
  const stats = useMemo(() => {
    if (!completed || !active) return null
    const { start: ds, end: de } = getDayRange()
    const { start: ws, end: we } = getWeekRange(new Date(), settings.weekStartsMonday)
    const all = [...completed, ...active]
    const today = all.reduce((s, e) => s + getEntryDurationInRange(e, ds, de, now), 0)
    const week  = all.reduce((s, e) => s + getEntryDurationInRange(e, ws, we, now), 0)
    return { today, week, avg: week / 7 }
  }, [completed, active, settings.weekStartsMonday, now])

  // The rail's quick-punch shortcuts are the 3 most recently used jobs (by last
  // punch-in, de-duplicated, active only). A fresh account with no punches yet
  // falls back to a few active jobs so the shortcut isn't empty.
  const recentJobs = useMemo(() => {
    const all = [...(active ?? []), ...(completed ?? [])]
      .filter(e => e.punchIn)
      .sort((a, b) => new Date(b.punchIn) - new Date(a.punchIn))
    const seen = new Set()
    const out = []
    for (const e of all) {
      if (seen.has(e.jobId)) continue
      seen.add(e.jobId)
      const job = jobMap.get(e.jobId)
      if (job && job.isActive !== false) out.push(job)
      if (out.length === 3) break
    }
    return out.length > 0 ? out : (jobs ?? []).filter(j => j.isActive !== false).slice(0, 3)
  }, [active, completed, jobMap, jobs])

  // Quick-punch opens the Start Timer sheet preselected to the job with NO task
  // chosen, so the user picks the labor type before punching in.
  const handleQuickPunch = (job) => setQuickJobId(job.id)

  // Stable identity: the live #265 ticker re-renders this view every second while
  // a timer runs, and the open Start Timer sheet subscribes to onClose — an
  // unmemoised handler would re-subscribe its listeners each tick (issue #276).
  const closeModal = useCallback(() => { setShowModal(false); setQuickJobId(null) }, [])

  return (
    <div className="h-full flex flex-col xl:flex-row">
      <div className="flex-1 min-w-0 scrollable">
        <div className="px-4 pt-4 pb-24 lg:px-6">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display font-extrabold text-appText text-2xl leading-none">On the clock</h1>
            <p className="text-appTextMuted text-sm mt-1" aria-live="polite">
              <span className="hidden lg:inline">{formatDate(new Date())} · </span>
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
                       text-appOnAccent font-display font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            PunchIn
          </button>
        </div>

        {/* Stat tiles */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <StatTile label="Today" value={formatDurationHM(stats.today)} />
            <StatTile label="This week" value={formatDurationHM(stats.week)} />
            <StatTile label="Avg / day" value={formatDurationHM(stats.avg)} className="hidden sm:block" />
          </div>
        )}

        {/* Quick punch (phone + tablet; the xl rail carries it on desktop) — the
            3 most recently used jobs. Tapping opens the sheet so the user picks
            the task, matching the rail's behaviour. */}
        {recentJobs.length > 0 && (
          <section className="mb-6 xl:hidden">
            <p className="ds-overline text-appTextMuted mb-2">Quick punch</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {recentJobs.map(job => {
                const jlt = ltMap.get(job.laborTypeId)
                return (
                  <button
                    key={job.id}
                    onClick={() => handleQuickPunch(job)}
                    aria-label={`Punch in: ${job.name}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-appCard border border-appBorder
                               hover:bg-appInput text-left transition-colors
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: jlt?.color || DEFAULT_JOB_COLOR }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-appText truncate">{job.name}</span>
                      {jlt && <span className="block text-[11px] text-appTextMuted truncate">{jlt.name}</span>}
                    </span>
                    <span className="flex-shrink-0 w-7 h-7 rounded-md bg-appAccent/15 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-appAccent fill-current" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {active?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <PunchMark accent={settings.accentColor} className="w-20 h-20 rounded-2xl shadow-lg shadow-appAccent/30" glyphClassName="w-10 h-10" />
              <div className="absolute -inset-2 rounded-[28px] border border-dashed border-appAccent/40" aria-hidden="true" />
            </div>
            <p className="font-display font-semibold text-appTextMuted text-xl">Nothing running</p>
            <p className="text-appTextDisabled text-sm mt-1.5">Tap Punch In to start tracking time</p>
          </div>
        )}

        {/* Active timers */}
        {active && active.length > 0 && (
          <p className="ds-overline text-appTextMuted mb-2">Active · {active.length}</p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {active?.map(entry => (
            <TimerCard
              key={entry.id}
              entry={entry}
              job={getJob(entry.jobId)}
              laborType={getLT(entry.laborTypeId)}
            />
          ))}
        </div>

        {/* Last completed session (phone/tablet; the xl rail shows it on desktop) */}
        {lastEntry && (() => {
          const job = getJob(lastEntry.jobId)
          const lt  = getLT(lastEntry.laborTypeId)
          const color = lt?.color || DEFAULT_JOB_COLOR
          const duration = new Date(lastEntry.punchOut) - new Date(lastEntry.punchIn)
          return (
            <div className="mt-8 xl:hidden">
              <p className="ds-overline text-appTextMuted mb-2">Last Session</p>
              <div className="relative rounded-xl border border-appBorder bg-appCard overflow-hidden opacity-70">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                <div className="pl-5 pr-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || 'Unknown Job'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <LaborTag laborType={lt} />
                      <span className="text-xs text-appTextMuted font-mono">
                        {formatTime(lastEntry.punchIn, settings.timeFormat)} – {formatTime(lastEntry.punchOut, settings.timeFormat)}
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
      </div>

      <TimerRail
        jobMap={jobMap}
        ltMap={ltMap}
        recentJobs={recentJobs}
        lastEntry={lastEntry}
        weekStartsMonday={settings.weekStartsMonday}
        timeFormat={settings.timeFormat}
        onPunch={handleQuickPunch}
      />

      {(showModal || quickJobId != null) && (
        <StartTimerModal initialJobId={quickJobId} onClose={closeModal} />
      )}
    </div>
  )
}
