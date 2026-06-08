// Labor-type glyphs — each labor type carries a glyph (a Lucide icon id) beside
// its colour so categories read by SHAPE and colour, not colour alone (a11y).
// Shared by the editor (glyph picker) and every surface a labor type appears on.
import {
  Code, Paintbrush, MessageSquare, Wrench, Book, FlaskConical, Camera, Truck,
  Leaf, Briefcase, Pencil, BarChart2, DollarSign, Clock, Bell, Settings,
  Megaphone, PenTool, Hammer, Scissors, Music, Video, Mail, Phone, Globe, Map,
  Zap, Coffee, Package, Plane, Users, GraduationCap,
} from 'lucide-react'
import { PunchGlyph } from './BrandMark'
import { DEFAULT_JOB_COLOR } from '../accentPresets'

// Glyph set (string id → component). Stored as the id string on laborTypes.glyph;
// mapped here so render sites import one component. `punchin` (the PunchIn brand
// stopwatch) leads — it's the default glyph and the first quick-pick. The next
// few are the remaining quick-picks shown in the picker row; the rest are
// reachable via the picker's search ("more") dropdown.
export const LABOR_GLYPHS = {
  punchin: PunchGlyph,
  code: Code, brush: Paintbrush, chat: MessageSquare, wrench: Wrench,
  book: Book, beaker: FlaskConical, camera: Camera, truck: Truck,
  leaf: Leaf, briefcase: Briefcase, pencil: Pencil, chart: BarChart2,
  dollar: DollarSign, clock: Clock, bell: Bell, settings: Settings,
  megaphone: Megaphone, pen: PenTool, hammer: Hammer, scissors: Scissors,
  music: Music, video: Video, mail: Mail, phone: Phone, globe: Globe,
  map: Map, zap: Zap, coffee: Coffee, package: Package, plane: Plane,
  users: Users, grad: GraduationCap,
}
export const LABOR_GLYPH_IDS = Object.keys(LABOR_GLYPHS)
// One source of truth — the shared on-palette fallback (see accentPresets.js).
// Kept as `DEFAULT_LABOR_COLOR` so existing import sites need no change.
export const DEFAULT_LABOR_COLOR = DEFAULT_JOB_COLOR

// Resolve a glyph id to its component; unknown / unset falls back to the PunchIn
// brand mark so existing records (no glyph field) render without a migration.
export function glyphComponent(id) {
  return LABOR_GLYPHS[id] || PunchGlyph
}

// A tinted colour chip holding the glyph — the design system's `.gl` chip:
// a ~22% colour fill with a ~42% colour border, the glyph drawn in the full
// colour. Replaces the bare colour dots in management lists, rate rows, etc.
export function LaborGlyphChip({ laborType, className = 'w-5 h-5' }) {
  const color = laborType?.color || DEFAULT_LABOR_COLOR
  const Glyph = glyphComponent(laborType?.glyph)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[28%] flex-shrink-0 ${className}`}
      style={{ backgroundColor: `${color}38`, border: `1px solid ${color}6B` }}
      aria-hidden="true"
    >
      <Glyph className="w-1/2 h-1/2" style={{ color }} strokeWidth={2} />
    </span>
  )
}

// The labor-type tag — the design system's `.lbadge`: a NEUTRAL pill (surface +
// border, the name in primary text) carrying a small tinted glyph chip that
// holds the colour. This deliberately avoids colour-text-on-a-colour-tinted-pill
// (the washed-out pattern the DS rejected). Reads by shape AND colour. Use
// everywhere a labor type is labelled inline (timer ticket, timesheet entries,
// invoice line items, last session).
export function LaborTag({ laborType, className = '' }) {
  if (!laborType) return null
  const color = laborType.color || DEFAULT_LABOR_COLOR
  const Glyph = glyphComponent(laborType.glyph)
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-md bg-appInput border border-appBorder text-appText text-[11px] font-semibold ${className}`}
      aria-label={laborType.name}
    >
      <span
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] flex-shrink-0"
        style={{ backgroundColor: `${color}38`, border: `1px solid ${color}6B` }}
        aria-hidden="true"
      >
        <Glyph className="w-3 h-3" style={{ color }} strokeWidth={2} />
      </span>
      {laborType.name}
    </span>
  )
}
