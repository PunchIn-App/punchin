import { render, screen } from '@testing-library/react'
import { glyphComponent, LaborTag, LaborGlyphChip, LABOR_GLYPH_IDS } from './LaborGlyph'

it('exposes a curated set of glyph ids including common ones and the PunchIn brand mark', () => {
  expect(LABOR_GLYPH_IDS).toContain('code')
  expect(LABOR_GLYPH_IDS).toContain('briefcase')
  expect(LABOR_GLYPH_IDS).toContain('punchin') // brand mark is a selectable option
  expect(LABOR_GLYPH_IDS[0]).toBe('punchin')   // ...shown first (it's the default)
  expect(LABOR_GLYPH_IDS.length).toBeGreaterThanOrEqual(8)
})

it('defaults an unset/unknown glyph to the PunchIn brand mark, not a generic icon', () => {
  const Punchin = glyphComponent('punchin')
  const Unset = glyphComponent(undefined)
  const Unknown = glyphComponent('not-a-real-glyph')
  // Unset and unknown both fall back to the same brand component as 'punchin'.
  expect(Unset).toBe(Punchin)
  expect(Unknown).toBe(Punchin)
  // It renders the stopwatch geometry (the crown bar is unique to the brand mark).
  const { container } = render(<Unset />)
  expect(container.querySelector('svg path[d="M9.5 2.6h5"]')).toBeTruthy()
})

it('LaborTag renders the glyph + name with an accessible label', () => {
  const { container } = render(<LaborTag laborType={{ name: 'Design', color: '#5FD08A', glyph: 'brush' }} />)
  expect(screen.getByText('Design')).toBeInTheDocument()
  expect(screen.getByLabelText('Design')).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeTruthy()
})

it('LaborTag renders nothing without a labor type', () => {
  const { container } = render(<LaborTag laborType={null} />)
  expect(container).toBeEmptyDOMElement()
})

it('LaborGlyphChip renders a glyph even when glyph/color are unset (fallbacks)', () => {
  const { container } = render(<LaborGlyphChip laborType={{}} />)
  expect(container.querySelector('svg')).toBeTruthy()
})
