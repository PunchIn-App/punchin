import { useEffect, useRef } from 'react'

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    // Focus the Cancel button by default — safer for destructive actions
    const buttons = el.querySelectorAll('button')
    if (buttons.length > 1) buttons[1].focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key !== 'Tab') return
      const focusable = Array.from(el.querySelectorAll('button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-sm bg-appCard rounded-2xl border border-appBorder shadow-xl p-5 space-y-4"
      >
        <div>
          <p id="confirm-modal-title" className="font-display font-semibold text-appText">{title}</p>
          {message && <p className="text-sm text-appTextMuted mt-1">{message}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
