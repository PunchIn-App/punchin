import { render, screen, fireEvent } from '@testing-library/react'
import EntitySelect from './EntitySelect'

const JOB_OPTS = [
  { value: '1', label: 'Acme Corp', sublabel: 'Acme Inc', color: '#2D5BF5' },
  { value: '2', label: 'Skyline Studio', sublabel: 'Skyline LLC', color: '#8257E6' },
]
const LT_OPTS = [
  { value: '1', label: 'Design', color: '#6366F1', glyph: 'brush' },
  { value: '2', label: 'Development', color: '#22C55E', glyph: 'code' },
]

describe('EntitySelect', () => {
  it('shows the placeholder and a visible label when nothing is selected', () => {
    render(<EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />)
    expect(screen.getByText('Job')).toBeInTheDocument()           // mono overline
    expect(screen.getByText('Select a job…')).toBeInTheDocument() // placeholder
  })

  it('reflects the selected option (label + sublabel) on the trigger', () => {
    render(<EntitySelect label="Job" value="1" onChange={() => {}} options={JOB_OPTS} />)
    const trigger = screen.getByRole('button', { name: /job/i })
    expect(trigger).toHaveTextContent('Acme Corp')
    expect(trigger).toHaveTextContent('Acme Inc')
  })

  it('opens a listbox of options when clicked', () => {
    render(<EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /acme corp/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /skyline studio/i })).toBeInTheDocument()
  })

  it('calls onChange with the option value (string) and closes', () => {
    const onChange = vi.fn()
    render(<EntitySelect label="Job" value="" onChange={onChange} options={JOB_OPTS} placeholder="Select a job…" />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    fireEvent.click(screen.getByRole('option', { name: /skyline studio/i }))
    expect(onChange).toHaveBeenCalledWith('2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('marks the current option aria-selected', () => {
    render(<EntitySelect label="Job" value="1" onChange={() => {}} options={JOB_OPTS} />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    expect(screen.getByRole('option', { name: /acme corp/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /skyline studio/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders a labor glyph for options that carry one', () => {
    render(<EntitySelect label="Labor type" value="" onChange={() => {}} options={LT_OPTS} placeholder="Select…" />)
    fireEvent.click(screen.getByRole('button', { name: /labor/i }))
    const opt = screen.getByRole('option', { name: /design/i })
    expect(opt.querySelector('svg')).toBeTruthy() // the glyph rides along
  })

  it('falls back to the PunchIn brand mark for a labor option whose glyph is unset', () => {
    // A labor type always carries a `glyph` key, even when unset (old records).
    // Like glyphComponent()/LaborTag everywhere else, the picker must then show
    // the brand mark — never a bare colour dot — so the glyph rides along.
    const opts = [{ value: '1', label: 'Untagged', color: '#FF0000', glyph: undefined }]
    render(<EntitySelect label="Labor type" value="" onChange={() => {}} options={opts} placeholder="Select…" />)
    fireEvent.click(screen.getByRole('button', { name: /labor/i }))
    const opt = screen.getByRole('option', { name: /untagged/i })
    expect(opt.querySelector('svg')).toBeTruthy()                      // a glyph, not a dot
    expect(opt.querySelector('svg path[d="M9.5 2.6h5"]')).toBeTruthy() // the crown bar is unique to PunchGlyph
  })

  it('renders a colour dot (no glyph) for a job option that omits the glyph key', () => {
    // Jobs intentionally have no glyph — they read by colour, so they show a dot,
    // not a stopwatch. (Guards the labor-fallback discriminator from leaking to jobs.)
    render(<EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    const opt = screen.getByRole('option', { name: /acme corp/i })
    expect(opt.querySelector('svg')).toBeFalsy()                  // no glyph
    expect(opt.querySelector('span.rounded-full')).toBeTruthy()  // a colour dot
  })

  it('plain mode renders neither a dot nor a glyph (settings value lists)', () => {
    // Settings selects (time format, currency, rounding, weekday) carry no
    // colour/glyph identity, so `plain` suppresses the leading visual and the
    // control reads as a normal dropdown — just label + chevron.
    const OPTS = [{ value: 'auto', label: 'Auto (match device)' }, { value: '12h', label: '12-hour' }]
    render(<EntitySelect plain label="Time format" value="auto" onChange={() => {}} options={OPTS} />)
    const trigger = screen.getByRole('button', { name: /time format/i })
    expect(trigger.querySelector('span.rounded-full')).toBeFalsy()  // no colour dot
    fireEvent.click(trigger)
    const opt = screen.getByRole('option', { name: '12-hour' })
    expect(opt.querySelector('svg')).toBeFalsy()                    // no glyph
    expect(opt.querySelector('span.rounded-full')).toBeFalsy()      // no dot
  })

  it('renders a configurable empty/clear row and selects it with value ""', () => {
    const onChange = vi.fn()
    render(<EntitySelect label="Job" value="1" onChange={onChange} options={JOB_OPTS} emptyOption={{ label: 'All Jobs' }} />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    const clear = screen.getByRole('option', { name: /all jobs/i })
    expect(clear).toBeInTheDocument()
    fireEvent.click(clear)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows the empty-row label on the trigger when value is empty (filter style)', () => {
    render(<EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} emptyOption={{ label: 'All Jobs' }} />)
    expect(screen.getByRole('button', { name: /all jobs/i })).toBeInTheDocument()
  })

  it('closes on Escape without bubbling (so a surrounding modal stays open)', () => {
    const onModalEscape = vi.fn()
    render(
      <div onKeyDown={(e) => { if (e.key === 'Escape') onModalEscape() }}>
        <EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onModalEscape).not.toHaveBeenCalled()
  })

  it('still renders a selected option that is not in its own list is the caller’s job — an absent value shows the placeholder', () => {
    // Guard: a value with no matching option falls back to the placeholder
    // rather than crashing (callers inject archived-but-selected options).
    render(<EntitySelect label="Job" value="999" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />)
    expect(screen.getByText('Select a job…')).toBeInTheDocument()
  })

  it('compact mode renders a smaller toolbar-chip trigger; the menu overlays (fixed)', () => {
    render(<EntitySelect compact label="Job" value="" onChange={() => {}} options={JOB_OPTS} emptyOption={{ label: 'All Jobs' }} />)
    const trigger = screen.getByRole('button', { name: /job/i })
    // The compact trigger matches the Timesheets toolbar filter chips:
    // rounded-lg + text-xs (vs the default rounded-xl text-[15px] modal trigger).
    expect(trigger).toHaveClass('rounded-lg')
    expect(trigger).toHaveClass('text-xs')

    fireEvent.click(trigger)
    // The menu floats over content (position: fixed, positioned off the trigger)
    // instead of expanding in flow, so it never shoves the toolbar/form down.
    expect(screen.getByRole('listbox')).toHaveStyle({ position: 'fixed' })
  })

  it('the default menu also overlays content (floats, not in-flow)', () => {
    // Dropdowns overlay rather than push the form down; both modes use a fixed
    // floating menu so a scroll-container modal never clips it.
    render(<EntitySelect label="Job" value="" onChange={() => {}} options={JOB_OPTS} placeholder="Select a job…" />)
    fireEvent.click(screen.getByRole('button', { name: /job/i }))
    expect(screen.getByRole('listbox')).toHaveStyle({ position: 'fixed' })
  })
})
