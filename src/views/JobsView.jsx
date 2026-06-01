import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Archive, ArchiveRestore, Tag, Briefcase } from 'lucide-react'
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

  const save = async () => {
    if (!name.trim()) return
    const data = {
      name: name.trim(),
      clientName: clientName.trim() || null,
      laborTypeId: laborTypeId ? Number(laborTypeId) : null,
    }
    if (job?.id) {
      await db.jobs.update(job.id, data)
    } else {
      await db.jobs.add({ ...data, isActive: true })
    }
    onDone()
  }

  const inputCls = `w-full bg-[#0F1117] border border-[#2A2F45] text-white rounded-lg px-3 py-2 text-sm
                    placeholder-[#374151] focus:outline-none focus:border-amber-500/60 transition-colors`

  return (
    <div className="rounded-xl border border-amber-500/30 bg-[#1A1D27] p-4 space-y-3">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Job name *" className={inputCls} onKeyDown={e => e.key === 'Enter' && save()} />
      <input value={clientName} onChange={e => setClientName(e.target.value)}
        placeholder="Client name (optional)" className={inputCls} />
      <select value={laborTypeId} onChange={e => setLaborTypeId(e.target.value)} className={inputCls}>
        <option value="">Default labor type (optional)...</option>
        {laborTypes?.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
      </select>
      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0F1117] font-bold text-sm transition-colors">
          {job ? 'Save' : 'Add Job'}
        </button>
        <button onClick={onDone}
          className="flex-1 py-2 rounded-lg bg-[#0F1117] hover:bg-[#2A2F45] text-[#9CA3AF] text-sm transition-colors border border-[#2A2F45]">
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
    <div className="rounded-xl border border-amber-500/30 bg-[#1A1D27] p-4 space-y-3">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="Labor type name *"
        onKeyDown={e => e.key === 'Enter' && save()}
        className="w-full bg-[#0F1117] border border-[#2A2F45] text-white rounded-lg px-3 py-2 text-sm
                   placeholder-[#374151] focus:outline-none focus:border-amber-500/60 transition-colors" />
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)}
            className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }} />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0F1117] font-bold text-sm transition-colors">
          {lt ? 'Save' : 'Add Type'}
        </button>
        <button onClick={onDone}
          className="flex-1 py-2 rounded-lg bg-[#0F1117] hover:bg-[#2A2F45] text-[#9CA3AF] text-sm transition-colors border border-[#2A2F45]">
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

  const jobs       = useLiveQuery(() => db.jobs.orderBy('name').toArray(), [])
  const laborTypes = useLiveQuery(() => db.laborTypes.orderBy('name').toArray(), [])

  const toggleArchive = async (job) => {
    await db.jobs.update(job.id, { isActive: job.isActive === false ? true : false })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[#1E2232]">
        {['jobs','labor'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
              ${tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-[#4B5563]'}`}>
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
                           border border-dashed border-[#2A2F45] hover:border-amber-500/40
                           text-[#4B5563] hover:text-amber-400 transition-colors text-sm">
                <Plus className="w-4 h-4" /> Add Job
              </button>
            )}

            {addingJob && (
              <JobForm laborTypes={laborTypes} onDone={() => setAddingJob(false)} />
            )}

            {jobs?.length === 0 && !addingJob && (
              <div className="flex flex-col items-center py-14 text-[#374151]">
                <Briefcase className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No jobs yet. Add one above.</p>
              </div>
            )}

            {jobs?.map(job => {
              const lt = laborTypes?.find(l => l.id === job.laborTypeId)
              if (editingJob?.id === job.id)
                return <JobForm key={job.id} job={job} laborTypes={laborTypes} onDone={() => setEditingJob(null)} />
              return (
                <div key={job.id}
                  className={`rounded-xl border bg-[#161923] p-4 transition-opacity
                    ${job.isActive === false ? 'border-[#1E2232] opacity-50' : 'border-[#2A2F45]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-white truncate">{job.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {job.clientName && <span className="text-xs text-[#6B7280]">{job.clientName}</span>}
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
                        className="p-1.5 rounded-lg hover:bg-[#1E2232] text-[#374151] hover:text-[#9CA3AF] transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleArchive(job)}
                        className="p-1.5 rounded-lg hover:bg-[#1E2232] text-[#374151] hover:text-[#9CA3AF] transition-colors">
                        {job.isActive === false
                          ? <ArchiveRestore className="w-4 h-4" />
                          : <Archive className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── LABOR TYPES tab ── */}
        {tab === 'labor' && (
          <>
            {!addingLT && !editingLT && (
              <button onClick={() => setAddingLT(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border border-dashed border-[#2A2F45] hover:border-amber-500/40
                           text-[#4B5563] hover:text-amber-400 transition-colors text-sm">
                <Plus className="w-4 h-4" /> Add Labor Type
              </button>
            )}

            {addingLT && (
              <LaborTypeForm onDone={() => setAddingLT(false)} />
            )}

            {laborTypes?.length === 0 && !addingLT && (
              <div className="flex flex-col items-center py-14 text-[#374151]">
                <Tag className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No labor types yet.</p>
              </div>
            )}

            {laborTypes?.map(lt => {
              if (editingLT?.id === lt.id)
                return <LaborTypeForm key={lt.id} lt={lt} onDone={() => setEditingLT(null)} />
              return (
                <div key={lt.id} className="flex items-center justify-between rounded-xl border border-[#2A2F45] bg-[#161923] px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
                    <span className="font-medium text-white text-sm">{lt.name}</span>
                  </div>
                  <button onClick={() => setEditingLT(lt)}
                    className="p-1.5 rounded-lg hover:bg-[#1E2232] text-[#374151] hover:text-[#9CA3AF] transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
