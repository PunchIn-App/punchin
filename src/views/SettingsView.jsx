import { Download, Trash2, Layers, Calendar, Info } from 'lucide-react'
import { db } from '../db'
import { useSettings } from '../hooks/useSettings'

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
        ${value ? 'bg-amber-500' : 'bg-[#2A2F45]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
        ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function SettingsRow({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 text-[#4B5563] flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-white font-medium">{title}</p>
          {subtitle && <p className="text-xs text-[#4B5563] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export default function SettingsView() {
  const { settings, updateSetting } = useSettings()

  const exportData = async () => {
    const [jobs, entries, laborTypes] = await Promise.all([
      db.jobs.toArray(),
      db.entries.toArray(),
      db.laborTypes.toArray(),
    ])
    const json = JSON.stringify({ version: 1, exportedAt: new Date(), jobs, entries, laborTypes }, null, 2)
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      download: `punchin-${new Date().toISOString().slice(0,10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const clearEntries = async () => {
    if (window.confirm('Permanently delete ALL time entries? Jobs and labor types are kept.')) {
      await db.entries.clear()
    }
  }

  return (
    <div className="h-full scrollable px-4 pt-4 pb-24 space-y-6">

      {/* Timer */}
      <section>
        <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest mb-2 px-1">Timer</p>
        <div className="rounded-xl border border-[#2A2F45] bg-[#161923] divide-y divide-[#1E2232]">
          <SettingsRow
            icon={Layers}
            title="Concurrent timers"
            subtitle="Run multiple jobs at the same time"
            right={
              <Toggle
                value={!!settings.allowConcurrentTimers}
                onChange={v => updateSetting('allowConcurrentTimers', v)}
              />
            }
          />
        </div>
      </section>

      {/* Calendar */}
      <section>
        <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest mb-2 px-1">Calendar</p>
        <div className="rounded-xl border border-[#2A2F45] bg-[#161923] divide-y divide-[#1E2232]">
          <SettingsRow
            icon={Calendar}
            title="Week starts Monday"
            subtitle="Off = week starts Sunday"
            right={
              <Toggle
                value={settings.weekStartsMonday !== false}
                onChange={v => updateSetting('weekStartsMonday', v)}
              />
            }
          />
        </div>
      </section>

      {/* Data */}
      <section>
        <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest mb-2 px-1">Data</p>
        <div className="rounded-xl border border-[#2A2F45] bg-[#161923] divide-y divide-[#1E2232]">
          <button onClick={exportData}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#1E2232] transition-colors text-left">
            <Download className="w-4 h-4 text-[#4B5563] flex-shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">Export data</p>
              <p className="text-xs text-[#4B5563] mt-0.5">Download a JSON backup of everything</p>
            </div>
          </button>
          <button onClick={clearEntries}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-500/10 transition-colors text-left group">
            <Trash2 className="w-4 h-4 text-[#4B5563] group-hover:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-white font-medium group-hover:text-red-400">Clear time entries</p>
              <p className="text-xs text-[#4B5563] mt-0.5">Permanent — jobs and types are kept</p>
            </div>
          </button>
        </div>
      </section>

      {/* About */}
      <section>
        <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest mb-2 px-1">About</p>
        <div className="rounded-xl border border-[#2A2F45] bg-[#161923]">
          <SettingsRow
            icon={Info}
            title="PunchIn"
            subtitle="v0.1.0 · Phase 1 · Data stored on this device"
            right={null}
          />
        </div>
      </section>
    </div>
  )
}
