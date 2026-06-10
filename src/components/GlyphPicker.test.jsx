import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('restores focus to the "More glyphs" trigger after choosing from the dropdown (WCAG 2.4.3)', () => {
    // Selecting a glyph unmounts the popover; focus must return to the trigger
    // rather than dropping to <body>.
    render(<GlyphPicker value="" onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /more glyphs/i })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByLabelText(/search glyphs/i), { target: { value: 'plane' } })
    fireEvent.click(screen.getByRole('radio', { name: 'plane' }))
    expect(document.activeElement).toBe(trigger)
  })

  it('restores focus to the "More glyphs" trigger after closing with Escape (WCAG 2.4.3)', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /more glyphs/i })
    fireEvent.click(trigger)
    expect(screen.getByLabelText(/search glyphs/i)).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText(/search glyphs/i)).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  // --- Radio-group keyboard model (WAI-ARIA APG) ---

  it('gives the quick row role="radiogroup" with a roving tabindex (one tabbable radio)', () => {
    render(<GlyphPicker value="code" onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    const radios = within(group).getAllByRole('radio')
    const tabbable = radios.filter(r => r.tabIndex === 0)
    expect(tabbable).toHaveLength(1)                       // exactly one in the tab order
    expect(tabbable[0]).toHaveAttribute('aria-label', 'code') // the checked one
    radios.filter(r => r !== tabbable[0]).forEach(r => expect(r.tabIndex).toBe(-1))
  })

  it('makes the FIRST quick radio tabbable when none is checked', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    const radios = within(group).getAllByRole('radio')
    expect(radios[0].tabIndex).toBe(0)
    expect(radios.slice(1).every(r => r.tabIndex === -1)).toBe(true)
  })

  it('ArrowRight in the quick row selects + focuses the next radio (roving moves)', () => {
    // value=punchin is index 0 of the quick row; ArrowRight → index 1 ("code").
    const onChange = vi.fn()
    render(<GlyphPicker value="punchin" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('code')          // moving focus selects
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'code' }))
  })

  it('ArrowDown behaves like ArrowRight in the wrapping quick row', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="punchin" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('code')
  })

  it('ArrowLeft / ArrowUp move to the previous radio in the quick row', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="code" onChange={onChange} />) // index 1
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('punchin')        // index 0
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'punchin' }))
  })

  it('wraps around at the ends of the quick row', () => {
    const onChange = vi.fn()
    // First radio + ArrowLeft wraps to the last quick radio.
    render(<GlyphPicker value="punchin" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    const radios = within(group).getAllByRole('radio')
    const lastLabel = radios[radios.length - 1].getAttribute('aria-label')
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(lastLabel)
  })

  it('Home / End jump to the first / last quick radio', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="code" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Glyph' })
    const radios = within(group).getAllByRole('radio')
    const firstLabel = radios[0].getAttribute('aria-label')
    const lastLabel = radios[radios.length - 1].getAttribute('aria-label')
    fireEvent.keyDown(group, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(lastLabel)
    fireEvent.keyDown(group, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(firstLabel)
  })

  it('updates aria-checked + roving tabindex after an arrow move (controlled rerender)', () => {
    // Simulate the controlled-component update: arrow selects -> parent passes the
    // new value back, and the roving tabindex + aria-checked follow it.
    const { rerender } = render(<GlyphPicker value="punchin" onChange={() => {}} />)
    let group = screen.getByRole('radiogroup', { name: 'Glyph' })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    rerender(<GlyphPicker value="code" onChange={() => {}} />)
    const code = screen.getByRole('radio', { name: 'code' })
    expect(code).toHaveAttribute('aria-checked', 'true')
    expect(code.tabIndex).toBe(0)
    expect(screen.getByRole('radio', { name: 'punchin' }).tabIndex).toBe(-1)
  })

  it('wraps the search results in a role="radiogroup" (no bare radios outside a group)', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /more glyphs/i }))
    const resultsGroup = screen.getByRole('radiogroup', { name: 'All glyphs' })
    expect(resultsGroup).toBeInTheDocument()
    // Every result radio lives inside that group.
    expect(within(resultsGroup).getAllByRole('radio').length).toBeGreaterThan(1)
  })

  it('arrow-navigates the search results (selects + focuses, popover stays open)', () => {
    const onChange = vi.fn()
    render(<GlyphPicker value="punchin" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /more glyphs/i }))
    const resultsGroup = screen.getByRole('radiogroup', { name: 'All glyphs' })
    fireEvent.keyDown(resultsGroup, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('code')           // index 0 (punchin) -> index 1
    // Selecting via arrow keeps the dropdown open (focus just moved).
    expect(screen.getByLabelText(/search glyphs/i)).toBeInTheDocument()
    expect(document.activeElement).toBe(within(resultsGroup).getByRole('radio', { name: 'code' }))
  })

  it('the search results have a roving tabindex too', () => {
    render(<GlyphPicker value="" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /more glyphs/i }))
    const resultsGroup = screen.getByRole('radiogroup', { name: 'All glyphs' })
    const radios = within(resultsGroup).getAllByRole('radio')
    expect(radios.filter(r => r.tabIndex === 0)).toHaveLength(1)
  })
})
