import { useState, useMemo, useRef, useId } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Download, Printer } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, subWeeks, subMonths,
} from 'date-fns'
import { db } from '../db'
import { getEntryDuration } from '../utils/time'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useSettings } from '../hooks/useSettings'

const RANGE_PRESETS = [
  { label: 'This week',  getRange: (d, wsMon) => {
    const s = startOfWeek(d, { weekStartsOn: wsMon ? 1 : 0 })
    const e = endOfWeek(d,   { weekStartsOn: wsMon ? 1 : 0 })
    return { start: s, end: e }
  }},
  { label: 'Last week',  getRange: (d, wsMon) => {
    const prev = subWeeks(d, 1)
    const s = startOfWeek(prev, { weekStartsOn: wsMon ? 1 : 0 })
    const e = endOfWeek(prev,   { weekStartsOn: wsMon ? 1 : 0 })
    return { start: s, end: e }
  }},
  { label: 'This month', getRange: (d) => ({ start: startOfMonth(d), end: endOfMonth(d) }) },
  { label: 'Last month', getRange: (d) => {
    const prev = subMonths(d, 1)
    return { start: startOfMonth(prev), end: endOfMonth(prev) }
  }},
  { label: 'Custom',     getRange: null },
]

function toLocalDateString(d) {
  return format(d, 'yyyy-MM-dd')
}

