import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Module-level stack of tokens, one per currently-mounted trap. When a dialog is
// stacked over another (e.g. a ConfirmModal opened from inside EditEntryModal),
// only the topmost (most-recently-mounted) trap should react to Escape/Tab —
// otherwise one Escape closes both, and Tab gets re-captured to the inner
// dialog from the outer one's listener (issue: stacked-trap focus management).
const trapStack = []

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

    // Unique identity for THIS trap instance; push onto the stack so the topmost
    // entry can be identified in handleKey, and spliced off on unmount.
    const token = {}
    trapStack.push(token)

    // Snapshot the control that had focus so we can hand it back on close (#152).
    const previouslyFocused = document.activeElement
    const focusable = () => Array.from(el.querySelectorAll(FOCUSABLE))

    const target = initialFocus
      ? initialFocus(el, focusable())
      : (el.querySelector('[data-autofocus]') || focusable()[0])
    if (target) target.focus()

    const handleKey = (e) => {
      // Only the topmost trap reacts — stacked dialogs share this document
      // listener, so without this an Escape/Tab fires every mounted trap.
      if (trapStack[trapStack.length - 1] !== token) return
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
      // Pop this trap off the stack so the one beneath becomes topmost again.
      const i = trapStack.indexOf(token)
      if (i !== -1) trapStack.splice(i, 1)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
    // Runs once per mount: ref is stable, onClose is read through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
