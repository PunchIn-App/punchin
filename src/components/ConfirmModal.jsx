import { useRef, useId } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const titleId = useId() // useId, not a hardcoded id, so two ConfirmModals can coexist (issue #156)

  // Focus defaults to the Cancel button (data-autofocus) — safer for destructive
  // actions; trap + restore + Escape handled by the shared hook (issues #151/#152/#154).
  useFocusTrap(dialogRef, onCancel)

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm bg-appCard rounded-2xl border border-appBorder shadow-xl p-5 space-y-4"
      >
        <div>
          <p id={titleId} className="font-display font-semibold text-appText">{title}</p>
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
            data-autofocus
            className="flex-1 py-2.5 rounded-xl bg-appBg hover:bg-appInput text-appTextMuted text-sm transition-colors border border-appBorder focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
