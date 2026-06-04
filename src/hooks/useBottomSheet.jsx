import { useEffect, useRef } from 'react'

// Bottom-sheet dismiss + style helpers shared by the swipeable sheet modals
// (StartTimerModal, InstallPromptModal), where they were duplicated nearly
// character-for-character (issue #151).

// Swipe-down-to-dismiss (iOS bottom sheet). Fires hapticTrigger exactly when the
// threshold is crossed, giving physical confirmation before the sheet animates
// away. Returns the ref to attach to the sheet element.
export function useSwipeDismiss(onClose, hapticTrigger) {
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
      if (delta > DISMISS_THRESHOLD) {
        hapticTrigger()
        onClose()
      }
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

// Android hardware back-button dismiss. Pushes a history entry on open and pops
// it on close so the back gesture dismisses the sheet; fires hapticTrigger when
// the popstate is caught so the dismiss is felt even before the thumb lifts.
export function useAndroidBackDismiss(onClose, hapticTrigger) {
  useEffect(() => {
    history.pushState({ modal: true }, '')
    const handler = () => {
      hapticTrigger()
      onClose()
    }
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      if (history.state?.modal) history.back()
    }
  }, [onClose, hapticTrigger])
}

// Platform-aware scrim / sheet classes + the drag handle element.
export function useSheetStyles(isStandalone, os) {
  if (isStandalone && os === 'ios') {
    return {
      scrim:  'fixed inset-0 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4',
      sheet:  'w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden shadow-xl',
      handle: <div aria-hidden="true" className="flex justify-center pt-2.5 pb-1">
                <div className="w-9 h-[5px] rounded-full bg-white/30" />
              </div>,
    }
  }

  if (isStandalone && os === 'android') {
    return {
      scrim:  'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4',
      sheet:  'w-full max-w-md bg-appCard rounded-t-[28px] border border-appBorder overflow-hidden shadow-xl',
      handle: <div aria-hidden="true" className="flex justify-center items-center h-12">
                <div className="w-8 h-1 rounded-full bg-white/30" />
              </div>,
    }
  }

  return {
    scrim:  'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4',
    sheet:  'w-full max-w-md bg-appCard rounded-2xl border border-appBorder overflow-hidden shadow-xl',
    handle: null,
  }
}
