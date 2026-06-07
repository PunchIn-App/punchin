import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'
import { db } from '../db'
import {
  getEntryDuration, getEntryDurationInRange, entryOverlapsRange,
  formatDurationHM, sumDurations,
} from '../utils/time'
import { LaborGlyphChip } from '../components/LaborGlyph'
import { formatMoney } from '../utils/format'
import { useSettings } from '../hooks/useSettings'

const TOOLTIP = {
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-secondary)',
  fontSize: '12px',
}

export default function AnalyticsView() {
  const [period, setPeriod] = useState('7d')
  const days = period === '7d' ? 7 : 30
  const { settings } = useSettings()

  // Anchor the window to the start of the earliest day shown rather than a
  // rolling `days`×24h instant. That way the chart's `days` calendar buckets
  // exactly cover the queried span, so total = sum of the buckets and the
  // Avg/day denominator (total/days) lines up with no off-by-one from a partial
  // leading day (issue #140).
  const startDate = startOfDay(subDays(new Date(), days - 1))

  // Indexed range query (issue #132): the `punchIn` index narrows to the period
  // window; the completed-only predicate (.and) runs on that small set, not the
  // whole table.
  const entries    = useLiveQuery(() => db.entries.where('punchIn').aboveOrEqual(startDate).and(e => !!e.punchOut).toArray(), [period])
  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])

  // Derive every chart dataset in one memo so the O(days×entries) bucketing and
  // the per-job / per-labor-type filter passes only re-run when the data or the
  // period changes, not on unrelated re-renders (issue #138).
  const { total, dailyData, jobData, ltData, earnings, ratedCount } = useMemo(() => {
    if (!entries || !jobs || !laborTypes) return { total: 0, dailyData: [], jobData: [], ltData: [], earnings: 0, ratedCount: 0 }

    const total = sumDurations(entries)

    // Billable earnings: hours × the job's per-labor-type rate. Entries with no
    // rate set are excluded; ratedCount lets the UI note "from N of M entries".
    const jobMap = new Map(jobs.map(j => [j.id, j]))
    let earnings = 0
    let ratedCount = 0
    for (const e of entries) {
      const rate = jobMap.get(e.jobId)?.laborRates?.[e.laborTypeId]
      if (rate != null) { earnings += (getEntryDuration(e) / 3600000) * rate; ratedCount++ }
    }

    // Daily bar chart. Each entry is clipped to the local day (issue #140) so a
    // shift that crosses midnight is split across both days instead of dumped
    // whole onto its start day — the same per-day clipping the timesheet totals
    // use. Durations are local-time elapsed ms, so a fixed 9–5 shift reads 7h or
    // 9h on the two DST changeover days each year: that's the real elapsed time
    // worked, surfaced intentionally rather than normalised away.
    const dailyData = Array.from({ length: days }, (_, i) => {
      const day  = subDays(new Date(), days - 1 - i)
      const ds   = startOfDay(day)
      const de   = endOfDay(day)
      const hrs  = entries
        .filter(e => entryOverlapsRange(e, ds, de))
        .reduce((a, e) => a + getEntryDurationInRange(e, ds, de), 0) / 3600000
      return { date: format(day, days === 7 ? 'EEE' : 'M/d'), hours: parseFloat(hrs.toFixed(2)) }
    })

    // Job breakdown
    const jobData = jobs.map(j => ({
      name: j.name,
      hours: parseFloat((entries.filter(e => e.jobId === j.id).reduce((a, e) => a + getEntryDuration(e), 0) / 3600000).toFixed(2)),
    })).filter(d => d.hours > 0).sort((a, b) => b.hours - a.hours)

    // Labor type pie
    const ltData = laborTypes.map(lt => ({
      name: lt.name,
      value: entries.filter(e => e.laborTypeId === lt.id).reduce((a, e) => a + getEntryDuration(e), 0),
      color: lt.color,
      glyph: lt.glyph,
    })).filter(d => d.value > 0)

    return { total, dailyData, jobData, ltData, earnings, ratedCount }
  }, [entries, jobs, laborTypes, days])

  if (!entries || !jobs || !laborTypes) {
    return (
      <div
        className="flex items-center justify-center h-full text-appTextMuted text-sm"
        aria-live="polite"
        aria-busy="true"
      >
        Loading…
      </div>
    )
  }

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-4 lg:max-w-5xl lg:mx-auto">
      {/* Period toggle */}
      <div className="flex gap-2" role="group" aria-label="Select analysis period">
        {['7d', '30d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${period === p ? 'bg-appAccent text-appOnAccent' : 'bg-appCard border border-appBorder text-appTextMuted'}`}>
            Last {p === '7d' ? '7 days' : '30 days'}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-1">Total logged</p>
          <p className="font-mono text-2xl font-semibold text-appText">{formatDurationHM(total)}</p>
        </div>
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-1">Avg / day</p>
          <p className="font-mono text-2xl font-semibold text-appText">
            {formatDurationHM((total / days) || 0)}
          </p>
        </div>
      </div>

      {/* Billable earnings — only when per-job rates are set (Analytics is hours-first) */}
      {ratedCount > 0 && (
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-1">Billable earnings</p>
          <p className="font-mono text-2xl font-semibold text-appText">{formatMoney(earnings, settings.defaultCurrency)}</p>
          {ratedCount < entries.length && (
            <p className="text-xs text-appTextMuted mt-1">From {ratedCount} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'} with a rate set</p>
          )}
        </div>
      )}

      {/* Daily chart */}
      <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
        <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4" id="daily-chart-label">Hours per day</p>
        <figure aria-labelledby="daily-chart-label" role="img"
          aria-label={`Bar chart: daily hours for the last ${days} days. Total: ${formatDurationHM(total)}.`}>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={dailyData} barCategoryGap="30%">
              <XAxis dataKey="date" tick={{ fill: 'var(--text-darker)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--bg-tertiary)' }}
                formatter={(v) => [`${v}h`, 'Hours']} />
              <Bar dataKey="hours" fill="rgb(var(--accent-rgb))" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="sr-only">
            <caption>Daily hours for the last {days} days</caption>
            <thead><tr><th scope="col">Day</th><th scope="col">Hours</th></tr></thead>
            <tbody>
              {dailyData.map(d => (
                <tr key={d.date}><td>{d.date}</td><td>{d.hours}h</td></tr>
              ))}
            </tbody>
          </table>
        </figure>
      </div>

      {/* Hours by job + Labor type — side by side on desktop */}
      {(jobData.length > 0 || ltData.length > 1) && (
        <div className="flex flex-col lg:flex-row gap-4">
          {jobData.length > 0 && (
            <div className="flex-1 min-w-0 rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
              <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4" id="job-chart-label">Hours by job</p>
              <figure aria-labelledby="job-chart-label" role="img"
                aria-label={`Bar chart: hours by job. Top job: ${jobData[0]?.name} with ${jobData[0]?.hours}h.`}>
                <ResponsiveContainer width="100%" height={Math.max(80, jobData.length * 44)}>
                  <BarChart data={jobData} layout="vertical" barCategoryGap="30%">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--bg-tertiary)' }}
                      formatter={(v) => [`${v}h`, 'Hours']} />
                    <Bar dataKey="hours" fill="rgb(var(--accent-rgb))" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table className="sr-only">
                  <caption>Hours by job</caption>
                  <thead><tr><th scope="col">Job</th><th scope="col">Hours</th></tr></thead>
                  <tbody>
                    {jobData.map(d => (
                      <tr key={d.name}><td>{d.name}</td><td>{d.hours}h</td></tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            </div>
          )}

          {ltData.length > 1 && (
            <div className="lg:w-72 flex-shrink-0 rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
              <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4" id="lt-chart-label">By labor type</p>
              <div className="flex items-center gap-5">
                <figure
                  className="flex-shrink-0 w-[100px] h-[100px]"
                  aria-labelledby="lt-chart-label"
                  role="img"
                  aria-label={`Donut chart: hours by labor type. ${ltData.map(d => `${d.name}: ${formatDurationHM(d.value)}`).join(', ')}.`}
                >
                  <PieChart width={100} height={100}>
                    <Pie data={ltData} cx={45} cy={45} innerRadius={28} outerRadius={44}
                      paddingAngle={2} dataKey="value" stroke="none">
                      {ltData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </figure>
                <div className="flex-1 space-y-2.5" aria-hidden="true">
                  {ltData.map(lt => (
                    <div key={lt.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <LaborGlyphChip laborType={lt} className="w-4 h-4" />
                        <span className="text-xs text-appTextMuted truncate">{lt.name}</span>
                      </div>
                      <span className="font-mono text-xs text-appText flex-shrink-0">{formatDurationHM(lt.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <div className="flex flex-col items-center py-10 text-appTextDisabled">
          <p className="text-sm">No completed entries in this period.</p>
          <p className="text-xs mt-1">Punch in and out to see analytics.</p>
        </div>
      )}
    </div>
  )
}
