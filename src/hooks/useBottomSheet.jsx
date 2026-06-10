import { useEffect, useRef } from 'react'

// Bottom-sheet dismiss + style helpers shared by the swipeable sheet modals
// (StartTimerModal, InstallPromptModal), where they were duplicated nearly
// character-for-character (issue #151).

// Walk up from the touch target to the sheet element, returning the first
// scrollable ancestor (vertical overflow that actually has content to scroll).
// Used to tell "I'm dragging the sheet itself" apart from "I'm scrolling a list
// inside it" — without that distinction a fling down a job list would silently
// dismiss the sheet, discarding the user's input.
function scrollableAncestorWithin(target, root) {
  let node = target
  while (node && node !== root.parentElement) {
    if (node instanceof Element && node.scrollHeight > node.clientHeight) {
      const oy = getComputedStyle(node).overflowY
      if (oy === 'auto' || oy === 'scroll') return node
    }
    node = node.parentElement
  }
  return null
}

// Swipe-down-to-dismiss (iOS bottom sheet). Fires hapticTrigger exactly when the
// threshold is crossed, giving physical confirmation before the sheet animates
// away. Returns the ref to attach to the sheet element.
//
// The gesture only counts as a dismiss when it begins on the sheet chrome (or on
// a scroll container already pinned to the top) AND no scrollable descendant
// actually scrolls during the drag — so scrolling inner content (e.g. the
// StartTimerModal job list) can never silently throw the sheet away. The close
// button, Escape, and backdrop-tap paths are unaffected (they don't go through
// here); the haptic still fires on a real dismiss.
export function useSwipeDismiss(onClose, hapticTrigger) {
  const ref = useRef(null)
  const startY = useRef(null)
  // The scrollable descendant under the finger at touchstart (if any) and its
  // scrollTop then, so we can detect actual scrolling during the gesture.
  const scroller = useRef(null)
  const startScrollTop = useRef(0)
  const cancelled = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const DISMISS_THRESHOLD = 80

    const onTouchStart = e => {
      startY.current = e.touches[0].clientY
      cancelled.current = false
      const sc = scrollableAncestorWithin(e.target, el)
      scroller.current = sc
      startScrollTop.current = sc ? sc.scrollTop : 0
      // Starting a drag while inner content is already scrolled away from the
      // top means the finger is mid-list, not on the sheet — never a dismiss.
      if (sc && sc.scrollTop > 0) cancelled.current = true
    }
    const onTouchMove = () => {
      // If the scroll container under the finger actually moved, the gesture is
      // a scroll, not a sheet drag — disqualify it from dismissing.
      const sc = scroller.current
      if (sc && sc.scrollTop !== startScrollTop.current) cancelled.current = true
    }
    const onTouchEnd = e => {
      if (startY.current === null) return
      const delta = e.changedTouches[0].clientY - startY.current
      const blocked = cancelled.current
      startY.current = null
      scroller.current = null
      cancelled.current = false
      if (!blocked && delta > DISMISS_THRESHOLD) {
        hapticTrigger()
        onClose()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
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
