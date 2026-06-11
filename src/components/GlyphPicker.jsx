import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import { LABOR_GLYPH_IDS, glyphComponent } from './LaborGlyph'

// Glyph picker for labor types — a single row of quick-pick glyphs plus a "more"
// button that opens a searchable dropdown over the full glyph set. Mirrors the
// design system's .pclt-glyphs (quick row + dashed search affordance) and the
// ColorPicker's popover/Escape/outside-click contract.
const QUICK_IDS = LABOR_GLYPH_IDS.slice(0, 7)

function GlyphButton({ id, selected, onChange, tabIndex = 0, onKeyDown }) {
  const Glyph = glyphComponent(id)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={id}
      // Roving tabindex: only the checked radio (or the first when none is) sits
      // in the tab order; the rest are reachable with the arrow keys per the
      // WAI-ARIA radio-group model.
      tabIndex={tabIndex}
      onClick={() => onChange(id)}
      onKeyDown={onKeyDown}
      data-glyph-radio
      className={`w-10 h-10 flex-shrink-0 grid place-items-center rounded-lg border transition-colors
        ${selected
          ? 'border-appAccent bg-appAccent/10 text-appAccent'
          : 'border-appBorder text-appTextMuted hover:text-appText hover:bg-appInput'}`}
    >
      <Glyph className="w-[18px] h-[18px]" aria-hidden="true" />
    </button>
  )
}

// WAI-ARIA radio-group keyboard model, shared by the quick row and the search
// results. Returns the index of the tabbable radio (roving tabindex) for a set
// of ids: the checked one, or the first when none is checked.
function rovingIndex(ids, value) {
  const i = ids.indexOf(value)
  return i >= 0 ? i : 0
}

export default function GlyphPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Pin a search-chosen (non-quick) glyph into the quick row for the life of the
  // picker. Without this the row is derived purely from `value`, so arrowing off
  // the custom glyph onto a stock one drops it from the row entirely — stranding
  // it off the keyboard path with no way back (issue: destructive arrow key).
  const [pinnedCustom, setPinnedCustom] = useState(() =>
    value && !QUICK_IDS.includes(value) ? value : null)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)   // "More glyphs" — refocus target on select/Escape (WCAG 2.4.3)

  useEffect(() => {
    if (!open) return
    const onOutside = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    // Capture Escape so it only closes this popover, not a surrounding modal
    // (same reasoning as ColorPicker, issue #155).
    const onEscape = e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
      // Restore focus to the trigger before the popover unmounts so focus doesn't
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

  // Remember the latest search-chosen glyph so it stays pinned in the quick row.
  useEffect(() => {
    if (value && !QUICK_IDS.includes(value)) setPinnedCustom(value)
  }, [value])

  // Keep a search-chosen glyph visible in the quick row by prepending it (the
  // pinned one stays even after arrowing selects a stock glyph).
  const quick = pinnedCustom ? [pinnedCustom, ...QUICK_IDS] : QUICK_IDS
  const q = query.trim().toLowerCase()
  const results = q ? LABOR_GLYPH_IDS.filter(id => id.includes(q)) : LABOR_GLYPH_IDS

  // Picking a glyph unmounts the popover, so refocus the (still-mounted) trigger
  // first or focus falls to <body> (WCAG 2.4.3). :focus-visible means mouse users
  // won't see a ring, so unconditional refocus on selection is safe.
  const choose = id => { onChange(id); setOpen(false); setQuery(''); triggerRef.current?.focus() }

  // Build the radio-group arrow-key handler for a given set of ids and select
  // callback. The glyphs wrap in a flex row, so we support BOTH axis pairs
  // (ArrowRight/Left and ArrowDown/Up); Home/End jump to the ends; selection
  // wraps around. Moving the focus also selects (radiogroup semantics), and the
  // moved-to radio is focused by querying the rendered buttons in the group.
  const groupKeyDown = (ids, select) => e => {
    // Ignore keys from a non-radio descendant. The quick row also contains the
    // "More glyphs" trigger; arrow/Home/End fired while it's focused must not
    // change the selection or yank focus onto a radio. Keys bubbling from a radio
    // (e.target is the radio) or dispatched at the group itself still pass.
    if (e.target !== e.currentTarget && !e.target.closest?.('[data-glyph-radio]')) return
    const last = ids.length - 1
    if (last < 0) return
    const cur = rovingIndex(ids, value)
    let next
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': next = cur >= last ? 0 : cur + 1; break
      case 'ArrowLeft':
      case 'ArrowUp':   next = cur <= 0 ? last : cur - 1; break
      case 'Home': next = 0; break
      case 'End':  next = last; break
      default: return
    }
    e.preventDefault()
    select(ids[next])
    // Focus the moved-to radio. The group's buttons render in `ids` order, so
    // the nth [data-glyph-radio] is the target (same DOM-query idiom as the
    // outside-click guard above).
    const radios = e.currentTarget.querySelectorAll('[data-glyph-radio]')
    radios[next]?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex items-center gap-1.5 flex-wrap"
        role="radiogroup"
        aria-label="Glyph"
        onKeyDown={groupKeyDown(quick, onChange)}
      >
        {quick.map(id => (
          <GlyphButton
            key={id}
            id={id}
            selected={value === id}
            onChange={onChange}
            tabIndex={rovingIndex(quick, value) === quick.indexOf(id) ? 0 : -1}
          />
        ))}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label="More glyphs"
          className="w-10 h-10 flex-shrink-0 grid place-items-center rounded-lg border border-dashed
                     border-appAccent/45 text-appAccent hover:bg-appAccent/10 transition-colors"
        >
          <Search className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-appCard border border-appBorder rounded-xl shadow-xl p-3 space-y-2">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search glyphs…"
            aria-label="Search glyphs"
            className="w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-1.5 text-sm
                       placeholder-appTextPlaceholder focus:outline-none focus:ring-2 focus:ring-appAccent/50"
          />
          {/* The results are role="radio" buttons, so they need a role="radiogroup"
              ancestor (a bare radio outside a group is an ARIA structure error).
              Same wrapping flex row → same dual-axis arrow-key model as the quick row. */}
          <div
            className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto"
            role="radiogroup"
            aria-label="All glyphs"
            // Arrow navigation selects but keeps the popover open (it just moves
            // the roving focus); a click / Enter / Space on a result commits via
            // `choose`, which closes and returns focus to the trigger.
            onKeyDown={groupKeyDown(results, onChange)}
          >
            {results.map(id => (
              <GlyphButton
                key={id}
                id={id}
                selected={value === id}
                onChange={choose}
                tabIndex={rovingIndex(results, value) === results.indexOf(id) ? 0 : -1}
              />
            ))}
            {results.length === 0 && (
              <p className="w-full text-xs text-appTextMuted py-2 text-center">No matching glyphs</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
