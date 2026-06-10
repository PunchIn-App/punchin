import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play } from 'lucide-react'
import { db } from '../db'
import { formatDurationHM, formatTime, getWeekRange, isEntryInRange, getEntryDuration } from '../utils/time'
import { DEFAULT_JOB_COLOR } from '../accentPresets'

// The Timer screen's desktop-only right rail (xl+): Last session · Quick punch ·
// This week. Co-located with the Timer view (not the Layout shell) since its
// content is Timer-specific and the data lives here.

function Overline({ children }) {
  return (
    <p className="ds-overline text-appTextMuted mb-2">{children}</p>
  )
}

export default function TimerRail({ jobMap, ltMap, recentJobs, lastEntry, weekStartsMonday, timeFormat, onPunch }) {
  // Current-week range. The query window reaches back a day to mirror the
  // TimesheetsView range pattern (#132/#136); since the aggregation below filters
  // on punchIn only, those look-back rows are simply dropped (inert here, but it
  // keeps the index-bounded query identical to the timesheet one).
  const week = useMemo(() => {
    const { start, end } = getWeekRange(new Date(), weekStartsMonday)
    const queryStart = new Date(start.getTime() - 24 * 60 * 60 * 1000) // 1-day look-back margin (#136)
    return { start, end, queryStart }
  }, [weekStartsMonday])

  // Indexed range query (issue #132): bounded to one week off the `punchIn` index
  // instead of scanning all history on the most-visited screen.
  const completed = useLiveQuery(
    () => db.entries
      .where('punchIn').between(week.queryStart, week.end, true, true)
      .filter(e => !!e.punchOut)
      .toArray(),
    [week.queryStart.getTime(), week.end.getTime()]
  )

  const summary = useMemo(() => {
    if (!completed) return null
    // Keep only entries whose punchIn falls in the real week (drops the look-back margin).
    const inWeek = completed.filter(e => isEntryInRange(e, week.start, week.end))
    const totalMs = inWeek.reduce((s, e) => s + getEntryDuration(e), 0)
    const byJob = new Map()
    for (const e of inWeek) byJob.set(e.jobId, (byJob.get(e.jobId) || 0) + getEntryDuration(e))
    const top = [...byJob.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    const maxMs = top.length ? top[0][1] : 1
    return { totalMs, top, maxMs }
  }, [completed, week.start, week.end])

  const quickJobs = recentJobs ?? []

  return (
    <aside
      aria-label="Timer overview"
      className="hidden xl:flex xl:flex-col xl:w-[304px] flex-shrink-0 border-l border-appBorder scrollable"
    >
      <div className="p-5 space-y-7">
        {/* Last session — lead with the big duration, "<labor> · ended <time>" */}
        {lastEntry && (() => {
          const job = jobMap.get(lastEntry.jobId)
          const lt = ltMap.get(lastEntry.laborTypeId)
          const color = lt?.color || DEFAULT_JOB_COLOR
          return (
            <section>
              <Overline>Last session</Overline>
              <div className="rounded-xl border border-appBorder bg-appCard p-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                  <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || 'Unknown Job'}</p>
                </div>
                <p className="font-mono text-2xl text-appText mt-1.5">{formatDurationHM(getEntryDuration(lastEntry))}</p>
                <p className="text-xs text-appTextMuted mt-0.5 truncate">
                  {lt?.name ? `${lt.name} · ` : ''}ended {formatTime(lastEntry.punchOut, timeFormat)}
                </p>
              </div>
            </section>
          )
        })()}

        {/* Quick punch — the 3 most recently used jobs; labor dot + job/labor
            two-line + filled accent play. Tapping opens the sheet (you pick the task). */}
        {quickJobs.length > 0 && (
          <section>
            <Overline>Quick punch</Overline>
            <div className="space-y-1.5">
              {quickJobs.map(job => {
                const jlt = ltMap.get(job.laborTypeId)
                return (
                  <button
                    key={job.id}
                    onClick={() => onPunch(job)}
                    aria-label={`Punch in: ${job.name}`}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-appCard border border-appBorder
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

        {/* This week — total in the overline + per-job progress bars (job colour) */}
        <section>
          <Overline>This week{summary ? ` · ${formatDurationHM(summary.totalMs)}` : ''}</Overline>
          {summary && summary.top.length > 0 ? (
            <div className="space-y-2.5">
              {summary.top.map(([jobId, ms]) => {
                const job = jobMap.get(jobId)
                const jlt = job && ltMap.get(job.laborTypeId)
                const pct = Math.max(4, Math.round((ms / summary.maxMs) * 100))
                return (
                  <div key={jobId}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="text-appText truncate">{job?.name || 'Unknown'}</span>
                      <span className="font-mono text-appTextMuted flex-shrink-0">{formatDurationHM(ms)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-appInput overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: jlt?.color || 'var(--accent)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-appTextMuted">No time tracked yet.</p>
          )}
        </section>
      </div>
    </aside>
  )
}
