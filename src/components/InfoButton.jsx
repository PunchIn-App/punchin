import { useId } from 'react'
import { Info } from 'lucide-react'
import { useAnchoredPopover } from '../hooks/useAnchoredPopover'

// A small "ⓘ" affordance that toggles a floating help panel — the WAI-ARIA
// disclosure pattern for moving on-demand detail OFF an overloaded caption
// (issue: settings caption bloat). Built on useAnchoredPopover, so it inherits
// the fixed-position flip/clamp, outside-click, capture-phase Escape, and
// focus-restore contract the DatePicker/TimePicker use. Click-to-toggle, not a
// hover tooltip (there's no hover on touch, and the app is mobile-first).
//
// Rendered entirely as phrasing content (spans + a button) so it is valid inline
// beside a row title inside a <p> — a block <div> panel there would be invalid
// and break the layout. The panel is `position: fixed` (from the hook) so it
// floats over content regardless of its inline parent.
//
// `children` (the help content) must likewise be INLINE — plain text or inline
// elements. It renders inside the panel <span>, which can sit inside a host's
// title <p>, so a block-level child would reintroduce invalid <p> nesting.
export default function InfoButton({ label, children, className = '' }) {
  const { open, setOpen, wrapRef, menuRef, triggerRef, menuStyle } = useAnchoredPopover({ width: 248, maxHeight: 220 })
  const panelId = `${useId()}-info`

  return (
    <span ref={wrapRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-appTextMuted
                   hover:text-appText hover:bg-appInput transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-appAccent/50"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          ref={menuRef}
          id={panelId}
          role="note"
          style={menuStyle}
          className="block z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)]
                     p-3 text-xs text-appTextMuted leading-relaxed normal-case font-normal tracking-normal"
        >
          {children}
        </span>
      )}
    </span>
  )
}
