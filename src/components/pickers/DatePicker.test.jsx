import { render, screen, fireEvent } from '@testing-library/react'
import DatePicker from './DatePicker'

const open = () => fireEvent.click(screen.getByRole('button', { name: /start date/i }))

describe('DatePicker — trigger', () => {
  it('shows the selected date in a friendly form', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    expect(screen.getByRole('button', { name: /start date: jun 8, 2026/i })).toBeInTheDocument()
  })

  it('shows a placeholder when the value is empty/invalid', () => {
    render(<DatePicker value="" onChange={vi.fn()} label="Start Date" />)
    expect(screen.getByRole('button', { name: /start date: select date/i })).toBeInTheDocument()
  })
})

describe('DatePicker — calendar', () => {
  it('opens the calendar on the value’s month with the selected day pressed', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('June 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'June 8, 2026' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selecting a day emits its YYYY-MM-DD and closes', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-06-08" onChange={onChange} label="Start Date" />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'June 15, 2026' }))
    expect(onChange).toHaveBeenCalledWith('2026-06-15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navigates months and selects in the new month', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-06-08" onChange={onChange} label="Start Date" />)
    open()
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'July 3, 2026' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-03')
  })

  it('arrow-key navigation moves the focused day across a week', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    open()
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'ArrowDown' }) // +7 days → June 15
    expect(screen.getByRole('button', { name: 'June 15, 2026' })).toHaveAttribute('tabindex', '0')
  })

  it('closes on Escape', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('DatePicker — focus restoration (WCAG 2.4.3)', () => {
  it('returns focus to the trigger when closed via Escape', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    const trigger = screen.getByRole('button', { name: /start date/i })
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger when a day is selected', () => {
    render(<DatePicker value="2026-06-08" onChange={vi.fn()} label="Start Date" />)
    const trigger = screen.getByRole('button', { name: /start date/i })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'June 15, 2026' }))
    expect(trigger).toHaveFocus()
  })
})
