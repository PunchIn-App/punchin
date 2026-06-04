import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Shared modal focus management, replacing the ~20-line trap that was duplicated
// across every modal (issue #151). It:
//   - moves focus into the dialog on open — to [data-autofocus] if present, else
//     the first focusable element, or whatever opts.initialFocus(el, focusables)
//     returns (e.g. the scrollable container for long content)
//   - traps Tab within the dialog, and pulls focus back in if it has escaped to
//     a detached/native-overlay node — a container-scoped trap (issue #154)
//   - restores focus to the element that opened the dialog on close, per the
//     WAI-ARIA dialog pattern (issue #152)
//   - closes on Escape
//
// `ref` is the dialog element ref; `onClose` is called on Escape.
export function useFocusTrap(ref, onClose, opts = {}) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const initialFocus = opts.initialFocus

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Snapshot the control that had focus so we can hand it back on close (#152).
    const previouslyFocused = document.activeElement
    const focusable = () => Array.from(el.querySelectorAll(FOCUSABLE))

    const target = initialFocus
      ? initialFocus(el, focusable())
      : (el.querySelector('[data-autofocus]') || focusable()[0])
    if (target) target.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return }
      if (e.key !== 'Tab') return
      const els = focusable()
      if (!els.length) return
      // Keep focus inside the dialog even if it wandered out (#154).
      if (!el.contains(document.activeElement)) {
        e.preventDefault(); els[0].focus(); return
      }
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault(); els[els.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault(); els[0].focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
    // Runs once per mount: ref is stable, onClose is read through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
