import { useRef, useState } from 'react'
import { Download, Cloud, X } from 'lucide-react'
import { importSnapshot } from '../sync/syncManager'

// Shown once on a fresh / empty install: an installed PWA gets a SEPARATE data
// store from the browser that installed it, so jobs, entries, and settings don't
// carry over on their own. Offer to restore a backup (which now also brings your
// preferences across) or connect cloud sync. "Start fresh" / × dismisses for good
// (the caller localStorage-gates it so this never nags twice).
export default function FirstRunImport({ onDismiss, onConnectSync }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const data = JSON.parse(await file.text())
      if (!data.version || !Array.isArray(data.jobs) || !Array.isArray(data.entries) || !Array.isArray(data.laborTypes)) {
        setError('That doesn’t look like a PunchIn backup file.')
        return
      }
      await importSnapshot(data)
      onDismiss() // imported — never show this again
    } catch (err) {
      setError('Couldn’t import that file: ' + err.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="firstrun-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full sm:max-w-sm bg-appCard border border-appBorder rounded-2xl shadow-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="firstrun-title" className="font-display font-bold text-appText text-lg">Bring your data over?</h2>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1.5 -m-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-appTextMuted mt-1.5">
          An installed app keeps its own data, separate from your browser — so your jobs, entries, and settings don’t carry over on their own. Restore a backup or connect cloud sync to bring them across.
        </p>
        {error && <p role="alert" className="text-xs text-red-400 mt-3">{error}</p>}
        <div className="mt-4 space-y-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-appAccent text-appOnAccent font-semibold shadow-[var(--shadow-accent)] disabled:opacity-60 transition-all"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> {busy ? 'Importing…' : 'Import a backup file'}
          </button>
          <button
            onClick={onConnectSync}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-appInput text-appText font-medium hover:brightness-110 transition-all"
          >
            <Cloud className="w-4 h-4" aria-hidden="true" /> Connect cloud sync
          </button>
          <button
            onClick={onDismiss}
            className="w-full px-4 py-2.5 rounded-lg text-appTextMuted text-sm hover:text-appText transition-colors"
          >
            Start fresh
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onFile} aria-label="Import backup JSON file" />
      </div>
    </div>
  )
}
