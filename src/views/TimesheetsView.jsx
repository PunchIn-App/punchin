import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Calendar, Pencil, Trash2, Plus, Search, FileDown, Receipt, Printer } from 'lucide-react'
import { format, addDays, subDays, addWeeks, subWeeks } from 'date-fns'
import { db, deleteEntry } from '../db'
import { useSettings } from '../hooks/useSettings'
import {
  formatDuration, formatTime, roundEntry,
  getDayRange, getWeekRange, getWeekDays,
  entryOverlapsRange, getEntryDurationInRange, sumDurationsInRange,
} from '../utils/time'
import { PRINT_FONT_HEAD, openPrintWindow, laborBadgeHTML } from '../utils/printDocument'
import { LaborTag, LaborGlyphChip } from '../components/LaborGlyph'
import EntitySelect from '../components/EntitySelect'
import EditEntryModal from '../components/EditEntryModal'
import InvoiceModal from '../components/InvoiceModal'
import ConfirmModal from '../components/ConfirmModal'

// Entries can start before a viewed day/week and run into it (an overnight
// shift's morning half). The punchIn index can't express "overlaps [start,end]"
// directly, so each reactive query looks back one day past the window start and
// the entryOverlapsRange filter drops anything that doesn't actually touch it.
// A day covers every realistic overnight shift; a forgotten multi-day timer
// still surfaces in the Timer view with its "Overnight Run?" flag. (issue #136)
const OVERNIGHT_LOOKBACK_MS = 24 * 60 * 60 * 1000

