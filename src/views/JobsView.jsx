import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Archive, ArchiveRestore, Tag, Briefcase, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { db } from '../db'

const PRESET_COLORS = [
  '#6366F1','#F59E0B','#22C55E','#3B82F6',
  '#EF4444','#EC4899','#8B5CF6','#14B8A6',
  '#F97316','#06B6D4',
]

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
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
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
          className="flex-1 py-2 rounded-lg bg-appAccent hover:brightness-110 text-[#0F1117] font-bold text-sm transition-all">
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
  const [color, setColor] = useState(lt?.color || '#6366F1')

  const save = async () => {
    if (!name.trim()) return
    if (lt?.id) {
      await db.laborTypes.update(lt.id, { name: name.trim(), color })
    } else {
      await db.laborTypes.add({ name: name.trim(), color })
    }
    onDone()
  }

  return (
    <div className="rounded-xl border border-appAccent/30 bg-appCard p-4 space-y-3 shadow-md">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Labor type name *"
        onKeyDown={e => e.key === 'Enter' && save()}
        className="w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm
                   placeholder-appTextDisabled focus:outline-none focus:border-appAccent/60 transition-colors" />
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)}
            className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }} />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 py-2 rounded-lg bg-appAccent hover:brightness-110 text-[#0F1117] font-bold text-sm transition-all">
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
    return all.filter(j => j.isDeleted !== true).sort((a, b) => a.name.localeCompare(b.name))
  }, [])
  const laborTypes = useLiveQuery(() => db.laborTypes.orderBy('name').toArray(), [])

  const toggleArchiveLaborType = async (lt) => {
    await db.laborTypes.update(lt.id, { isArchived: !lt.isArchived })
  }

  const toggleArchive = async (job) => {
    await db.jobs.update(job.id, { isActive: job.isActive === false ? true : false })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-appBorderLight">
        {['jobs','labor'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
              ${tab === t ? 'text-appAccent border-b-2 border-appAccent' : 'text-appTextMuted'}`}>
            {t === 'labor' ? 'Labor Types' : 'Jobs'}
          </button>
        ))}
      </div>

      <div className="flex-1 scrollable px-4 pt-4 pb-24 space-y-3">
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

            {jobs?.filter(j => j.isActive !== false).map(job => {
              const lt = laborTypes?.find(l => l.id === job.laborTypeId)
              if (editingJob?.id === job.id)
                return <JobForm key={job.id} job={job} laborTypes={laborTypes} onDone={() => setEditingJob(null)} />
              return (
                <div key={job.id}
                  className="rounded-xl border border-appBorder bg-appCard p-4 transition-all duration-200">
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
                      <button onClick={() => setEditingJob(job)}
                        className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                        title="Edit Job">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleArchive(job)}
                        className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                        title="Archive Job">
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {(() => {
              const archived = jobs?.filter(j => j.isActive === false) ?? []
              if (archived.length === 0) return null
              return (
                <>
                  <button
                    onClick={() => setShowArchivedJobs(v => !v)}
                    className="w-full flex items-center gap-2 py-2 px-1 text-xs text-appTextDisabled hover:text-appTextMuted transition-colors">
                    {showArchivedJobs
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />}
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
                              className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                              title="Restore Job">
                              <ArchiveRestore className="w-4 h-4" />
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
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
                    <span className="font-medium text-appText text-sm">{lt.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingLT(lt)}
                      className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                      title="Edit Labor Type">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleArchiveLaborType(lt)}
                      className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                      title="Archive Labor Type">
                      <Archive className="w-4 h-4" />
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
                    className="w-full flex items-center gap-2 py-2 px-1 text-xs text-appTextDisabled hover:text-appTextMuted transition-colors">
                    {showArchivedLT
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />}
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
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
                          <span className="font-medium text-appText text-sm">{lt.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleArchiveLaborType(lt)}
                            className="p-1.5 rounded-lg hover:bg-appInput text-appTextDisabled hover:text-appTextMuted transition-colors"
                            title="Restore Labor Type">
                            <ArchiveRestore className="w-4 h-4" />
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