export default function InvoiceModal({ jobs, laborTypes, currentDate, currentTab, onClose }) {
  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  const wsMon = settings.weekStartsMonday // complete via DEFAULT_SETTINGS merge (issue #134)

  const uid      = useId()
  const titleId  = `${uid}-title`
  const jobSelId = `${uid}-job`
  const dialogRef = useRef(null)

  const initialPreset = currentTab === 'daily' ? 4 : 0
  const [preset, setPreset]       = useState(initialPreset)
  const [selectedJobId, setJobId] = useState('')
  const [customStart, setCustomStart] = useState(
    currentTab === 'daily' ? toLocalDateString(currentDate) : ''
  )
  const [customEnd, setCustomEnd] = useState(
    currentTab === 'daily' ? toLocalDateString(currentDate) : ''
  )

  const { start, end } = useMemo(() => {
    if (preset < RANGE_PRESETS.length - 1) {
      return RANGE_PRESETS[preset].getRange(currentDate, wsMon)
    }
    // Parse as local midnight, then clip to the day with date-fns so the end is
    // inclusive to 23:59:59.999 — the old 'T23:59:59' dropped the final sub-second
    // and an entry punched in then was excluded (issue #157).
    const s = customStart ? startOfDay(new Date(customStart + 'T00:00:00')) : null
    const e = customEnd   ? endOfDay(new Date(customEnd   + 'T00:00:00')) : null
    return { start: s, end: e }
  }, [preset, customStart, customEnd, currentDate, wsMon])

  const allEntries = useLiveQuery(async () => {
    if (!start || !end || !selectedJobId) return []
    return db.entries
      .filter(e => {
        const d = new Date(e.punchIn)
        return e.jobId === Number(selectedJobId) && d >= start && d <= end && !!e.punchOut
      })
      .toArray()
  }, [start?.getTime(), end?.getTime(), selectedJobId])

  const job = jobs?.find(j => j.id === Number(selectedJobId))

  const lineItems = useMemo(() => {
    if (!allEntries?.length || !job) return []
    return allEntries.map(e => {
      const lt = laborTypes?.find(l => l.id === e.laborTypeId)
      const hours = getEntryDuration(e) / 3600000
      const rate  = (job.laborRates?.[e.laborTypeId]) ?? null
      const amount = rate != null ? hours * rate : null
      return { entry: e, lt, hours, rate, amount }
    }).sort((a, b) => new Date(a.entry.punchIn) - new Date(b.entry.punchIn))
  }, [allEntries, job, laborTypes])

  const totalHours  = lineItems.reduce((s, li) => s + li.hours, 0)
  const totalAmount = lineItems.every(li => li.amount != null)
    ? lineItems.reduce((s, li) => s + li.amount, 0)
    : null

  const exportCsv = () => {
    if (!job || !lineItems.length) return
    const rows = [
      [`Invoice — ${job.name}${job.clientName ? ` / ${job.clientName}` : ''}`],
      [`Period: ${start ? format(start, 'yyyy-MM-dd') : ''} to ${end ? format(end, 'yyyy-MM-dd') : ''}`],
      [],
      ['Date', 'Labor Type', 'Start', 'End', 'Hours', 'Rate ($/hr)', 'Amount ($)'],
      ...lineItems.map(li => [
        format(new Date(li.entry.punchIn), 'yyyy-MM-dd'),
        li.lt?.name || '',
        format(new Date(li.entry.punchIn), 'HH:mm'),
        format(new Date(li.entry.punchOut), 'HH:mm'),
        li.hours.toFixed(2),
        li.rate != null ? li.rate.toFixed(2) : '',
        li.amount != null ? li.amount.toFixed(2) : '',
      ]),
      [],
      ['', '', '', 'Total', totalHours.toFixed(2), '', totalAmount != null ? totalAmount.toFixed(2) : ''],
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const slug = `${job.name.replace(/\s+/g, '-').toLowerCase()}-invoice`
    const dateStr = start ? format(start, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `${slug}-${dateStr}.csv`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const printInvoice = () => {
    if (!job || !lineItems.length) return
    const periodStr = start && end
      ? `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
      : ''
    const rows = lineItems.map(li => `
      <tr>
        <td>${format(new Date(li.entry.punchIn), 'MMM d, yyyy')}</td>
        <td>${li.lt?.name || '—'}</td>
        <td class="mono">${format(new Date(li.entry.punchIn), 'HH:mm')} – ${format(new Date(li.entry.punchOut), 'HH:mm')}</td>
        <td class="right mono">${li.hours.toFixed(2)}</td>
        <td class="right mono">${li.rate != null ? `$${li.rate.toFixed(2)}` : '—'}</td>
        <td class="right mono">${li.amount != null ? `$${li.amount.toFixed(2)}` : '—'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Invoice — ${job.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; padding: 48px; }
  .header { margin-bottom: 32px; }
  .header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
  .header .meta { color: #666; font-size: 13px; margin-top: 6px; }
  .header .period { color: #333; font-size: 13px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; padding: 6px 8px 6px 0; border-bottom: 2px solid #111; }
  thead th.right { text-align: right; }
  tbody td { padding: 7px 8px 7px 0; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  .tfoot td { padding: 10px 8px 4px 0; border-top: 2px solid #111; font-weight: 700; }
  .right { text-align: right; }
  .mono { font-family: 'SF Mono', 'Fira Mono', monospace; }
  .lt-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  @media print { @page { margin: 24mm 20mm; } body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>Invoice</h1>
  <p class="meta">${job.name}${job.clientName ? ` · ${job.clientName}` : ''}</p>
  ${periodStr ? `<p class="period">${periodStr}</p>` : ''}
</div>
<table>
  <thead><tr>
    <th>Date</th><th>Labor Type</th><th>Time</th>
    <th class="right">Hours</th><th class="right">Rate</th><th class="right">Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr class="tfoot">
    <td colspan="3"><strong>Total</strong></td>
    <td class="right mono">${totalHours.toFixed(2)}</td>
    <td></td>
    <td class="right mono">${totalAmount != null ? `$${totalAmount.toFixed(2)}` : '—'}</td>
  </tr></tfoot>
</table>
</body></html>`
    const w = window.open('', '_blank', 'width=800,height=600')
    // A popup blocker returns null; without this guard the next line throws in an
    // onClick (the ErrorBoundary can't catch it) and the button silently dies.
    // CSV export remains available as a fallback (issue #150).
    if (!w) {
      alert('Couldn’t open the print window — your browser may be blocking pop-ups. Allow pop-ups for this site, or use Export CSV instead.')
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 250)
  }

  // Focus trap, Escape, and focus restoration (issues #151/#152/#154)
  useFocusTrap(dialogRef, onClose)

  const isIos     = isStandalone && os === 'ios'
  const isAndroid = isStandalone && os === 'android'

  const scrimCls  = isIos     ? 'bg-black/40 backdrop-blur-md'  : 'bg-black/70 backdrop-blur-sm'
  const sheetCls  = isIos     ? 'rounded-2xl'
                  : isAndroid ? 'rounded-t-[28px]'
                  : 'rounded-2xl'
  const isMobileSheet = !isIos && !isAndroid

  const inputCls = 'bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-appAccent/60 transition-colors'

  const activeJobs = jobs?.filter(j => j.isActive !== false) ?? []

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMobileSheet ? 'items-center justify-center' : 'items-end sm:items-center'} ${scrimCls}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full sm:max-w-lg bg-appCard ${sheetCls} shadow-xl overflow-hidden flex flex-col max-h-[90dvh]`}
      >
        {/* Handle (Android/iOS bottom sheet) */}
        {isAndroid && <div className="w-12 h-1 bg-appBorder rounded-full mx-auto mt-3 flex-shrink-0" aria-hidden="true" />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-appBorderLight flex-shrink-0">
          <h2 id={titleId} className="font-display font-bold text-appText text-lg">Generate Invoice</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Job selector */}
          <div>
            <label htmlFor={jobSelId} className="block text-xs text-appTextMuted mb-1.5">Job *</label>
            <select
              id={jobSelId}
              value={selectedJobId}
              onChange={e => setJobId(e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">Select a job…</option>
              {activeJobs.map(j => (
                <option key={j.id} value={j.id}>{j.name}{j.clientName ? ` — ${j.clientName}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Date range presets */}
          <div>
            <p className="block text-xs text-appTextMuted mb-1.5" id={`${uid}-period-label`}>Period</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${uid}-period-label`}>
              {RANGE_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(i)}
                  aria-pressed={preset === i}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${preset === i ? 'bg-appAccent text-[#0F1117]' : 'bg-appInput border border-appBorder text-appTextMuted hover:text-appText'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === RANGE_PRESETS.length - 1 && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className={`flex-1 ${inputCls}`}
                />
                <span className="text-appTextMuted text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className={`flex-1 ${inputCls}`}
                />
              </div>
            )}
          </div>

          {/* No rate info hint */}
          {selectedJobId && job && !Object.keys(job.laborRates || {}).length && (
            <p className="text-xs text-appTextMuted bg-appInput rounded-lg px-3 py-2">
              No hourly rates set for this job. Add rates in the Jobs tab to see amounts.
            </p>
          )}

          {/* Line items table */}
          {selectedJobId && allEntries !== undefined && (
            <div>
              {lineItems.length === 0 ? (
                <p className="text-sm text-appTextMuted text-center py-6">No completed entries in this period.</p>
              ) : (
                <div className="rounded-xl border border-appBorder overflow-hidden">
                  {/* Invoice header */}
                  <div className="bg-appInput px-4 py-3 border-b border-appBorder">
                    <p className="font-display font-bold text-appText text-sm">{job?.name}</p>
                    {job?.clientName && <p className="text-xs text-appTextMuted">{job.clientName}</p>}
                    {start && end && (
                      <p className="text-xs text-appTextMuted mt-0.5">
                        {format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2 border-b border-appBorderLight text-[10px] text-appTextMuted uppercase tracking-wider">
                    <span>Description</span>
                    <span className="text-right">Hours</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                  </div>

                  {/* Line items */}
                  <div className="divide-y divide-appBorderLight">
                    {lineItems.map((li, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2.5 items-center">
                        <div className="min-w-0">
                          <p className="text-xs text-appText">{format(new Date(li.entry.punchIn), 'MMM d')}</p>
                          {li.lt && (
                            <span className="text-[10px] px-1 py-0.5 rounded mt-0.5 inline-block"
                              style={{ backgroundColor: `${li.lt.color}25`, color: li.lt.color }}>
                              {li.lt.name}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-appText text-right">{li.hours.toFixed(2)}</span>
                        <span className="font-mono text-xs text-appTextMuted text-right">
                          {li.rate != null ? `$${li.rate.toFixed(2)}` : '—'}
                        </span>
                        <span className="font-mono text-xs text-appText text-right">
                          {li.amount != null ? `$${li.amount.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-3 border-t border-appBorder bg-appInput">
                    <span className="text-xs font-bold text-appText">Total</span>
                    <span className="font-mono text-xs font-bold text-appText text-right">{totalHours.toFixed(2)}</span>
                    <span />
                    <span className="font-mono text-xs font-bold text-appText text-right">
                      {totalAmount != null ? `$${totalAmount.toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-appBorderLight flex-shrink-0">
          <button
            onClick={printInvoice}
            disabled={!lineItems.length}
            aria-disabled={!lineItems.length}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-appInput border border-appBorder hover:bg-appBg text-appTextMuted text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print / PDF
          </button>
          <button
            onClick={exportCsv}
            disabled={!lineItems.length}
            aria-disabled={!lineItems.length}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90 text-[#0F1117] text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
