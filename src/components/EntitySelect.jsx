import { useState, useRef, useEffect, useId } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { glyphComponent } from './LaborGlyph'

// A bespoke single-select that shows each option's colour dot / labor glyph +
// label + optional sublabel (e.g. a job's client) — the replacement for native
// <select> wherever the choices carry colour/glyph identity. Option shape:
//   { value, label, sublabel?, color?, glyph? }
// A `glyph` renders the labor glyph in `color`; otherwise a colour dot.
//
// `emptyOption` (optional) adds a clear/none row whose value is '' — use it for
// "All Jobs" (filter) or "No default" (optional) selects; omit it for required
// ones so the only way to satisfy them is to pick a real option.
//
// The menu expands IN FLOW (it pushes the following content down) rather than
// floating absolutely. That keeps it from being clipped inside a scroll-container
// modal (e.g. EditEntryModal's `overflow-y-auto` body) and from fighting a modal
// focus trap — the menu lives inside the dialog, so Tab and Escape compose.
function OptionVisual({ opt }) {
  if (opt?.glyph) {
    const Glyph = glyphComponent(opt.glyph)
    return <Glyph className="w-4 h-4 flex-shrink-0" style={{ color: opt.color }} strokeWidth={2} aria-hidden="true" />
  }
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
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
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const uid = useId()
  const labelId = `${uid}-label`

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
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-appBg text-left transition-colors
          ${open ? 'border-appAccent ring-2 ring-appAccent/20' : 'border-appBorder hover:border-appAccent/40'} ${buttonClassName}`}
      >
        <OptionVisual opt={selected} />
        {display ? (
          <>
            <span className={`text-[15px] truncate ${selected ? 'font-bold text-appText' : 'text-appTextMuted'}`}>{display}</span>
            {selected?.sublabel && <span className="text-xs text-appTextMuted truncate">{selected.sublabel}</span>}
          </>
        ) : (
          <span className="text-[15px] text-appTextMuted truncate">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-[18px] h-[18px] ml-auto flex-shrink-0 text-appTextMuted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="mt-1.5 bg-appCard border border-appBorder rounded-xl shadow-[var(--shadow-pop)] p-1.5 max-h-60 overflow-y-auto"
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
