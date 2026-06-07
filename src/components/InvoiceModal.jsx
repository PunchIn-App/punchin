import { useState, useMemo, useRef, useId } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Download, Printer } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, subWeeks, subMonths,
} from 'date-fns'
import { db } from '../db'
import { getEntryDuration, roundEntry, formatTime } from '../utils/time'
import { formatMoney, currencySymbol } from '../utils/format'
import { PRINT_FONT_HEAD, openPrintWindow } from '../utils/printDocument'
import { LaborTag } from './LaborGlyph'
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
  const { settings, updateSetting } = useSettings()
  const wsMon = settings.weekStartsMonday // complete via DEFAULT_SETTINGS merge (issue #134)
  const timeFormat = settings.timeFormat
  const currency = settings.defaultCurrency
  const money = (n) => formatMoney(n, currency)

  // Editable invoice number: defaults to the next number, but the user can
  // override it (manual / per-client / reset). Generation advances the counter.
  const [numOverride, setNumOverride] = useState(null)
  const invoiceNum = numOverride ?? (settings.nextInvoiceNumber ?? 1)

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
    return allEntries.map(raw => {
      // Bill in the user's favour: round the entry (start down, end up) so the
      // invoiced hours, amount, and shown Start/End times are consistent (#208).
      const e = roundEntry(raw, settings.roundingMinutes)
      const lt = laborTypes?.find(l => l.id === e.laborTypeId)
      const hours = getEntryDuration(e) / 3600000
      const rate  = (job.laborRates?.[e.laborTypeId]) ?? null
      const amount = rate != null ? hours * rate : null
      return { entry: e, lt, hours, rate, amount }
    }).sort((a, b) => new Date(a.entry.punchIn) - new Date(b.entry.punchIn))
  }, [allEntries, job, laborTypes, settings.roundingMinutes])

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
      ['Date', 'Labor Type', 'Start', 'End', 'Hours', `Rate (${currencySymbol(currency)}/hr)`, `Amount (${currencySymbol(currency)})`],
      ...lineItems.map(li => [
        format(new Date(li.entry.punchIn), 'yyyy-MM-dd'),
        li.lt?.name || '',
        formatTime(li.entry.punchIn, timeFormat),
        formatTime(li.entry.punchOut, timeFormat),
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
        <td>${li.lt ? `<span class="lt-badge" style="background:${li.lt.color}22;color:${li.lt.color}">${li.lt.name}</span>` : '—'}</td>
        <td class="mono">${formatTime(li.entry.punchIn, timeFormat)} – ${formatTime(li.entry.punchOut, timeFormat)}</td>
        <td class="right mono">${li.hours.toFixed(2)}</td>
        <td class="right mono">${li.rate != null ? money(li.rate) : '—'}</td>
        <td class="right mono">${li.amount != null ? money(li.amount) : '—'}</td>
      </tr>`).join('')

    // Billed-from (the billing profile) / Billed-to (the client) band + optional
    // invoice number (display-only). Escape the free-text billing fields.
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const fromLines = [settings.billingBusiness, settings.billingEmail, settings.billingPhone, settings.billingAddress].filter(Boolean)
    const logo = (settings.billingLogo || '').startsWith('data:image/') ? settings.billingLogo : ''
    const hasFrom = settings.billingName || fromLines.length || logo
    const invNo = settings.numberInvoices ? `${settings.invoicePrefix || ''}${String(invoiceNum).padStart(3, '0')}` : ''
    const bandHtml = hasFrom ? `
<div class="band">
  <div class="party">
    ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
    <div class="cap">Billed from</div>
    ${settings.billingName ? `<div class="pname">${esc(settings.billingName)}</div>` : ''}
    ${fromLines.map(l => `<div class="pline">${esc(l).replace(/\n/g, '<br>')}</div>`).join('')}
  </div>
  <div class="party to">
    <div class="cap">Billed to</div>
    <div class="pname">${esc(job.clientName || job.name)}</div>
    ${job.clientName ? `<div class="pline">${esc(job.name)}</div>` : ''}
  </div>
</div>` : ''

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Invoice — ${job.name}</title>
${PRINT_FONT_HEAD}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', sans-serif; font-size: 13px; color: #111; padding: 48px; }
  .header { margin-bottom: 32px; }
  .header h1 { font-family: 'Noto Sans Display', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
  .header .meta { color: #666; font-size: 13px; margin-top: 6px; }
  .header .period { color: #333; font-size: 13px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; padding: 6px 8px 6px 0; border-bottom: 2px solid #111; }
  thead th.right { text-align: right; }
  tbody td { padding: 7px 8px 7px 0; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  .tfoot td { padding: 10px 8px 4px 0; border-top: 2px solid #111; font-weight: 700; }
  .right { text-align: right; }
  .mono { font-family: 'Noto Sans Mono', monospace; }
  .lt-badge { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .paperfoot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 18px; border-top: 1px solid #e8e8e8; }
  .paperfoot .thanks { font-size: 12px; color: #888; }
  .paperfoot .due { text-align: right; }
  .paperfoot .due .cap { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  .paperfoot .due .amt { font-size: 24px; font-weight: 700; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .invno { text-align: right; }
  .invno .cap { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  .invno .num { font-family: 'Noto Sans Mono', monospace; font-size: 15px; font-weight: 700; }
  .band { display: flex; justify-content: space-between; gap: 24px; margin: 0 0 24px; padding: 14px 0; border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; }
  .party .cap { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .party .pname { font-weight: 700; font-size: 13px; }
  .party .pline { color: #555; font-size: 12px; margin-top: 1px; }
  .party .logo { max-height: 52px; max-width: 200px; margin-bottom: 8px; display: block; }
  .party.to { text-align: right; }
  @media print { @page { margin: 24mm 20mm; } body { padding: 0; } }
</style></head><body>
<div class="header">
  <div class="header-row">
    <div>
      <h1>Invoice</h1>
      <p class="meta">${esc(job.name)}</p>
      ${periodStr ? `<p class="period">${periodStr}</p>` : ''}
    </div>
    ${invNo ? `<div class="invno"><div class="cap">Invoice №</div><div class="num">${esc(invNo)}</div></div>` : ''}
  </div>
</div>
${bandHtml}
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
    <td class="right mono">${totalAmount != null ? money(totalAmount) : '—'}</td>
  </tr></tfoot>
</table>
${totalAmount != null ? `<div class="paperfoot">
  <span class="thanks">Generated by PunchIn · Thank you</span>
  <div class="due"><span class="cap">Amount due</span><span class="amt mono">${money(totalAmount)}</span></div>
</div>` : ''}
</body></html>`
    // openPrintWindow writes the doc and prints once the Noto webfonts load. It
    // returns false when the popup is blocked (window.open → null); without this
    // guard the throw inside the onClick is uncatchable and the button silently
    // dies, so we alert and leave CSV as the fallback (issue #150).
    if (openPrintWindow(html, { width: 800, height: 600 })) {
      // The invoice was generated — advance the counter so the next invoice gets
      // the next number. Only on a successful open (a blocked popup won't burn a
      // number); re-generating the same invoice intentionally takes a new number.
      if (settings.numberInvoices) {
        updateSetting('nextInvoiceNumber', invoiceNum + 1)
        setNumOverride(null) // next time, show the new auto number
      }
    } else {
      alert('Couldn’t open the print window — your browser may be blocking pop-ups. Allow pop-ups for this site, or use Export CSV instead.')
    }
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
          <h2 id={titleId} className="font-display font-bold text-appText text-lg">Create invoice</h2>
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

          {/* Invoice number — editable; defaults to the next number */}
          {settings.numberInvoices && (
            <div>
              <label htmlFor={`${uid}-invno`} className="block text-xs text-appTextMuted mb-1.5">Invoice number</label>
              <div className="flex items-center">
                {settings.invoicePrefix && (
                  <span className="px-3 py-2 text-sm font-mono rounded-l-lg border border-r-0 border-appBorder bg-appInput text-appTextMuted select-none">{settings.invoicePrefix}</span>
                )}
                <input
                  id={`${uid}-invno`}
                  type="number"
                  min="1"
                  value={invoiceNum}
                  onChange={e => setNumOverride(Math.max(1, Number(e.target.value) || 1))}
                  className={`w-28 font-mono ${inputCls} ${settings.invoicePrefix ? 'rounded-l-none' : ''}`}
                />
              </div>
              <p className="text-[11px] text-appTextMuted mt-1">Edit for a manual or per-client number; advances after you generate the invoice.</p>
            </div>
          )}

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
                    ${preset === i ? 'bg-appAccent text-appOnAccent' : 'bg-appInput border border-appBorder text-appTextMuted hover:text-appText'}`}
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
                          {li.lt && <LaborTag laborType={li.lt} className="mt-0.5" />}
                        </div>
                        <span className="font-mono text-xs text-appText text-right">{li.hours.toFixed(2)}</span>
                        <span className="font-mono text-xs text-appTextMuted text-right">
                          {li.rate != null ? money(li.rate) : '—'}
                        </span>
                        <span className="font-mono text-xs text-appText text-right">
                          {li.amount != null ? money(li.amount) : '—'}
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
                      {totalAmount != null ? money(totalAmount) : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions — Print is the primary CTA, Export CSV the ghost (per the design) */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-appBorderLight flex-shrink-0">
          <button
            onClick={exportCsv}
            disabled={!lineItems.length}
            aria-disabled={!lineItems.length}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-appInput border border-appBorder hover:bg-appBg text-appTextMuted text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
          <button
            onClick={printInvoice}
            disabled={!lineItems.length}
            aria-disabled={!lineItems.length}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90 text-appOnAccent text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