function DailySheet({ date, jobs, laborTypes, searchQuery, filterJobId, filterLaborTypeId, onEdit, onDelete }) {
  const { settings } = useSettings()
  const rm = settings.roundingMinutes     // billable rounding increment (issue #208)
  const decimal = !!settings.decimalHours
  const { start, end } = getDayRange(date)
  const queryStart = new Date(start.getTime() - OVERNIGHT_LOOKBACK_MS)
  const entries = useLiveQuery(
    // Indexed range query (issue #132): punchIn is a Date key, so Dexie serves
    // this from the `punchIn` index instead of scanning the whole table. The
    // window reaches back a day (issue #136) to catch overnight entries that
    // began before this day; entryOverlapsRange below drops the rest.
    () => db.entries.where('punchIn').between(queryStart, end, true, true).toArray(),
    [start.getTime()]
  )
  // id→record lookups built once per data change, not an O(n) find per row (#138).
  const jobMap = useMemo(() => new Map((jobs ?? []).map(j => [j.id, j])), [jobs])
  const ltMap  = useMemo(() => new Map((laborTypes ?? []).map(l => [l.id, l])), [laborTypes])
  const getJob = id => jobMap.get(id)
  const getLT  = id => ltMap.get(id)

  // Memoised so the overlap + search/filter pass only re-runs when its inputs
  // change, not on every parent render (e.g. typing in an unrelated field) (#138).
  const filteredEntries = useMemo(() => {
    if (!entries) return null
    return entries.filter(e => {
      if (!entryOverlapsRange(e, start, end)) return false // drop look-back non-overlaps (#136)
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
    // start.getTime() keys the day; jobMap/ltMap back getJob/getLT.
  }, [entries, start.getTime(), searchQuery, filterJobId, filterLaborTypeId, jobMap, ltMap]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!filteredEntries) return null

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-xl bg-appCard border border-appBorder px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="text-sm text-appTextMuted">Total</span>
        <span className="font-mono font-semibold text-appText text-lg">{formatDuration(sumDurationsInRange(filteredEntries.map(e => roundEntry(e, rm)), start, end), decimal)}</span>
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
          // Clip to the day so an overnight entry shows only the portion worked
          // today, keeping the card durations summing to the day Total (#136).
          // Round for billing first (issue #208) so cards agree with the Total.
          const dur = getEntryDurationInRange(roundEntry(entry, rm), start, end)
          return (
            <div key={entry.id} className="rounded-xl border border-appBorder bg-appCard p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-appText text-sm truncate">{job?.name || '—'}</p>
                  {lt && <LaborTag laborType={lt} className="mt-0.5" />}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  <p className="font-mono text-appText font-semibold text-sm">{formatDuration(dur, decimal)}</p>
                  <p className="text-appTextDarker text-xs mt-0.5">
                    {formatTime(entry.punchIn, settings.timeFormat)} → {entry.punchOut ? formatTime(entry.punchOut, settings.timeFormat) : 'running'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button onClick={() => onEdit(entry)} aria-label={`Edit entry for ${getJob(entry.jobId)?.name || 'job'}`} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-appInput text-appTextMuted hover:text-appAccent transition-colors">
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button onClick={() => onDelete(entry.id)} aria-label={`Delete entry for ${getJob(entry.jobId)?.name || 'job'}`} className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-appInput text-appTextMuted hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
  const wsMon = settings.weekStartsMonday // complete via DEFAULT_SETTINGS merge (issue #134)
  const rm = settings.roundingMinutes     // billable rounding increment (issue #208)
  const decimal = !!settings.decimalHours
  const { start, end } = getWeekRange(date, wsMon)
  const days = getWeekDays(date, wsMon)
  const queryStart = new Date(start.getTime() - OVERNIGHT_LOOKBACK_MS)

  const allEntries = useLiveQuery(
    // Indexed range query (issue #132) with a one-day look-back (issue #136) so
    // an entry that began the night before the week still counts toward it;
    // entryOverlapsRange below drops anything in the margin that doesn't touch it.
    () => db.entries.where('punchIn').between(queryStart, end, true, true).toArray(),
    [start.getTime()]
  )
  // id→record lookups built once per data change, not an O(n) find per row (#138).
  const jobMap = useMemo(() => new Map((jobs ?? []).map(j => [j.id, j])), [jobs])
  const ltMap  = useMemo(() => new Map((laborTypes ?? []).map(l => [l.id, l])), [laborTypes])
  const getJob = id => jobMap.get(id)
  const getLT  = id => ltMap.get(id)

  // Filter once per input change (#138).
  const filteredEntries = useMemo(() => {
    if (!allEntries) return null
    return allEntries.filter(e => {
      if (!entryOverlapsRange(e, start, end)) return false // drop look-back non-overlaps (#136)
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
  }, [allEntries, start.getTime(), searchQuery, filterJobId, filterLaborTypeId, jobMap, ltMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Week total + per-job breakdown, derived once from the filtered set (#138).
  // Each entry is rounded for billing (issue #208) before clipping to the week.
  const { total, jobTotals } = useMemo(() => {
    if (!filteredEntries) return { total: 0, jobTotals: {} }
    const rounded = filteredEntries.map(e => roundEntry(e, rm))
    return {
      total: sumDurationsInRange(rounded, start, end),
      jobTotals: rounded.reduce((acc, e) => {
        if (!e.punchOut) return acc // running timers excluded from totals (#137)
        acc[e.jobId] = (acc[e.jobId] || 0) + getEntryDurationInRange(e, start, end) // clip to week (#136)
        return acc
      }, {}),
    }
  }, [filteredEntries, start.getTime(), end.getTime(), rm])

  // Bucket entries into the seven days once, instead of re-filtering the whole
  // week per day on every render (the O(7×entries) pass the finding flags) (#138).
  const dayData = useMemo(() => {
    if (!filteredEntries) return []
    return days.map(day => {
      const ds = new Date(day); ds.setHours(0,0,0,0)
      const de = new Date(day); de.setHours(23,59,59,999)
      // Overlap (not punchIn-only) so an overnight entry appears under both days
      // it touches; totals clip each entry to the day it's shown under and skip
      // running timers, so the rows sum to dayTotal (#136, #137).
      const dayEntries = filteredEntries.filter(e => entryOverlapsRange(e, ds, de))
      const dayTotal = sumDurationsInRange(dayEntries.map(e => roundEntry(e, rm)), ds, de)
      return { day, ds, de, dayEntries, dayTotal }
    })
  }, [filteredEntries, start.getTime(), rm]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!filteredEntries) return null

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 lg:items-start">
      {/* Summary — on top on mobile, a sticky right rail on desktop */}
      <div className="space-y-3 mb-3 lg:mb-0 lg:order-2 lg:sticky lg:top-4">
        {/* Hero week total */}
        <div className="rounded-xl bg-appCard border border-appBorder p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-appTextMuted">Week total</p>
          <p className="font-mono font-bold text-appText text-3xl mt-1">{formatDuration(total, decimal)}</p>
        </div>

        {/* By job */}
        {Object.keys(jobTotals).length > 0 && (
          <div className="rounded-xl border border-appBorder bg-appCard p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-appTextMuted mb-3">By job</p>
            <div className="space-y-3">
              {Object.entries(jobTotals).sort((a,b) => b[1]-a[1]).map(([jid, ms]) => {
                const job = getJob(Number(jid))
                const barColor = getLT(job?.laborTypeId)?.color || 'var(--accent)'
                const pct = total > 0 ? (ms / total) * 100 : 0
                return (
                  <div key={jid}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-appText font-medium truncate">{job?.name || '—'}</span>
                      <span className="font-mono text-sm text-appTextMuted flex-shrink-0 ml-2">{formatDuration(ms, decimal)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-appBg">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day-by-day */}
      <div className="space-y-3 lg:order-1">
      {dayData.map(({ day, ds, de, dayEntries, dayTotal }) => {
        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

        return (
          <div key={day.toISOString()}
            className={`rounded-xl border bg-appCard shadow-sm transition-colors duration-200 ${isToday ? 'border-appAccent/30' : 'border-appBorder'}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-appAccent flex-shrink-0" />}
                <span className={`text-sm font-medium ${isToday ? 'text-appAccent' : 'text-appTextMuted'}`}>
                  {format(day, 'EEE, MMM d')}
                </span>
              </div>
              <span className="font-mono text-sm text-appText">
                {dayEntries.length > 0 ? formatDuration(dayTotal, decimal) : '—'}
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
                        {lt && <LaborGlyphChip laborType={lt} className="w-4 h-4" />}
                        <span className="text-appTextMuted truncate">{job?.name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="font-mono text-appTextDarker">{formatDuration(getEntryDurationInRange(roundEntry(e, rm), ds, de), decimal)}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => onEdit(e)} aria-label={`Edit entry for ${getJob(e.jobId)?.name || 'job'}`} className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-appInput text-appTextMuted hover:text-appAccent transition-colors">
                            <Pencil className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <button onClick={() => onDelete(e.id)} aria-label={`Delete entry for ${getJob(e.jobId)?.name || 'job'}`} className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-appInput text-appTextMuted hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
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
    </div>
  )
}

export default function TimesheetsView() {
  const [tab, setTab]         = useState('daily')
  const [currentDate, setDate] = useState(new Date())
  const { settings }          = useSettings()
  const wsMon                  = settings.weekStartsMonday // DEFAULT_SETTINGS merge (issue #134)
  const rm                     = settings.roundingMinutes  // billable rounding for exports (issue #208)

  // Modals state
  const [editingEntry, setEditingEntry]   = useState(null)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showInvoice, setShowInvoice]     = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery]             = useState('')
  const [filterJobId, setFilterJobId]             = useState('')
  const [filterLaborTypeId, setFilterLaborTypeId] = useState('')

  const jobs       = useLiveQuery(() => db.jobs.toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.toArray(), [])

  // A job's filter dot is its own colour, else its labor type's (mirrors the
  // job card's left-rail colour resolution).
  const laborColorOf = (id) => laborTypes?.find(l => l.id === id)?.color

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

  const handleDelete = (id) => {
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (confirmDeleteId) {
      await deleteEntry(confirmDeleteId)
    }
    setConfirmDeleteId(null)
  }

  const exportCsv = async () => {
    let entries, rangeLabel
    if (tab === 'daily') {
      const { start, end } = getDayRange(currentDate)
      entries = await db.entries.where('punchIn').between(start, end, true, true).toArray()
      rangeLabel = format(currentDate, 'yyyy-MM-dd')
    } else {
      const { start, end } = getWeekRange(currentDate, wsMon)
      entries = await db.entries.where('punchIn').between(start, end, true, true).toArray()
      rangeLabel = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`
    }

    const rows = [['Date', 'Job', 'Client', 'Labor Type', 'Start', 'End', 'Duration (h)', 'Notes']]
    for (const raw of entries) {
      if (!raw.punchOut) continue
      // Round in the user's favour so the exported Start/End/Duration agree with
      // what's billed on screen (issue #208).
      const e = roundEntry(raw, rm)
      const job = jobs?.find(j => j.id === e.jobId)
      const lt  = laborTypes?.find(l => l.id === e.laborTypeId)
      const dur = (new Date(e.punchOut) - new Date(e.punchIn)) / 3600000
      rows.push([
        format(new Date(e.punchIn), 'yyyy-MM-dd'),
        job?.name || '',
        job?.clientName || '',
        lt?.name || '',
        formatTime(e.punchIn, settings.timeFormat),
        formatTime(e.punchOut, settings.timeFormat),
        dur.toFixed(2),
        raw.notes || '',
      ])
    }

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `punchin-${rangeLabel}.csv`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const printTimesheet = async () => {
    let entries, titleStr
    if (tab === 'daily') {
      const { start, end } = getDayRange(currentDate)
      entries = await db.entries.where('punchIn').between(start, end, true, true).toArray()
      titleStr = format(currentDate, 'EEEE, MMMM d, yyyy')
    } else {
      const { start, end } = getWeekRange(currentDate, wsMon)
      entries = await db.entries.where('punchIn').between(start, end, true, true).toArray()
      titleStr = `Week of ${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }

    // Round each entry in the user's favour first so the printed times, per-row
    // hours, and total all reflect what's billed (issue #208).
    const completed = entries.filter(e => !!e.punchOut).map(e => roundEntry(e, rm))
    const totalMs = completed.reduce((s, e) => s + (new Date(e.punchOut) - new Date(e.punchIn)), 0)
    const totalHrs = (totalMs / 3600000).toFixed(2)

    const rows = completed
      .sort((a, b) => new Date(a.punchIn) - new Date(b.punchIn))
      .map(e => {
        const job = jobs?.find(j => j.id === e.jobId)
        const lt  = laborTypes?.find(l => l.id === e.laborTypeId)
        const hrs = ((new Date(e.punchOut) - new Date(e.punchIn)) / 3600000).toFixed(2)
        return `<tr>
          <td>${format(new Date(e.punchIn), 'EEE, MMM d')}</td>
          <td>${job?.name || '—'}${job?.clientName ? `<br><span class="sub">${job.clientName}</span>` : ''}</td>
          <td>${laborBadgeHTML(lt)}</td>
          <td class="mono">${formatTime(e.punchIn, settings.timeFormat)} – ${formatTime(e.punchOut, settings.timeFormat)}</td>
          <td class="right mono">${hrs}</td>
          ${e.notes ? `<td class="notes">${e.notes}</td>` : '<td></td>'}
        </tr>`
      }).join('')

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Timesheet — ${titleStr}</title>
${PRINT_FONT_HEAD}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', sans-serif; font-size: 13px; color: #111; padding: 48px; }
  h1 { font-family: 'Noto Sans Display', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub-title { color: #666; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; padding: 6px 8px 6px 0; border-bottom: 2px solid #111; }
  thead th.right { text-align: right; }
  tbody td { padding: 7px 8px 7px 0; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
  tfoot td { padding: 10px 8px 4px 0; border-top: 2px solid #111; font-weight: 700; }
  .right { text-align: right; }
  .mono { font-family: 'Noto Sans Mono', monospace; font-size: 12px; }
  .sub { font-size: 11px; color: #888; }
  .notes { font-size: 11px; color: #666; font-style: italic; }
  .empty { text-align: center; padding: 32px; color: #888; }
  @media print { @page { margin: 24mm 20mm; } body { padding: 0; } }
</style></head><body>
<h1>Timesheet</h1>
<p class="sub-title">${titleStr}</p>
<table>
  <thead><tr>
    <th>Date</th><th>Job</th><th>Labor Type</th><th>Time</th><th class="right">Hours</th><th>Notes</th>
  </tr></thead>
  <tbody>${rows || `<tr><td colspan="6" class="empty">No completed entries.</td></tr>`}</tbody>
  <tfoot><tr>
    <td colspan="4"><strong>Total</strong></td>
    <td class="right mono">${totalHrs}</td>
    <td></td>
  </tr></tfoot>
</table>
</body></html>`

    // openPrintWindow writes the doc and prints once the Noto webfonts load; it
    // returns false when the popup is blocked (window.open → null), same hardening
    // as InvoiceModal print so the button doesn't throw in its onClick (issue #150).
    if (!openPrintWindow(html, { width: 900, height: 700 })) {
      alert('Couldn’t open the print window — your browser may be blocking pop-ups. Allow pop-ups for this site, or use the CSV export instead.')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar row 1 — segmented period tabs, centered date nav, Log Manual.
          Stacks on mobile; a single grouped control bar at lg. */}
      <div className="flex-shrink-0 flex flex-col gap-2.5 px-4 py-2.5 border-b border-appBorderLight lg:flex-row lg:items-center">
        <div role="tablist" className="flex lg:inline-flex flex-shrink-0 bg-appInput border border-appBorder rounded-xl p-1">
          {['daily','weekly'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={`flex-1 lg:flex-initial px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
                ${tab === t ? 'bg-appCard text-appText shadow-sm' : 'text-appTextMuted hover:text-appText'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1 lg:mx-auto">
          <button
            onClick={() => go(-1)}
            aria-label={tab === 'daily' ? 'Previous day' : 'Previous week'}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button onClick={() => setDate(new Date())}
            aria-label={`${isCurrent() ? 'Current period: ' : 'Jump to today, currently viewing: '}${title()}`}
            className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors
              ${isCurrent() ? 'text-appAccent' : 'text-appText hover:bg-appInput'}`}>
            {title()}
          </button>
          <button
            onClick={() => go(1)}
            aria-label={tab === 'daily' ? 'Next day' : 'Next week'}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1 flex-shrink-0 px-3 py-2 rounded-lg bg-appAccent hover:brightness-110 active:brightness-90 text-appOnAccent text-xs font-bold transition-all"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
          Log Manual
        </button>
      </div>

      {/* Toolbar row 2 — search, filters, and the grouped export cluster */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-appBorderLight bg-appNav flex gap-2 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-appTextMuted pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            aria-label="Search time entries"
            className="w-full bg-appCard border border-appBorder text-appText rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors placeholder-appTextDisabled"
          />
        </div>

        {/* Job Filter */}
        <EntitySelect
          compact
          hideLabel
          label="Filter by job"
          value={filterJobId}
          onChange={setFilterJobId}
          emptyOption={{ label: 'All Jobs' }}
          options={jobs?.map(j => ({ value: j.id, label: j.name, color: j.color || laborColorOf(j.laborTypeId) })) || []}
        />

        {/* Labor Type Filter */}
        <EntitySelect
          compact
          hideLabel
          label="Filter by labor type"
          value={filterLaborTypeId}
          onChange={setFilterLaborTypeId}
          emptyOption={{ label: 'All Types' }}
          options={laborTypes?.map(lt => ({ value: lt.id, label: lt.name, glyph: lt.glyph, color: lt.color })) || []}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={exportCsv}
            aria-label="Export current view as CSV"
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-appCard border border-appBorder hover:bg-appInput text-appTextMuted text-xs font-medium transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            CSV
          </button>
          <button
            onClick={printTimesheet}
            aria-label="Print timesheet or save as PDF"
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-appCard border border-appBorder hover:bg-appInput text-appTextMuted text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Print
          </button>
          <button
            onClick={() => setShowInvoice(true)}
            aria-label="Generate invoice"
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-appCard border border-appBorder hover:bg-appInput text-appTextMuted text-xs font-medium transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
            Invoice
          </button>
        </div>
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

      {/* Invoice Modal */}
      {showInvoice && (
        <InvoiceModal
          jobs={jobs}
          laborTypes={laborTypes}
          currentDate={currentDate}
          currentTab={tab}
          onClose={() => setShowInvoice(false)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete this time entry?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
