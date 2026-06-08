import { useState, useRef, useEffect } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { Check, Plus } from 'lucide-react'

function getLuminance(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 0
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function checkColor(hex) {
  return getLuminance(hex) > 0.35 ? '#000000' : '#ffffff'
}

const VALID_HEX = /^#[0-9A-Fa-f]{6}$/

// The custom-colour trigger's rainbow "wheel" — a conic spectrum that signals
// "pick any colour" (matches the design-system labor-type picker mockup).
const RAINBOW = 'conic-gradient(from 90deg,#ef4444,#f59e0b,#10b981,#3b82f6,#8b5cf6,#ef4444)'

// presets: { hex: string, name?: string }[]
// size:    'md' (w-8 h-8) | 'lg' (w-9 h-9)
export default function ColorPicker({ presets, value, onChange, size = 'md', label = 'Choose color' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const wrapRef = useRef(null)

  const presetHexes = presets.map(p => p.hex)
  const isCustom = VALID_HEX.test(value) && !presetHexes.includes(value)

  const swatchCls = size === 'lg' ? 'w-9 h-9' : 'w-8 h-8'
  const iconCls   = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (!open) return
    const onOutside = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onEscape = e => {
      if (e.key !== 'Escape') return
      // ColorPicker renders inside other dialogs (e.g. the labor-type editor),
      // whose own Escape handler is also on document. Catch Escape in the capture
      // phase and stop it here so a single Escape only dismisses the popover, not
      // the surrounding modal — a bubble-phase stopPropagation wouldn't beat a
      // parent listener that registered first on the same node (issue #155).
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape, true) // capture
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [open])

  const pick = hex => {
    setDraft(hex)
    if (VALID_HEX.test(hex)) onChange(hex)
  }

  const safeColor = VALID_HEX.test(draft) ? draft : '#888888'

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={label}>
        {presets.map(({ hex, name }) => {
          const active = value === hex
          return (
            <button
              key={hex}
              onClick={() => { pick(hex); setOpen(false) }}
              aria-label={name ? `${name}${active ? ' (selected)' : ''}` : `Color ${hex}${active ? ' (selected)' : ''}`}
              aria-pressed={active}
              className={`${swatchCls} rounded-[10px] transition-all hover:scale-110 ${active ? 'scale-110' : ''} relative flex items-center justify-center flex-shrink-0`}
              style={{ backgroundColor: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
            >
              {active && <Check className={iconCls} style={{ color: checkColor(hex) }} aria-hidden="true" />}
            </button>
          )
        })}

        {/* Custom color trigger — a rainbow conic "wheel" squircle. Its centre
            shows the chosen custom colour (with a check) when one is active, else
            a neutral squircle with a + to add one. */}
        <button
          onClick={() => setOpen(p => !p)}
          aria-label={isCustom ? 'Custom color (selected)' : 'Custom color'}
          aria-pressed={isCustom}
          aria-expanded={open}
          className={`${swatchCls} rounded-[10px] transition-all hover:scale-110 ${isCustom ? 'scale-110' : ''} relative grid place-items-center flex-shrink-0`}
          style={{ background: RAINBOW }}
        >
          <span
            className="grid place-items-center rounded-[6px]"
            style={{
              width: '60%',
              height: '60%',
              backgroundColor: isCustom ? value : 'var(--bg-secondary)',
            }}
          >
            {isCustom
              ? <Check className={iconCls} style={{ color: checkColor(value) }} aria-hidden="true" />
              : <Plus className={iconCls} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
            }
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-appCard border border-appBorder rounded-xl shadow-xl p-3 space-y-2">
          <HexColorPicker color={safeColor} onChange={pick} />
          <HexColorInput
            color={safeColor}
            onChange={pick}
            prefixed
            className="w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-appAccent/50 uppercase"
          />
        </div>
      )}
    </div>
  )
}
