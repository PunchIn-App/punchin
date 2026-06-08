// Single source of truth for the accent-colour presets, shared by the Appearance
// settings panel, the install-icon switcher (src/utils/installIcon.js), and the
// icon generator (scripts/icons.mjs) so the pre-rendered per-accent icon sets
// never drift from the colours offered in the UI (issue #228).
export const ACCENT_PRESETS = [
  { name: 'Blue', hex: '#2D5BF5' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Teal', hex: '#2DD4BF' },
]

// The default accent (first preset) — PunchIn Blue. Its icon set is the one
// shipped at the manifest root, so it needs no per-accent swap.
export const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex

// The light theme uses a slightly darker blue for the DEFAULT accent so it keeps
// enough contrast on the light surfaces (App.jsx applies this when the user is on
// the default accent in light mode; a custom accent is used as-is in both themes).
export const DEFAULT_ACCENT_LIGHT = '#2348DB'

// Fallback colour for a job / labor type that has no colour of its own — used for
// the dot / left-rail accent across the Timer surfaces and labor glyphs. An
// on-palette pastel (`--pastel-indigo`) rather than the old off-palette `#6366F1`
// (which was the light-theme `--violet`, not one of the pastel presets).
export const DEFAULT_JOB_COLOR = '#9B8CFF'

// Folder/key for a preset's pre-rendered install-icon set: the hex without '#',
// lowercased (e.g. '#F59E0B' -> 'f59e0b'). Returns null for a non-preset
// (custom) colour, which has no pre-rendered set.
export function accentIconKey(hex) {
  const norm = String(hex || '').trim().toLowerCase()
  const match = ACCENT_PRESETS.find((p) => p.hex.toLowerCase() === norm)
  return match ? match.hex.toLowerCase().replace('#', '') : null
}
