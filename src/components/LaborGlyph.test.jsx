import { render, screen } from '@testing-library/react'
import { glyphComponent, LaborTag, LaborGlyphChip, LABOR_GLYPH_IDS } from './LaborGlyph'

it('exposes a curated set of glyph ids including common ones', () => {
  expect(LABOR_GLYPH_IDS).toContain('code')
  expect(LABOR_GLYPH_IDS).toContain('briefcase')
  expect(LABOR_GLYPH_IDS.length).toBeGreaterThanOrEqual(8)
})

it('glyphComponent returns a renderable component for any id (Tag fallback)', () => {
  const Known = glyphComponent('code')
  const Unknown = glyphComponent('not-a-real-glyph')
  expect(Known).toBeTruthy()
  const { container } = render(<Unknown />)
  expect(container.querySelector('svg')).toBeTruthy() // fallback still renders
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
