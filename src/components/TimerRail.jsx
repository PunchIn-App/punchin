import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play } from 'lucide-react'
import { db } from '../db'
import { LaborTag } from './LaborGlyph'
import { formatDurationHM, formatTime, getWeekRange, isEntryInRange, getEntryDuration } from '../utils/time'

// The Timer screen's desktop-only right rail (xl+): Last session · Quick punch ·
// This week. Co-located with the Timer view (not the Layout shell) since its
// content is Timer-specific and the data lives here.

function Overline({ children }) {
  return (
    <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mb-2">{children}</p>
  )
}

export default function TimerRail({ jobMap, ltMap, jobs, lastEntry, weekStartsMonday, onPunch }) {
  const completed = useLiveQuery(() => db.entries.filter(e => !!e.punchOut).toArray(), [])

  const week = useMemo(() => {
    if (!completed) return null
    const { start, end } = getWeekRange(new Date(), weekStartsMonday)
    const inWeek = completed.filter(e => isEntryInRange(e, start, end))
    const totalMs = inWeek.reduce((s, e) => s + getEntryDuration(e), 0)
    const byJob = new Map()
    for (const e of inWeek) byJob.set(e.jobId, (byJob.get(e.jobId) || 0) + getEntryDuration(e))
    const top = [...byJob.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    return { totalMs, top }
  }, [completed, weekStartsMonday])

  const activeJobs = (jobs ?? []).filter(j => j.isActive !== false).slice(0, 6)

  return (
    <aside
      aria-label="Timer overview"
      className="hidden xl:flex xl:flex-col xl:w-[304px] flex-shrink-0 border-l border-appBorder scrollable"
    >
      <div className="p-5 space-y-7">
        {/* Last session */}
        {lastEntry && (() => {
          const job = jobMap.get(lastEntry.jobId)
          const lt = ltMap.get(lastEntry.laborTypeId)
          const color = lt?.color || '#6366F1'
          return (
            <section>
              <Overline>Last session</Overline>
              <div className="relative rounded-xl border border-appBorder bg-appCard overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                <div className="pl-4 pr-3 py-3">
                  <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || 'Unknown Job'}</p>
                  {lt && <LaborTag laborType={lt} className="mt-1" />}
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span className="text-xs text-appTextMuted font-mono truncate">
                      {formatTime(lastEntry.punchIn)}–{formatTime(lastEntry.punchOut)}
                    </span>
                    <span className="font-mono text-appTextMuted text-xs flex-shrink-0">{formatDurationHM(getEntryDuration(lastEntry))}</span>
                  </div>
                </div>
              </div>
            </section>
          )
        })()}

        {/* Quick punch */}
        {activeJobs.length > 0 && (
          <section>
            <Overline>Quick punch</Overline>
            <div className="space-y-1.5">
              {activeJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => onPunch(job)}
                  aria-label={`Punch in: ${job.name}`}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-appCard border border-appBorder
                             hover:border-appAccent/50 hover:bg-appInput text-left transition-colors group
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent"
                >
                  <span className="text-sm text-appText truncate">{job.name}</span>
                  <Play className="w-4 h-4 text-appTextMuted group-hover:text-appAccent flex-shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* This week */}
        <section>
          <Overline>This week</Overline>
          <div className="rounded-xl border border-appBorder bg-appCard p-4">
            <p className="font-mono text-2xl text-appText tabular-nums">{week ? formatDurationHM(week.totalMs) : '—'}</p>
            <p className="text-xs text-appTextMuted mt-0.5">tracked this week</p>
            {week && week.top.length > 0 && (
              <div className="mt-3 pt-3 border-t border-appBorderLight space-y-1.5">
                {week.top.map(([jobId, ms]) => (
                  <div key={jobId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-appTextMuted truncate">{jobMap.get(jobId)?.name || 'Unknown'}</span>
                    <span className="font-mono text-appText flex-shrink-0">{formatDurationHM(ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
