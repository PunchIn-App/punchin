import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { glyphComponent } from './LaborGlyph'

// A bespoke single-select that shows each option's colour dot / labor glyph +
// label + optional sublabel (e.g. a job's client) — the replacement for native
// <select> wherever the choices carry colour/glyph identity. Option shape:
//   { value, label, sublabel?, color?, glyph? }
// Presence of the `glyph` KEY marks a labor option: it renders the glyph in
// `color`, falling back to the PunchIn brand mark when the value is unset (old
// records) — exactly like glyphComponent()/LaborTag, so the glyph rides along on
// every surface. Job options omit the key entirely and render a colour dot.
//
// `emptyOption` (optional) adds a clear/none row whose value is '' — use it for
// "All Jobs" (filter) or "No default" (optional) selects; omit it for required
// ones so the only way to satisfy them is to pick a real option.
//
// The menu expands IN FLOW (it pushes the following content down) rather than
// floating absolutely. That keeps it from being clipped inside a scroll-container
// modal (e.g. EditEntryModal's `overflow-y-auto` body) and from fighting a modal
// focus trap — the menu lives inside the dialog, so Tab and Escape compose.
// `small` shrinks the glyph/dot for the compact toolbar-chip trigger only —
// the menu rows always render the default size so the open list is unchanged.
function OptionVisual({ opt, small = false }) {
  // A labor option carries a `glyph` key (possibly unset) → render the glyph,
  // defaulting to the brand mark via glyphComponent(undefined). A job option has
  // no `glyph` key → render the colour dot below.
  if (opt && 'glyph' in opt) {
    const Glyph = glyphComponent(opt.glyph)
    return <Glyph className={`${small ? 'w-3.5 h-3.5' : 'w-4 h-4'} flex-shrink-0`} style={{ color: opt.color }} strokeWidth={2} aria-hidden="true" />
  }
  return (
    <span
      className={`${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full flex-shrink-0`}
      style={{ backgroundColor: opt?.color || 'var(--text-disabled)' }}
      aria-hidden="true"
    />
  )
}

export default function EntitySelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyOption,        // { label } | undefined
  hideLabel = false,  // keep `label` as the accessible name but hide the overline
  buttonClassName = '',
  compact = false,    // toolbar-chip trigger + floating (absolute) menu — for filter rows
}) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const wrapRef = useRef(null)
  const uid = useId()
  const labelId = `${uid}-label`

  // Compact (toolbar-filter) menus float `absolute`. In a wrapping toolbar a chip
  // can land in the right half of the row, where a left-anchored 200px menu would
  // overflow the viewport (clipped by Layout's `<main overflow-hidden>`). Measure
  // on open and flip to right-anchored when a left anchor wouldn't fit. Vertical
  // never clips (the menu caps at max-h-60 near the top of the view), so no portal
  // is needed. useLayoutEffect avoids a one-frame flash of the wrong side.
  const MENU_MIN_W = 200
  useLayoutEffect(() => {
    if (!open || !compact) return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) setAlignRight(rect.left + MENU_MIN_W > window.innerWidth - 8)
  }, [open, compact])

  // Outside-click + capture-phase Escape (closes the menu before a surrounding
  // modal's Escape→onClose can fire) — the ColorPicker / GlyphPicker contract.
  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onEscape = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
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

  const selected = options.find(o => String(o.value) === String(value)) || null
  const isEmpty = value === '' || value == null
  const display = selected ? selected.label : (emptyOption && isEmpty ? emptyOption.label : null)
  const triggerName = `${label}, ${selected
    ? `${selected.label}${selected.sublabel ? ', ' + selected.sublabel : ''}`
    : (display ?? 'none selected')}`

  const pick = (v) => { onChange(v); setOpen(false) }

  return (
    <div ref={wrapRef} className="relative">
      {label && !hideLabel && (
        <span
          id={labelId}
          className="block mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-appTextMuted"
          aria-hidden="true"
        >
          {label}
        </span>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerName}
        className={`w-full flex items-center gap-3 border text-left transition-colors
          ${compact ? 'px-2.5 py-2 rounded-lg text-xs bg-appCard' : 'px-4 py-3 rounded-xl text-[15px] bg-appBg'}
          ${open ? 'border-appAccent ring-2 ring-appAccent/20' : 'border-appBorder hover:border-appAccent/40'} ${buttonClassName}`}
      >
        <OptionVisual opt={selected} small={compact} />
        {display ? (
          <>
            <span className={`${compact ? 'text-xs' : 'text-[15px]'} truncate ${selected ? 'font-bold text-appText' : 'text-appTextMuted'}`}>{display}</span>
            {selected?.sublabel && <span className="text-xs text-appTextMuted truncate">{selected.sublabel}</span>}
          </>
        ) : (
          <span className={`${compact ? 'text-xs' : 'text-[15px]'} text-appTextMuted truncate`}>{placeholder}</span>
        )}
        <ChevronDown
          className={`${compact ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} ml-auto flex-shrink-0 text-appTextMuted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`${compact ? `absolute z-50 mt-1 min-w-[200px] ${alignRight ? 'right-0' : 'left-0'}` : 'mt-1.5'} bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-1.5 max-h-60 overflow-y-auto`}
        >
          {emptyOption && (
            <button
              type="button"
              role="option"
              aria-selected={isEmpty}
              onClick={() => pick('')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-appInput transition-colors"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-appTextDisabled" aria-hidden="true" />
              <span className="text-sm text-appTextMuted truncate">{emptyOption.label}</span>
              {isEmpty && <Check className="w-4 h-4 ml-auto flex-shrink-0 text-appAccent" aria-hidden="true" />}
            </button>
          )}
          {options.map(o => {
            const sel = String(o.value) === String(value)
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => pick(String(o.value))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-appInput transition-colors"
              >
                <OptionVisual opt={o} />
                <span className="text-sm font-bold text-appText truncate">{o.label}</span>
                {o.sublabel && <span className="text-xs text-appTextMuted truncate">{o.sublabel}</span>}
                {sel && <Check className="w-4 h-4 ml-auto flex-shrink-0 text-appAccent" aria-hidden="true" />}
              </button>
            )
          })}
          {options.length === 0 && !emptyOption && (
            <p className="px-3 py-2 text-xs text-appTextMuted">No options.</p>
          )}
        </div>
      )}
    </div>
  )
}
