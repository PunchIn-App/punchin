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
  const [active, setActive] = useState(0) // roving-tabindex active option index (WCAG 4.1.2)
  const wrapRef = useRef(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)        // refocus target on select/Escape (WCAG 2.4.3)
  const optionRefs = useRef([])          // option DOM nodes, in render order, for roving focus
  const uid = useId()
  const labelId = `${uid}-label`

  // The options as one flat, ordered list — the optional emptyOption is the
  // first row, exactly as rendered — so the listbox keyboard model (roving
  // tabindex, Arrow/Home/End, Enter/Space) treats every row uniformly. `v` is
  // the value passed to pick(): '' for the empty row, String(o.value) otherwise.
  const rows = [
    ...(emptyOption ? [{ v: '', selected: value === '' || value == null }] : []),
    ...options.map(o => ({ v: String(o.value), selected: String(o.value) === String(value) })),
  ]

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
      // Restore focus to the trigger before the menu unmounts so focus doesn't
      // drop to <body> (WCAG 2.4.3). The trigger node stays mounted.
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [open])

  // Listbox keyboard model (WAI-ARIA APG): on open, move focus INTO the listbox
  // to the currently-selected option (else the first), and seed the roving
  // active index there. useLayoutEffect runs after the menu mounts but before
  // paint so focus lands without a flash. Re-seeds the index every open.
  useLayoutEffect(() => {
    if (!open) { setActive(0); return }
    const sel = rows.findIndex(r => r.selected)
    const start = sel >= 0 ? sel : 0
    setActive(start)
    optionRefs.current[start]?.focus()
    // rows is derived from value/options/emptyOption; `open` is the trigger we
    // care about — recomputing on every render would refocus mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Move the roving active option: focus it and flip its tabindex to 0 (the
  // rest go to -1 in render). No wrap at the ends — Home/End reach the extremes.
  const moveActive = (i) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, i))
    setActive(clamped)
    optionRefs.current[clamped]?.focus()
  }

  // Arrow/Home/End/Enter/Space on the listbox. Enter/Space select the active
  // option via pick() (which closes + returns focus to the trigger, PR1). Other
  // keys (Escape, Tab) fall through to the existing handlers / native behaviour.
  const onListKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveActive(active + 1); break
      case 'ArrowUp':   e.preventDefault(); moveActive(active - 1); break
      case 'Home':      e.preventDefault(); moveActive(0); break
      case 'End':       e.preventDefault(); moveActive(rows.length - 1); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        rows[active] && pick(rows[active].v)
        break
      default: break
    }
  }

  const selected = options.find(o => String(o.value) === String(value)) || null
  const isEmpty = value === '' || value == null
  const display = selected ? selected.label : (emptyOption && isEmpty ? emptyOption.label : null)
  const triggerName = `${label}, ${selected
    ? `${selected.label}${selected.sublabel ? ', ' + selected.sublabel : ''}`
    : (display ?? 'none selected')}`

  // Selecting an option unmounts the menu, so refocus the (still-mounted) trigger
  // first or focus falls to <body> (WCAG 2.4.3). :focus-visible means mouse users
  // won't see a ring, so unconditional refocus on selection is safe.
  const pick = (v) => { onChange(v); setOpen(false); triggerRef.current?.focus() }

  // Reset the roving-tabindex ref list each render so removed options don't
  // leave stale nodes; the option `ref` callbacks below refill it in order.
  optionRefs.current = []

  return (
    <div ref={wrapRef} className="relative">
      {label && !hideLabel && (
        <span
          id={labelId}
          className="block mb-2 ds-overline text-appTextMuted"
          aria-hidden="true"
        >
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
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
          onKeyDown={onListKeyDown}
          style={pos
            ? { position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }
            : { position: 'fixed', visibility: 'hidden' }}
          className="z-50 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-1.5 max-h-60 overflow-y-auto"
        >
          {emptyOption && (
            <button
              ref={(el) => { optionRefs.current[0] = el }}
              type="button"
              role="option"
              aria-selected={isEmpty}
              tabIndex={active === 0 ? 0 : -1}
              onClick={() => pick('')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-appInput transition-colors"
            >
              {!plain && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-appTextDisabled" aria-hidden="true" />}
              <span className="text-sm text-appTextMuted truncate">{emptyOption.label}</span>
              {isEmpty && <Check className="w-4 h-4 ml-auto flex-shrink-0 text-appAccent" aria-hidden="true" />}
            </button>
          )}
          {options.map((o, i) => {
            const sel = String(o.value) === String(value)
            const rowIdx = (emptyOption ? 1 : 0) + i  // flat index into `rows`
            return (
              <button
                key={o.value}
                ref={(el) => { optionRefs.current[rowIdx] = el }}
                type="button"
                role="option"
                aria-selected={sel}
                tabIndex={active === rowIdx ? 0 : -1}
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
