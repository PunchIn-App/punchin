import { useEffect, useRef, useCallback, useId } from 'react'
import { X, MonitorDown, Share, Plus } from 'lucide-react'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'

// ---------------------------------------------------------------------------
// Swipe-down-to-dismiss (iOS bottom sheet) — mirrors StartTimerModal.
// ---------------------------------------------------------------------------
function useSwipeDismiss(onClose, hapticTrigger) {
  const ref = useRef(null)
  const startY = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const DISMISS_THRESHOLD = 80
    const onTouchStart = e => { startY.current = e.touches[0].clientY }
    const onTouchEnd = e => {
      if (startY.current === null) return
      const delta = e.changedTouches[0].clientY - startY.current
      startY.current = null
      if (delta > DISMISS_THRESHOLD) { hapticTrigger(); onClose() }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onClose, hapticTrigger])

  return ref
}

// ---------------------------------------------------------------------------
// Android hardware back-button dismiss — mirrors StartTimerModal.
// ---------------------------------------------------------------------------
function useAndroidBackDismiss(onClose, hapticTrigger) {
  useEffect(() => {
    history.pushState({ modal: true }, '')
    const handler = () => { hapticTrigger(); onClose() }
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      if (history.state?.modal) history.back()
    }
  }, [onClose, hapticTrigger])
}

function useSheetStyles(isStandalone, os) {
  if (isStandalone && os === 'ios') {
    return {
      scrim:  'fixed inset-0 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4',
      sheet:  'w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden shadow-xl',
      handle: <div aria-hidden="true" className="flex justify-center pt-2.5 pb-1"><div className="w-9 h-[5px] rounded-full bg-white/30" /></div>,
    }
  }
  if (isStandalone && os === 'android') {
    return {
      scrim:  'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4',
      sheet:  'w-full max-w-md bg-appCard rounded-t-[28px] border border-appBorder overflow-hidden shadow-xl',
      handle: <div aria-hidden="true" className="flex justify-center items-center h-12"><div className="w-8 h-1 rounded-full bg-white/30" /></div>,
    }
  }
  return {
    scrim:  'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4',
    sheet:  'w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden shadow-xl',
    handle: null,
  }
}

// First-run install nudge. Two variants:
//   - canInstall (Chrome/Edge): primary button replays the captured native
//     prompt via onInstall (a user gesture, which the API requires).
//   - otherwise (iOS Safari / any browser with no captured prompt): show the
//     manual Share → Add to Home Screen instructions; there's no API to invoke.
export default function InstallPromptModal({ canInstall, onInstall, onClose }) {
  const { isStandalone, os } = usePlatformContext()
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(isStandalone ? os : 'web')

  const uid = useId()
  const titleId = `${uid}-title`
  const descId  = `${uid}-desc`

  const stableClose = useCallback(onClose, [onClose])
  const noop = useCallback(() => {}, [])

  const swipeRef = useSwipeDismiss(
    isStandalone && os === 'ios'     ? stableClose : noop,
    isStandalone && os === 'ios'     ? hapticTrigger : noop,
  )
  useAndroidBackDismiss(
    isStandalone && os === 'android' ? stableClose : noop,
    isStandalone && os === 'android' ? hapticTrigger : noop,
  )

  const { scrim, sheet, handle } = useSheetStyles(isStandalone, os)

  // Focus first focusable element and trap focus within the dialog.
  useEffect(() => {
    const el = swipeRef.current
    if (!el) return
    const focusable = () => Array.from(el.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ))
    focusable()[0]?.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') { stableClose(); return }
      if (e.key !== 'Tab') return
      const els = focusable()
      if (!els.length) return
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault(); els[els.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault(); els[0].focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [stableClose])

  return (
    <div className={scrim} onClick={onClose}>
      {hapticEl}
      <div
        ref={swipeRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={sheet}
        onClick={e => e.stopPropagation()}
      >
        {handle}

        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
          <div className="flex items-center gap-2.5">
            <MonitorDown className="w-5 h-5 text-appAccent" aria-hidden="true" />
            <h2 id={titleId} className="font-display font-semibold text-appText text-lg">Install PunchIn</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {canInstall ? (
          <>
            <div className="px-5 py-4">
              <p id={descId} className="text-sm text-appTextMuted leading-relaxed">
                Add PunchIn to your home screen for faster access and a full-screen, app-like experience. Your data stays on this device.
              </p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={onInstall}
                className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                           text-[#0F1117] font-display font-bold text-base transition-colors"
              >
                Install
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-appTextMuted hover:text-appText text-sm transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              <p id={descId} className="text-sm text-appTextMuted leading-relaxed">
                Install PunchIn for faster access and a full-screen experience. From your browser:
              </p>
              <ol className="space-y-2.5 text-sm text-appText">
                <li className="flex items-center gap-3">
                  <Share className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Tap the <span className="font-semibold">Share</span> button</span>
                </li>
                <li className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Choose <span className="font-semibold">Add to Home Screen</span></span>
                </li>
              </ol>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                           text-[#0F1117] font-display font-bold text-base transition-colors"
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
