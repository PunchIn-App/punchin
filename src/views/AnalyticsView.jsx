import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'
import { db } from '../db'
import { getEntryDuration, formatDurationHM, sumDurations } from '../utils/time'

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

  const startDate = subDays(new Date(), days)

  const entries    = useLiveQuery(() => db.entries.filter(e => new Date(e.punchIn) >= startDate && !!e.punchOut).toArray(), [period])
  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])

  if (!entries || !jobs || !laborTypes) {
    return <div className="flex items-center justify-center h-full text-appTextDisabled text-sm">Loading...</div>
  }

  const total = sumDurations(entries)
  const totalHours = total / 3600000

  // Daily bar chart
  const dailyData = Array.from({ length: days }, (_, i) => {
    const day  = subDays(new Date(), days - 1 - i)
    const ds   = startOfDay(day)
    const de   = endOfDay(day)
    const hrs  = entries
      .filter(e => { const d = new Date(e.punchIn); return d >= ds && d <= de })
      .reduce((a, e) => a + getEntryDuration(e), 0) / 3600000
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
  })).filter(d => d.value > 0)

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-4">
      {/* Period toggle */}
      <div className="flex gap-2">
        {['7d', '30d'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${period === p ? 'bg-appAccent text-[#0F1117]' : 'bg-appCard border border-appBorder text-appTextMuted'}`}>
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

      {/* Daily chart */}
      <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
        <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4">Hours per day</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={dailyData} barCategoryGap="30%">
            <XAxis dataKey="date" tick={{ fill: 'var(--text-darker)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--bg-tertiary)' }}
              formatter={(v) => [`${v}h`, 'Hours']} />
            <Bar dataKey="hours" fill="rgb(var(--accent-rgb))" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hours by job */}
      {jobData.length > 0 && (
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4">Hours by job</p>
          <ResponsiveContainer width="100%" height={Math.max(80, jobData.length * 44)}>
            <BarChart data={jobData} layout="vertical" barCategoryGap="30%">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'var(--bg-tertiary)' }}
                formatter={(v) => [`${v}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#6366F1" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Labor type donut */}
      {ltData.length > 1 && (
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] text-appTextMuted uppercase tracking-widest mb-4">By labor type</p>
          <div className="flex items-center gap-5">
            <PieChart width={100} height={100}>
              <Pie data={ltData} cx={45} cy={45} innerRadius={28} outerRadius={44}
                paddingAngle={2} dataKey="value" stroke="none">
                {ltData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2.5">
              {ltData.map(lt => (
                <div key={lt.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
                    <span className="text-xs text-appTextMuted truncate">{lt.name}</span>
                  </div>
                  <span className="font-mono text-xs text-appText flex-shrink-0">{formatDurationHM(lt.value)}</span>
                </div>
              ))}
            </div>
          </div>
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
