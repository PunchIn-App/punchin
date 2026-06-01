import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Calendar, Pencil, Trash2, Plus, Search } from 'lucide-react'
import { format, addDays, subDays, addWeeks, subWeeks } from 'date-fns'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'
import {
  formatDurationHM, formatTime, getEntryDuration,
  getDayRange, getWeekRange, getWeekDays,
  isEntryInRange, sumDurations,
} from '../utils/time'
import EditEntryModal from '../components/EditEntryModal'

function DailySheet({ date, jobs, laborTypes, searchQuery, filterJobId, filterLaborTypeId, onEdit, onDelete }) {
  const { start, end } = getDayRange(date)
  const entries = useLiveQuery(
    () => db.entries.filter(e => isEntryInRange(e, start, end)).toArray(),
    [start.getTime()]
  )
  const getJob = id => jobs?.find(j => j.id === id)
  const getLT  = id => laborTypes?.find(l => l.id === id)

  if (!entries) return null

  const filteredEntries = entries.filter(e => {
    const job = getJob(e.jobId)
    const lt = getLT(e.laborTypeId)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesJob = job?.name?.toLowerCase().includes(q)
      const matchesClient = job?.clientName?.toLowerCase().includes(q)
      const matchesLt = lt?.name?.toLowerCase().includes(q)
      const matchesNotes = e.notes?.toLowerCase().includes(q)
      if (!matchesJob && !matchesClient && !matchesLt && !matchesNotes) return false
    }

    if (filterJobId && e.jobId !== Number(filterJobId)) return false
    if (filterLaborTypeId && e.laborTypeId !== Number(filterLaborTypeId)) return false

    return true
  })

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-xl bg-appCard border border-appBorder px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="text-sm text-appTextMuted">Total</span>
        <span className="font-mono font-semibold text-appText text-lg">{formatDurationHM(sumDurations(filteredEntries))}</span>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-appTextDisabled">
          <Calendar className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No entries this day</p>
        </div>
      ) : (
        filteredEntries.map(entry => {
          const job = getJob(entry.jobId)
          const lt  = getLT(entry.laborTypeId)
          const dur = getEntryDuration(entry)
          return (
            <div key={entry.id} className="rounded-xl border border-appBorder bg-appCard p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || '—'}</p>
                  {lt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block"
                      style={{ backgroundColor: `${lt.color}25`, color: lt.color }}>
                      {lt.name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  <p className="font-mono text-appText font-semibold text-sm">{formatDurationHM(dur)}</p>
                  <p className="text-appTextDarker text-xs mt-0.5">
                    {formatTime(entry.punchIn)} → {entry.punchOut ? formatTime(entry.punchOut) : 'running'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button onClick={() => onEdit(entry)} className="p-1 rounded hover:bg-appInput text-appTextDarker hover:text-amber-400 transition-colors" title="Edit Entry">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(entry.id)} className="p-1 rounded hover:bg-appInput text-appTextDarker hover:text-red-400 transition-colors" title="Delete Entry">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              {entry.notes && <p className="mt-2 text-xs text-appTextMuted">{entry.notes}</p>}
            </div>
          )
        })
      )}
    </div>
  )
}

