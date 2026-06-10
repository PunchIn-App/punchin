import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A floating panel anchored to a trigger — the positioning + dismiss contract
// shared by the custom TimePicker / DatePicker. Extracted from EntitySelect's
// inline menu logic; EntitySelect still carries its own copy (it predates this
// and is heavily tested) — consolidating it onto this hook is a follow-up.
//
// The panel uses `position: fixed` off the trigger's rect so it's never clipped
// by a scroll-container modal (e.g. EditEntryModal's `overflow-y-auto` body) —
// fixed escapes ancestor overflow. It flips above when there's no room below,
// clamps into the viewport, and closes on outside-click, capture-phase Escape
// (before a surrounding modal's Escape→onClose can fire), and any outer scroll
// (so a fixed panel never drifts from a trigger that has moved).
//
// `width`/`maxHeight` describe the panel's own size (the panel renders at
// `width`); they're needed up-front to clamp/flip without a measure pass.
const GAP = 6

export function useAnchoredPopover({ width = 240, maxHeight = 280 } = {}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null) // { left, top?, bottom? } in viewport coords
  const wrapRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const compute = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const left = Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8))
      const roomBelow = vh - r.bottom
      const flipUp = roomBelow < maxHeight + GAP && r.top > roomBelow
      setPos(flipUp
        ? { left, bottom: vh - r.top + GAP }
        : { left, top: r.bottom + GAP })
    }
    compute()
    const onScroll = (e) => {
      // Ignore the panel's own internal scroll (e.g. a wheel column); close on any
      // outer scroll so the fixed panel doesn't float away from its trigger.
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, width, maxHeight])

  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onEscape = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // close the panel before a surrounding modal's Escape fires
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [open])

  const menuStyle = pos
    ? { position: 'fixed', left: pos.left, width, top: pos.top, bottom: pos.bottom }
    : { position: 'fixed', visibility: 'hidden' }

  return { open, setOpen, wrapRef, menuRef, menuStyle }
}
