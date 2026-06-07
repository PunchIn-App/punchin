import { render, screen, fireEvent } from '@testing-library/react'
import GlyphPicker from './GlyphPicker'

describe('GlyphPicker', () => {
  it('renders a single row of quick-pick glyphs plus a "more" button', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'punchin' })).toBeInTheDocument() // brand default
    expect(screen.getByRole('radio', { name: 'code' })).toBeInTheDocument()    // a quick-pick
    expect(screen.getByRole('button', { name: /more glyphs/i })).toBeInTheDocument()
    // The full set is NOT all shown inline (it lives behind "more")
    expect(screen.queryByRole('radio', { name: 'plane' })).not.toBeInTheDocument()
  })

  it('shows the PunchIn brand glyph as the first quick-pick (the default)', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-label', 'punchin')
  })

  it('marks the PunchIn brand glyph aria-checked when it is the selected value', () => {
    render(<GlyphPicker value="punchin" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'punchin' })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange when a quick-pick is clicked', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'brush' }))
    expect(onChange).toHaveBeenCalledWith('brush')
  })

  it('marks the selected glyph aria-checked', () => {
    render(<GlyphPicker value="code" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'code' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps a search-chosen (non-quick) glyph visible in the row', () => {
    render(<GlyphPicker value="coffee" onChange={() => {}} />)
    const coffee = screen.getByRole('radio', { name: 'coffee' })
    expect(coffee).toBeInTheDocument()
    expect(coffee).toHaveAttribute('aria-checked', 'true')
  })

  it('opens a search dropdown, filters, and selects from it', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /more glyphs/i }))
    fireEvent.change(screen.getByLabelText(/search glyphs/i), { target: { value: 'plane' } })
    fireEvent.click(screen.getByRole('radio', { name: 'plane' }))
    expect(onChange).toHaveBeenCalledWith('plane')
  })

  it('shows an empty-state message when no glyph matches', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /more glyphs/i }))
    fireEvent.change(screen.getByLabelText(/search glyphs/i), { target: { value: 'zzzznope' } })
    expect(screen.getByText(/no matching glyphs/i)).toBeInTheDocument()
  })
})
