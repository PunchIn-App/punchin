// Labor-type glyphs — each labor type carries a glyph (a Lucide icon id) beside
// its colour so categories read by SHAPE and colour, not colour alone (a11y).
// Shared by the editor (glyph picker) and every surface a labor type appears on.
import {
  Code, Paintbrush, MessageSquare, Wrench, Book, FlaskConical, Camera, Truck,
  Leaf, Briefcase, Pencil, BarChart2, DollarSign, Clock, Bell, Settings, Tag,
} from 'lucide-react'
import { readableInk } from '../utils/inkOnAccent'

// Curated quick-pick set (string id → Lucide component). Stored as the id string
// on laborTypes.glyph; mapped here so render sites import one component.
export const LABOR_GLYPHS = {
  code: Code, brush: Paintbrush, chat: MessageSquare, wrench: Wrench,
  book: Book, beaker: FlaskConical, camera: Camera, truck: Truck,
  leaf: Leaf, briefcase: Briefcase, pencil: Pencil, chart: BarChart2,
  dollar: DollarSign, clock: Clock, bell: Bell, settings: Settings,
}
export const LABOR_GLYPH_IDS = Object.keys(LABOR_GLYPHS)
export const DEFAULT_LABOR_COLOR = '#6366F1'

// Resolve a glyph id to its component; unknown / unset falls back to Tag so
// existing records (no glyph field) render without a migration.
export function glyphComponent(id) {
  return LABOR_GLYPHS[id] || Tag
}

// A solid colour chip holding the glyph (ink flipped for contrast). Replaces the
// bare colour dots in management lists, rate rows, and the editor preview.
export function LaborGlyphChip({ laborType, className = 'w-5 h-5' }) {
  const color = laborType?.color || DEFAULT_LABOR_COLOR
  const Glyph = glyphComponent(laborType?.glyph)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <Glyph className="w-[60%] h-[60%]" style={{ color: readableInk(color) }} strokeWidth={2.5} />
    </span>
  )
}

// The labor-type tag — a colour-tinted pill carrying the glyph + name, so it
// reads by shape and colour. Use everywhere a labor type is labelled inline
// (timer ticket, timesheet entries, invoice line items, last session).
export function LaborTag({ laborType, className = '' }) {
  if (!laborType) return null
  const color = laborType.color || DEFAULT_LABOR_COLOR
  const Glyph = glyphComponent(laborType.glyph)
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}
      style={{ backgroundColor: `${color}25`, color }}
      aria-label={laborType.name}
    >
      <Glyph className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      {laborType.name}
    </span>
  )
}
