import { ICON_PALETTE, paletteKey, nearestPaletteKey } from './iconPalette'
import { ACCENT_PRESETS } from './accentPresets'

describe('iconPalette (#228)', () => {
  it('includes every accent preset as an exact swatch', () => {
    for (const p of ACCENT_PRESETS) {
      expect(ICON_PALETTE).toContain(p.hex.toLowerCase())
    }
  })

  it('snaps a preset colour to itself (exact match)', () => {
    expect(nearestPaletteKey('#1f6feb')).toBe('1f6feb')
    expect(nearestPaletteKey('#F59E0B')).toBe('f59e0b')
  })

  it('snaps a colour a hair off a preset to that preset', () => {
    expect(nearestPaletteKey('#1f6fec')).toBe('1f6feb')
  })

  it('always returns a key that has a generated palette folder', () => {
    const keys = ICON_PALETTE.map((c) => c.replace('#', ''))
    for (const custom of ['#7c3aed', '#10b981', '#ef4444', '#000000', '#ffffff']) {
      expect(keys).toContain(nearestPaletteKey(custom))
    }
  })

  it('paletteKey strips the # and lowercases', () => {
    expect(paletteKey('#AB12CD')).toBe('ab12cd')
    expect(paletteKey('1F6FEB')).toBe('1f6feb')
  })

  it('is a reasonably dense crayon box', () => {
    expect(ICON_PALETTE.length).toBeGreaterThanOrEqual(50)
  })
})
