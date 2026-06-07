import { describe, it, expect } from 'vitest'
import { iconSvg } from './iconSvg'

describe('iconSvg — stopwatch brand mark', () => {
  it('draws the stopwatch body + crown, not the old clock polyline', () => {
    const svg = iconSvg(192, '#2D5BF5')
    expect(svg).toContain('cx="12" cy="13.4" r="8.2"') // stopwatch body circle
    expect(svg).toContain('M9.5 2.6h5')                // crown bar
    expect(svg).not.toContain('polyline')              // old lucide clock hand
  })

  it('tints the glyph via the contrast guard (white on dark accent, ink on light)', () => {
    expect(iconSvg(192, '#2D5BF5')).toContain('stroke="#FFFFFF"')
    expect(iconSvg(192, '#FFD66B')).toContain('stroke="#0F1117"')
  })

  it('fills the rounded tile with the accent colour', () => {
    expect(iconSvg(192, '#2D5BF5')).toContain('fill="#2D5BF5"')
  })
})