function WeeklySheet({ date, jobs, laborTypes, searchQuery, filterJobId, filterLaborTypeId, onEdit, onDelete }) {
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

  const filteredEntries = allEntries.filter(e => {
    const job = getJob(e.jobId)
    const lt = getLT(e.laborTypeId)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesJob = job?.name?.toLowerCase().includes(q)
      const matchesClient = job?.clientName?.toLowerCase().includes(q)
      const matchesLt = lt?.name?.toLowerCase().includes(q)
      const matchesNotes = e.notes?.toLowerCase().includes(q)
      if (!matchesJob && !matchesClient && !matchesLt && !matchesNotes) return false
    }

    if (filterJobId && e.jobId !== Number(filterJobId)) return false
    if (filterLaborTypeId && e.laborTypeId !== Number(filterLaborTypeId)) return false

    return true
  })

  const total = sumDurations(filteredEntries)
  const jobTotals = filteredEntries.reduce((acc, e) => {
    acc[e.jobId] = (acc[e.jobId] || 0) + getEntryDuration(e)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {/* Week total */}
      <div className="rounded-xl bg-appCard border border-appBorder px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="text-sm text-appTextMuted">Week total</span>
        <span className="font-mono font-semibold text-appText text-lg">{formatDurationHM(total)}</span>
      </div>

      {/* Job breakdown */}
      {Object.keys(jobTotals).length > 0 && (
        <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight shadow-sm">
          {Object.entries(jobTotals).sort((a,b) => b[1]-a[1]).map(([jid, ms]) => {
            const job = getJob(Number(jid))
            const pct = total > 0 ? (ms / total) * 100 : 0
            return (
              <div key={jid} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-appText font-medium">{job?.name || '—'}</span>
                  <span className="font-mono text-sm text-appTextMuted">{formatDurationHM(ms)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-appBg">
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
        const dayEntries = filteredEntries.filter(e => isEntryInRange(e, ds, de))
        const dayTotal   = sumDurations(dayEntries)
        const isToday    = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

        return (
          <div key={day.toISOString()}
            className={`rounded-xl border bg-appCard shadow-sm transition-colors duration-200 ${isToday ? 'border-amber-500/30' : 'border-appBorder'}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                <span className={`text-sm font-medium ${isToday ? 'text-amber-400' : 'text-appTextMuted'}`}>
                  {format(day, 'EEE, MMM d')}
                </span>
              </div>
              <span className="font-mono text-sm text-appText">
                {dayEntries.length > 0 ? formatDurationHM(dayTotal) : '—'}
              </span>
            </div>
            {dayEntries.length > 0 && (
              <div className="px-4 pb-3 space-y-1 divide-y divide-appBorderLight/30">
                {dayEntries.map(e => {
                  const lt = getLT(e.laborTypeId)
                  const job = getJob(e.jobId)
                  return (
                    <div key={e.id} className="flex items-center justify-between text-xs py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {lt && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />}
                        <span className="text-appTextMuted truncate">{job?.name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="font-mono text-appTextDarker">{formatDurationHM(getEntryDuration(e))}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => onEdit(e)} className="p-0.5 rounded hover:bg-appInput text-appTextDisabled hover:text-amber-400 transition-colors" title="Edit Entry">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => onDelete(e.id)} className="p-0.5 rounded hover:bg-appInput text-appTextDisabled hover:text-red-400 transition-colors" title="Delete Entry">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
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

  // Modals state
  const [editingEntry, setEditingEntry] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Search & Filter State
  const [searchQuery, setSearchQuery]             = useState('')
  const [filterJobId, setFilterJobId]             = useState('')
  const [filterLaborTypeId, setFilterLaborTypeId] = useState('')

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

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      await db.entries.delete(id)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-appBorderLight">
        {['daily','weekly'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
              ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-appTextMuted'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Period nav */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-appBorderLight">
        <button onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => setDate(new Date())}
          className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors
            ${isCurrent() ? 'text-amber-400' : 'text-appText hover:bg-appInput'}`}>
          {title()}
        </button>
        <button onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Search, Filter & Quick Manual Log Actions */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-appBorderLight bg-appNav flex gap-2 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-appTextDarker" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-appCard border border-appBorder text-appText rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 transition-colors placeholder-appTextDisabled"
          />
        </div>

        {/* Job Filter */}
        <select
          value={filterJobId}
          onChange={e => setFilterJobId(e.target.value)}
          className="bg-appCard border border-appBorder text-appTextMuted rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-amber-500/50"
        >
          <option value="">All Jobs</option>
          {jobs?.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>

        {/* Labor Type Filter */}
        <select
          value={filterLaborTypeId}
          onChange={e => setFilterLaborTypeId(e.target.value)}
          className="bg-appCard border border-appBorder text-appTextMuted rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-amber-500/50"
        >
          <option value="">All Types</option>
          {laborTypes?.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
        </select>

        {/* Log Manual Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-[#0F1117] text-xs font-bold transition-colors ml-auto"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          Log Manual
        </button>
      </div>

      <div className="flex-1 scrollable px-4 pt-4 pb-24">
        {tab === 'daily'
          ? <DailySheet
              date={currentDate}
              jobs={jobs}
              laborTypes={laborTypes}
              searchQuery={searchQuery}
              filterJobId={filterJobId}
              filterLaborTypeId={filterLaborTypeId}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
            />
          : <WeeklySheet
              date={currentDate}
              jobs={jobs}
              laborTypes={laborTypes}
              searchQuery={searchQuery}
              filterJobId={filterJobId}
              filterLaborTypeId={filterLaborTypeId}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
            />
        }
      </div>

      {/* Add Manual Entry Modal */}
      {showAddModal && (
        <EditEntryModal onClose={() => setShowAddModal(false)} />
      )}

      {/* Edit Existing Entry Modal */}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />
      )}
    </div>
  )
}
