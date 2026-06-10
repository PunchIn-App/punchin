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

it('LaborTag is a neutral pill with the colour carried by an inner glyph chip (DS pattern)', () => {
  // The design system rejected colour-text-on-a-colour-tinted-pill (washed out).
  // The pill itself must be neutral (no labor-colour fill or text colour inline);
  // the colour lives only on a small tinted glyph chip inside it.
  render(<LaborTag laborType={{ name: 'Design', color: '#FF0000', glyph: 'brush' }} />)
  const pill = screen.getByLabelText('Design')
  expect(pill.style.backgroundColor).toBe('')
  expect(pill.style.color).toBe('')
  const chip = pill.querySelector('span[style*="background"]')
  expect(chip).toBeTruthy()                       // the colour-bearing glyph chip
  expect(chip.querySelector('svg')).toBeTruthy()  // glyph rides inside it
})

it('LaborGlyphChip carries the colour as a tint with a matching border (DS .gl)', () => {
  const { container } = render(<LaborGlyphChip laborType={{ color: '#FF0000', glyph: 'code' }} />)
  const chip = container.querySelector('span[style]')
  expect(chip.style.backgroundColor).not.toBe('') // tinted fill
  expect(chip.style.border).not.toBe('')          // + a tint border, per the DS chip
})

it('LaborGlyphChip renders a glyph even when glyph/color are unset (fallbacks)', () => {
  const { container } = render(<LaborGlyphChip laborType={{}} />)
  expect(container.querySelector('svg')).toBeTruthy()
})

it('LaborTag glyph wires up theme-aware ink so it darkens in light mode (WCAG 1.4.11)', () => {
  // The glyph carries `.lg-glyph-ink` + the labor colour on `--glyph-ink`, so
  // index.css can darken it in light mode (where the ~22% tint composites
  // near-white and the full pastel would fall below 3:1) while dark mode keeps
  // the full colour. No raw `color` is set inline — the var drives it.
  const { container } = render(<LaborTag laborType={{ name: 'Design', color: '#5FD08A', glyph: 'brush' }} />)
  const glyph = container.querySelector('svg')
  expect(glyph).toHaveClass('lg-glyph-ink')
  expect(glyph.style.getPropertyValue('--glyph-ink')).toBe('#5FD08A')
  expect(glyph.style.color).toBe('') // colour comes from the var, not a hardcoded inline value
})

it('LaborGlyphChip glyph wires up theme-aware ink so it darkens in light mode (WCAG 1.4.11)', () => {
  const { container } = render(<LaborGlyphChip laborType={{ color: '#E6C84B', glyph: 'code' }} />)
  const glyph = container.querySelector('svg')
  expect(glyph).toHaveClass('lg-glyph-ink')
  expect(glyph.style.getPropertyValue('--glyph-ink')).toBe('#E6C84B')
  expect(glyph.style.color).toBe('')
})
