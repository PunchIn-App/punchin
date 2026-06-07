import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Archive, ArchiveRestore, Tag, Briefcase, ChevronDown, ChevronRight, Search, DollarSign } from 'lucide-react'
import { db } from '../db'
import ColorPicker from '../components/ColorPicker'
import { LABOR_GLYPH_IDS, glyphComponent, LaborGlyphChip, LaborTag, DEFAULT_LABOR_COLOR } from '../components/LaborGlyph'

// Suggested labor-type colours — the PunchIn design-system pastel rainbow. Users
// can still pick any custom hex via ColorPicker; these are just the quick presets.
const PRESET_COLORS = [
  '#FF8FA3','#FFB163','#E6C84B','#5FD08A','#4FC6E8',
  '#6FA8FF','#9B8CFF','#C77DFF','#FF8FD9','#9AA4B2',
]

const PRESET_COLOR_OBJECTS = PRESET_COLORS.map(hex => ({ hex }))

function JobForm({ job, laborTypes, onDone }) {
  const [name, setName]           = useState(job?.name || '')
  const [clientName, setClientName] = useState(job?.clientName || '')
  const [laborTypeId, setLaborTypeId] = useState(job?.laborTypeId ? String(job.laborTypeId) : '')
  const [laborRates, setLaborRates]   = useState(job?.laborRates || {})
  const [showRates, setShowRates]     = useState(false)

  const setRate = (ltId, val) => {
    setLaborRates(prev => {
      const next = { ...prev }
      if (val === '' || val === undefined) {
        delete next[ltId]
      } else {
        next[ltId] = Number(val)
      }
      return next
    })
  }

  const save = async () => {
    if (!name.trim()) return
    const data = {
      name: name.trim(),
      clientName: clientName.trim() || null,
      laborTypeId: laborTypeId ? Number(laborTypeId) : null,
      laborRates,
    }
    if (job?.id) {
      await db.jobs.update(job.id, data)
    } else {
      await db.jobs.add({ ...data, isActive: true })
    }
    onDone()
  }

  const inputCls = `w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm
                    placeholder-appTextDisabled focus:outline-none focus:border-appAccent/60 transition-colors`

  const activeLTs = laborTypes?.filter(lt => !lt.isArchived) ?? []

  return (
    <div className="rounded-xl border border-appAccent/30 bg-appCard p-4 space-y-3 shadow-md">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Job name *" className={inputCls} onKeyDown={e => e.key === 'Enter' && save()} />
      <input value={clientName} onChange={e => setClientName(e.target.value)}
        placeholder="Client name (optional)" className={inputCls} />
      <select value={laborTypeId} onChange={e => setLaborTypeId(e.target.value)} className={inputCls}>
        <option value="">Default labor type (optional)...</option>
        {laborTypes?.filter(lt => !lt.isArchived || String(lt.id) === laborTypeId).map(lt => (
          <option key={lt.id} value={lt.id}>{lt.name}{lt.isArchived ? ' (archived)' : ''}</option>
        ))}
      </select>

      {/* Hourly rates per labor type */}
      {activeLTs.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRates(v => !v)}
            className="text-xs text-appTextMuted hover:text-appText transition-colors flex items-center gap-1"
          >
            <span>{showRates ? '▾' : '▸'}</span>
            Hourly rates {Object.keys(laborRates).length > 0 ? `(${Object.keys(laborRates).length} set)` : '(optional)'}
          </button>
          {showRates && (
            <div className="mt-2 space-y-2">
              {activeLTs.map(lt => (
                <div key={lt.id} className="flex items-center gap-2">
                  <LaborGlyphChip laborType={lt} className="w-4 h-4" />
                  <span className="text-xs text-appText flex-1 truncate">{lt.name}</span>
                  <div className="relative w-28 flex-shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-appTextMuted pointer-events-none">$/hr</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laborRates[lt.id] ?? ''}
                      onChange={e => setRate(lt.id, e.target.value)}
                      placeholder="—"
                      className="w-full bg-appBg border border-appBorder text-appText rounded-lg pl-9 pr-2 py-1.5 text-xs focus:outline-none focus:border-appAccent/60 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 py-2 rounded-lg bg-appAccent hover:brightness-110 text-appOnAccent font-bold text-sm transition-all">
          {job ? 'Save' : 'Add Job'}
        </button>
        <button onClick={onDone}
          className="flex-1 py-2 rounded-lg bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder">
          Cancel
        </button>
      </div>
    </div>
  )
}

function LaborTypeForm({ lt, onDone }) {
  const [name, setName]   = useState(lt?.name || '')
  const [color, setColor] = useState(lt?.color || DEFAULT_LABOR_COLOR)
  const [glyph, setGlyph] = useState(lt?.glyph || '')

  const save = async () => {
    if (!name.trim()) return
    const data = { name: name.trim(), color, glyph: glyph || null }
    if (lt?.id) {
      await db.laborTypes.update(lt.id, data)
    } else {
      await db.laborTypes.add(data)
    }
    onDone()
  }

  return (
    <div className="rounded-xl border border-appAccent/30 bg-appCard p-4 space-y-4 shadow-md">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Labor type name *"
        onKeyDown={e => e.key === 'Enter' && save()}
        className="w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm
                   placeholder-appTextDisabled focus:outline-none focus:border-appAccent/60 transition-colors" />

      {/* Glyph — so a type reads by shape, not colour alone */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Glyph</p>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Glyph">
          {LABOR_GLYPH_IDS.map(id => {
            const Glyph = glyphComponent(id)
            const selected = glyph === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setGlyph(id)}
                role="radio"
                aria-checked={selected}
                aria-label={id}
                className={`aspect-square flex items-center justify-center rounded-lg border transition-colors
                  ${selected ? 'border-appAccent bg-appAccent/10 text-appAccent' : 'border-appBorder text-appTextMuted hover:text-appText hover:bg-appInput'}`}
              >
                <Glyph className="w-4 h-4" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>

      <ColorPicker
        presets={PRESET_COLOR_OBJECTS}
        value={color}
        onChange={setColor}
        size="lg"
        label="Color"
      />

      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-lg border border-appBorderLight bg-appBg px-3 py-2.5">
        <LaborGlyphChip laborType={{ color, glyph }} className="w-9 h-9" />
        <div className="min-w-0">
          <p className="font-display font-semibold text-appText text-sm truncate">{name.trim() || 'Labor type'}</p>
          <p className="text-xs text-appTextMuted">Shown on timers, timesheets &amp; invoices</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 py-2 rounded-lg bg-appAccent hover:brightness-110 text-appOnAccent font-bold text-sm transition-all">
          {lt ? 'Save' : 'Add Type'}
        </button>
        <button onClick={onDone}
          className="flex-1 py-2 rounded-lg bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function JobsView() {
  const [tab, setTab]           = useState('jobs')
  const [addingJob, setAddingJob]   = useState(false)
  const [editingJob, setEditingJob]  = useState(null)
  const [addingLT, setAddingLT]    = useState(false)
  const [editingLT, setEditingLT]   = useState(null)
  const [showArchivedJobs, setShowArchivedJobs] = useState(false)
  const [showArchivedLT, setShowArchivedLT]     = useState(false)
  const [archiveJobSearch, setArchiveJobSearch] = useState('')
  const [archiveLTSearch, setArchiveLTSearch]   = useState('')

  const jobs       = useLiveQuery(async () => {
    const all = await db.jobs.toArray()
    return [...all].sort((a, b) => a.name.localeCompare(b.name))
  }, [])
  const laborTypes = useLiveQuery(() => db.laborTypes.orderBy('name').toArray(), [])

  const toggleArchiveLaborType = async (lt) => {
    await db.laborTypes.update(lt.id, { isArchived: !lt.isArchived })
  }

  const toggleArchive = async (job) => {
    await db.jobs.update(job.id, { isActive: job.isActive === false ? true : false })
  }

  const activeJobCount = jobs?.filter(j => j.isActive !== false).length ?? 0
  const archivedJobCount = jobs?.filter(j => j.isActive === false).length ?? 0
  const activeLtCount = laborTypes?.filter(lt => !lt.isArchived).length ?? 0

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 scrollable px-4 pt-4 pb-24 lg:px-6 space-y-4">
        {/* Header: title + count subtitle + segmented tab control */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-appText text-2xl">{tab === 'labor' ? 'Labor Types' : 'Jobs'}</h1>
            <p className="text-appTextMuted text-sm mt-1">
              {tab === 'jobs'
                ? `${activeJobCount} active · ${archivedJobCount} archived`
                : `${activeLtCount} labor type${activeLtCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div role="tablist" className="inline-flex flex-shrink-0 bg-appCard border border-appBorder rounded-xl p-1">
            {['jobs','labor'].map(t => (
              <button key={t} onClick={() => setTab(t)} role="tab" aria-selected={tab === t}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${tab === t ? 'bg-appInput text-appText' : 'text-appTextMuted hover:text-appText'}`}>
                {t === 'labor' ? 'Labor Types' : 'Jobs'}
              </button>
            ))}
          </div>
        </div>
        {/* ── JOBS tab ── */}
        {tab === 'jobs' && (
          <>
            {!addingJob && !editingJob && (
              <button onClick={() => setAddingJob(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border border-dashed border-appBorder hover:border-appAccent/40
                           text-appTextMuted hover:text-appAccent transition-colors text-sm">
                <Plus className="w-4 h-4" /> Add Job
              </button>
            )}

            {addingJob && (
              <JobForm laborTypes={laborTypes} onDone={() => setAddingJob(false)} />
            )}

            {jobs?.filter(j => j.isActive !== false).length === 0 && !addingJob && (
              <div className="flex flex-col items-center py-14 text-appTextDisabled">
                <Briefcase className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No jobs yet. Add one above.</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {jobs?.filter(j => j.isActive !== false).map(job => {
                const lt = laborTypes?.find(l => l.id === job.laborTypeId)
                const rateCount = Object.keys(job.laborRates || {}).length
                if (editingJob?.id === job.id)
                  return <div key={job.id} className="lg:col-span-2"><JobForm job={job} laborTypes={laborTypes} onDone={() => setEditingJob(null)} /></div>
                return (
                  <div key={job.id} className="relative rounded-xl border border-appBorder bg-appCard overflow-hidden transition-all duration-200">
                    {/* ticket left-rail in the job's labor colour */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: lt?.color || 'transparent' }} aria-hidden="true" />
                    <div className="pl-4 pr-3 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-appText truncate">{job.name}</p>
                          {job.clientName && <p className="text-xs text-appTextMuted truncate mt-0.5">{job.clientName}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setEditingJob(job)} aria-label={`Edit ${job.name}`}
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-appBorder bg-appBg text-appTextMuted hover:text-appText hover:bg-appInput transition-colors">
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button onClick={() => toggleArchive(job)} aria-label={`Archive ${job.name}`}
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-appBorder bg-appBg text-appTextMuted hover:text-appText hover:bg-appInput transition-colors">
                            <Archive className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {/* meta row: labor tag (left) + rates indicator (right) */}
                      <div className="flex items-center justify-between gap-2 mt-3">
                        {lt ? <LaborTag laborType={lt} /> : <span className="text-[10px] text-appTextDisabled uppercase tracking-wider">No labor type</span>}
                        <span className="flex items-center gap-1 text-xs flex-shrink-0">
                          <DollarSign className="w-3.5 h-3.5 text-appTextMuted" aria-hidden="true" />
                          {rateCount > 0
                            ? <span className="text-appTextMuted">{rateCount} rate{rateCount === 1 ? '' : 's'} set</span>
                            : <span className="text-appTextDisabled">No rates set</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {(() => {
              const archived = jobs?.filter(j => j.isActive === false) ?? []
              if (archived.length === 0) return null
              return (
                <>
                  <button
                    onClick={() => setShowArchivedJobs(v => !v)}
                    aria-expanded={showArchivedJobs}
                    className="w-full flex items-center gap-2 py-2 px-1 text-xs text-appTextDisabled hover:text-appTextMuted transition-colors">
                    {showArchivedJobs
                      ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                    Archived ({archived.length})
                  </button>
                  {showArchivedJobs && (
                    <div className="relative mb-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-appTextDisabled pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search archived…"
                        value={archiveJobSearch}
                        onChange={e => setArchiveJobSearch(e.target.value)}
                        className="w-full bg-appBg border border-appBorder text-appText rounded-lg pl-9 pr-3 py-2 text-sm
                                   placeholder-appTextDisabled focus:outline-none focus:border-appAccent/60 transition-colors"
                      />
                    </div>
                  )}
                  {showArchivedJobs && archived
                    .filter(j => !archiveJobSearch || j.name.toLowerCase().includes(archiveJobSearch.toLowerCase()))
                    .map(job => {
                    const lt = laborTypes?.find(l => l.id === job.laborTypeId)
                    if (editingJob?.id === job.id)
                      return <JobForm key={job.id} job={job} laborTypes={laborTypes} onDone={() => setEditingJob(null)} />
                    return (
                      <div key={job.id}
                        className="rounded-xl border border-appBorderLight bg-appCard p-4 opacity-60 transition-all duration-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display font-semibold text-appText truncate">{job.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {job.clientName && <span className="text-xs text-appTextMuted">{job.clientName}</span>}
                              {lt && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${lt.color}25`, color: lt.color }}>
                                  {lt.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => toggleArchive(job)}
                              aria-label={`Restore ${job.name}`}
                              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-appText transition-colors">
                              <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </>
        )}

        {/* ── LABOR TYPES tab ── */}
        {tab === 'labor' && (
          <>
            {!addingLT && !editingLT && (
              <button onClick={() => setAddingLT(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border border-dashed border-appBorder hover:border-appAccent/40
                           text-appTextMuted hover:text-appAccent transition-colors text-sm">
                <Plus className="w-4 h-4" /> Add Labor Type
              </button>
            )}

            {addingLT && (
              <LaborTypeForm onDone={() => setAddingLT(false)} />
            )}

            {laborTypes?.filter(lt => !lt.isArchived).length === 0 && !addingLT && (
              <div className="flex flex-col items-center py-14 text-appTextDisabled">
                <Tag className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No labor types yet.</p>
              </div>
            )}

            {laborTypes?.filter(lt => !lt.isArchived).map(lt => {
              if (editingLT?.id === lt.id)
                return <LaborTypeForm key={lt.id} lt={lt} onDone={() => setEditingLT(null)} />
              return (
                <div key={lt.id}
                  className="flex items-center justify-between rounded-xl border border-appBorder bg-appCard px-4 py-3.5 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <LaborGlyphChip laborType={lt} />
                    <span className="font-medium text-appText text-sm">{lt.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingLT(lt)}
                      aria-label={`Edit ${lt.name}`}
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-appText transition-colors">
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button onClick={() => toggleArchiveLaborType(lt)}
                      aria-label={`Archive ${lt.name}`}
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-appText transition-colors">
                      <Archive className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}

            {(() => {
              const archived = laborTypes?.filter(lt => lt.isArchived) ?? []
              if (archived.length === 0) return null
              return (
                <>
                  <button
                    onClick={() => setShowArchivedLT(v => !v)}
                    aria-expanded={showArchivedLT}
                    className="w-full flex items-center gap-2 py-2 px-1 text-xs text-appTextDisabled hover:text-appTextMuted transition-colors">
                    {showArchivedLT
                      ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                    Archived ({archived.length})
                  </button>
                  {showArchivedLT && (
                    <div className="relative mb-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-appTextDisabled pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search archived…"
                        value={archiveLTSearch}
                        onChange={e => setArchiveLTSearch(e.target.value)}
                        className="w-full bg-appBg border border-appBorder text-appText rounded-lg pl-9 pr-3 py-2 text-sm
                                   placeholder-appTextDisabled focus:outline-none focus:border-appAccent/60 transition-colors"
                      />
                    </div>
                  )}
                  {showArchivedLT && archived
                    .filter(lt => !archiveLTSearch || lt.name.toLowerCase().includes(archiveLTSearch.toLowerCase()))
                    .map(lt => {
                    if (editingLT?.id === lt.id)
                      return <LaborTypeForm key={lt.id} lt={lt} onDone={() => setEditingLT(null)} />
                    return (
                      <div key={lt.id}
                        className="flex items-center justify-between rounded-xl border border-appBorderLight bg-appCard px-4 py-3.5 opacity-60 transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <LaborGlyphChip laborType={lt} />
                          <span className="font-medium text-appText text-sm">{lt.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleArchiveLaborType(lt)}
                            aria-label={`Restore ${lt.name}`}
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-appInput text-appTextMuted hover:text-appText transition-colors">
                            <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
