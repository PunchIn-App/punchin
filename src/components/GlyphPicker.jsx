import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import { LABOR_GLYPH_IDS, glyphComponent } from './LaborGlyph'

// Glyph picker for labor types — a single row of quick-pick glyphs plus a "more"
// button that opens a searchable dropdown over the full glyph set. Mirrors the
// design system's .pclt-glyphs (quick row + dashed search affordance) and the
// ColorPicker's popover/Escape/outside-click contract.
const QUICK_IDS = LABOR_GLYPH_IDS.slice(0, 7)

function GlyphButton({ id, selected, onChange }) {
  const Glyph = glyphComponent(id)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={id}
      onClick={() => onChange(id)}
      className={`w-10 h-10 flex-shrink-0 grid place-items-center rounded-lg border transition-colors
        ${selected
          ? 'border-appAccent bg-appAccent/10 text-appAccent'
          : 'border-appBorder text-appTextMuted hover:text-appText hover:bg-appInput'}`}
    >
      <Glyph className="w-[18px] h-[18px]" aria-hidden="true" />
    </button>
  )
}

export default function GlyphPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  // Keep a search-chosen glyph visible in the quick row by prepending it.
  const quick = value && !QUICK_IDS.includes(value) ? [value, ...QUICK_IDS] : QUICK_IDS
  const q = query.trim().toLowerCase()
  const results = q ? LABOR_GLYPH_IDS.filter(id => id.includes(q)) : LABOR_GLYPH_IDS

  // Picking a glyph unmounts the popover, so refocus the (still-mounted) trigger
  // first or focus falls to <body> (WCAG 2.4.3). :focus-visible means mouse users
  // won't see a ring, so unconditional refocus on selection is safe.
  const choose = id => { onChange(id); setOpen(false); setQuery(''); triggerRef.current?.focus() }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label="Glyph">
        {quick.map(id => (
          <GlyphButton key={id} id={id} selected={value === id} onChange={onChange} />
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
                       placeholder-appTextDisabled focus:outline-none focus:ring-2 focus:ring-appAccent/50"
          />
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            {results.map(id => (
              <GlyphButton key={id} id={id} selected={value === id} onChange={choose} />
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
