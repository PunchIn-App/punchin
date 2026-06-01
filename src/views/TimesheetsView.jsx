import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, addDays, subDays, addWeeks, subWeeks } from 'date-fns'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import {
  formatDurationHM, formatTime, getEntryDuration,
  getDayRange, getWeekRange, getWeekDays,
  isEntryInRange, sumDurations,
} from '../utils/time'

function DailySheet({ date, jobs, laborTypes }) {
  const { start, end } = getDayRange(date)
  const entries = useLiveQuery(
    () => db.entries.filter(e => isEntryInRange(e, start, end)).toArray(),
    [start.getTime()]
  )
  const getJob = id => jobs?.find(j => j.id === id)
  const getLT  = id => laborTypes?.find(l => l.id === id)

  if (!entries) return null

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-xl bg-[#161923] border border-[#2A2F45] px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-[#6B7280]">Total</span>
        <span className="font-mono font-semibold text-white text-lg">{formatDurationHM(sumDurations(entries))}</span>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-[#374151]">
          <Calendar className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No entries this day</p>
        </div>
      ) : (
        entries.map(entry => {
          const job = getJob(entry.jobId)
          const lt  = getLT(entry.laborTypeId)
          const dur = getEntryDuration(entry)
          return (
            <div key={entry.id} className="rounded-xl border border-[#2A2F45] bg-[#161923] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-white text-sm truncate">{job?.name || '—'}</p>
                  {lt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block"
                      style={{ backgroundColor: `${lt.color}25`, color: lt.color }}>
                      {lt.name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-white font-semibold text-sm">{formatDurationHM(dur)}</p>
                  <p className="text-[#4B5563] text-xs">
                    {formatTime(entry.punchIn)} → {entry.punchOut ? formatTime(entry.punchOut) : 'running'}
                  </p>
                </div>
              </div>
              {entry.notes && <p className="mt-2 text-xs text-[#6B7280]">{entry.notes}</p>}
            </div>
          )
        })
      )}
    </div>
  )
}

function WeeklySheet({ date, jobs, laborTypes }) {
  const { settings } = useSettings()
  const wsMon = settings?.weekStartsMonday !== false
  const { start, end } = getWeekRange(date, wsMon)
  const days = getWeekDays(date, wsMon)

  const allEntries = useLiveQuery(
    () => db.entries.filter(e => isEntryInRange(e, start, end)).toArray(),
    [start.getTime()]
  )
  const getJob = id => jobs?.find(j => j.id === id)
  const getLT  = id => laborTypes?.find(l => l.id === id)
  if (!allEntries) return null

  const total = sumDurations(allEntries)
  const jobTotals = allEntries.reduce((acc, e) => {
    acc[e.jobId] = (acc[e.jobId] || 0) + getEntryDuration(e)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {/* Week total */}
      <div className="rounded-xl bg-[#161923] border border-[#2A2F45] px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-[#6B7280]">Week total</span>
        <span className="font-mono font-semibold text-white text-lg">{formatDurationHM(total)}</span>
      </div>

      {/* Job breakdown */}
      {Object.keys(jobTotals).length > 0 && (
        <div className="rounded-xl border border-[#2A2F45] bg-[#161923] divide-y divide-[#1E2232]">
          {Object.entries(jobTotals).sort((a,b) => b[1]-a[1]).map(([jid, ms]) => {
            const job = getJob(Number(jid))
            const pct = total > 0 ? (ms / total) * 100 : 0
            return (
              <div key={jid} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white font-medium">{job?.name || '—'}</span>
                  <span className="font-mono text-sm text-[#9CA3AF]">{formatDurationHM(ms)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#0F1117]">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Day-by-day */}
      {days.map(day => {
        const ds = new Date(day); ds.setHours(0,0,0,0)
        const de = new Date(day); de.setHours(23,59,59,999)
        const dayEntries = allEntries.filter(e => isEntryInRange(e, ds, de))
        const dayTotal   = sumDurations(dayEntries)
        const isToday    = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

        return (
          <div key={day.toISOString()}
            className={`rounded-xl border bg-[#161923] ${isToday ? 'border-amber-500/30' : 'border-[#2A2F45]'}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                <span className={`text-sm font-medium ${isToday ? 'text-amber-400' : 'text-[#9CA3AF]'}`}>
                  {format(day, 'EEE, MMM d')}
                </span>
              </div>
              <span className="font-mono text-sm text-white">
                {dayEntries.length > 0 ? formatDurationHM(dayTotal) : '—'}
              </span>
            </div>
            {dayEntries.length > 0 && (
              <div className="px-4 pb-3 space-y-1">
                {dayEntries.map(e => {
                  const lt = getLT(e.laborTypeId)
                  const job = getJob(e.jobId)
                  return (
                    <div key={e.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {lt && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />}
                        <span className="text-[#6B7280] truncate">{job?.name || '—'}</span>
                      </div>
                      <span className="font-mono text-[#4B5563] flex-shrink-0 ml-2">{formatDurationHM(getEntryDuration(e))}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TimesheetsView() {
  const [tab, setTab]         = useState('daily')
  const [currentDate, setDate] = useState(new Date())
  const { settings }          = useSettings()
  const wsMon                  = settings?.weekStartsMonday !== false

  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])

  const go = dir => {
    setDate(d => tab === 'daily'
      ? (dir > 0 ? addDays(d, 1)   : subDays(d, 1))
      : (dir > 0 ? addWeeks(d, 1)  : subWeeks(d, 1))
    )
  }

  const title = () => {
    if (tab === 'daily') return format(currentDate, 'EEE, MMM d')
    const { start, end } = getWeekRange(currentDate, wsMon)
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
  }

  const isCurrent = () => {
    const now = new Date()
    if (tab === 'daily') return format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
    const { start, end } = getWeekRange(currentDate, wsMon)
    return now >= start && now <= end
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[#1E2232]">
        {['daily','weekly'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
              ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-[#4B5563]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Period nav */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#1E2232]">
        <button onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-[#1E2232] text-[#6B7280] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => setDate(new Date())}
          className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors
            ${isCurrent() ? 'text-amber-400' : 'text-white hover:bg-[#1E2232]'}`}>
          {title()}
        </button>
        <button onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-[#1E2232] text-[#6B7280] transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 scrollable px-4 pt-4 pb-24">
        {tab === 'daily'
          ? <DailySheet  date={currentDate} jobs={jobs} laborTypes={laborTypes} />
          : <WeeklySheet date={currentDate} jobs={jobs} laborTypes={laborTypes} />
        }
      </div>
    </div>
  )
}
