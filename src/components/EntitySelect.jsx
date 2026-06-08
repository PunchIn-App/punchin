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
// The menu OVERLAYS (floats over) content rather than expanding in flow. It uses
// `position: fixed` positioned off the trigger's rect (flips above when there's
// no room below, clamps into the viewport) so it's never clipped by a scroll-
// container modal (e.g. EditEntryModal's `overflow-y-auto` body) — fixed escapes
// ancestor overflow, and there's no transformed ancestor to contain it. The menu
// stays inside the trigger's DOM subtree, so the modal focus-trap, Escape, and
// outside-click all still compose. It closes on any outer scroll so a fixed menu
// never drifts from its (now-moved) trigger.
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

const MENU_MIN_W = 200   // compact toolbar chips are narrow; floor the menu width
const MENU_MAX_H = 240   // matches max-h-60
const MENU_GAP = 6

export default function EntitySelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyOption,        // { label } | undefined
  hideLabel = false,  // keep `label` as the accessible name but hide the overline
  buttonClassName = '',
  compact = false,    // toolbar-chip trigger (the floating menu is the same in both modes)
  plain = false,      // plain value list (no colour/glyph identity) — suppress the
                      // leading dot/glyph so it reads as a normal dropdown. Use for
                      // settings selects (time format, currency, rounding, weekday).
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)   // { left, width, top? , bottom? } in viewport coords
  const wrapRef = useRef(null)
  const menuRef = useRef(null)
  const uid = useId()
  const labelId = `${uid}-label`

  // Position the floating menu off the trigger: match the trigger width (min 200
  // for narrow compact chips), flip above when there's no room below, and clamp
  // into the viewport. useLayoutEffect computes before paint so there's no flash.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const compute = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.max(r.width, MENU_MIN_W)
      const left = Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8))
      const roomBelow = vh - r.bottom
      const flipUp = roomBelow < MENU_MAX_H + MENU_GAP && r.top > roomBelow
      setPos(flipUp
        ? { left, width, bottom: vh - r.top + MENU_GAP }
        : { left, width, top: r.bottom + MENU_GAP })
    }
    compute()
    const onScroll = (e) => {
      // Ignore the menu's own internal scroll; close on any outer scroll so the
      // fixed menu doesn't float away from a trigger that has moved.
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // Outside-click + capture-phase Escape (closes the menu before a surrounding
  // modal's Escape→onClose can fire) — the ColorPicker / GlyphPicker contract.
  // The menu is inside wrapRef's subtree (despite being position: fixed), so
  // contains() correctly treats option clicks as inside.
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
        {!plain && <OptionVisual opt={selected} small={compact} />}
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
          ref={menuRef}
          role="listbox"
          aria-label={label}
          style={pos
            ? { position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }
            : { position: 'fixed', visibility: 'hidden' }}
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-1.5 max-h-60 overflow-y-auto"
        >
          {emptyOption && (
            <button
              type="button"
              role="option"
              aria-selected={isEmpty}
              onClick={() => pick('')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-appInput transition-colors"
            >
              {!plain && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-appTextDisabled" aria-hidden="true" />}
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
                {!plain && <OptionVisual opt={o} />}
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
