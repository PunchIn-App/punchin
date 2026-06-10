import { render, screen, fireEvent } from '@testing-library/react'
import TimePicker from './TimePicker'

// Drive the 12/24h branch deterministically by mocking the settings hook; an
// explicit '12h'/'24h' makes is24Hour resolve without touching the device locale.
let mockTimeFormat = '24h'
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { timeFormat: mockTimeFormat }, updateSetting: vi.fn() }),
}))

beforeEach(() => { mockTimeFormat = '24h' })

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /start/i }))
const hours = () => screen.getByRole('spinbutton', { name: /hours/i })
const minutes = () => screen.getByRole('spinbutton', { name: /minutes/i })

describe('TimePicker — trigger', () => {
  it('shows the value in 24h form', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    expect(screen.getByRole('button', { name: /start: 09:30/i })).toBeInTheDocument()
  })

  it('shows the value in 12h form (with AM/PM) when timeFormat is 12h', () => {
    mockTimeFormat = '12h'
    render(<TimePicker value="13:05" onChange={vi.fn()} label="Start" />)
    expect(screen.getByRole('button', { name: /1:05 pm/i })).toBeInTheDocument()
  })
})

describe('TimePicker — popover + wheels', () => {
  it('opens a dialog with hour and minute spinbuttons', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    openPicker()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(hours()).toBeInTheDocument()
    expect(minutes()).toBeInTheDocument()
  })

  it('stepping the hour wheel up (ArrowUp = earlier) emits the previous hour', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.keyDown(hours(), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith('08:30')
  })

  it('stepping the minute wheel down (ArrowDown = later) emits the next minute', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.keyDown(minutes(), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('09:31')
  })

  it('wraps the hour across midnight (00:15 − 1h → 23:15)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="00:15" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.keyDown(hours(), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith('23:15')
  })

  it('wraps the minute across the hour (xx:59 + 1m → xx:00)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:59" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.keyDown(minutes(), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('09:00')
  })
})

describe('TimePicker — 12h AM/PM', () => {
  beforeEach(() => { mockTimeFormat = '12h' })

  it('renders an AM/PM toggle reflecting the value', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} label="Start" />) // 9 AM
    openPicker()
    expect(screen.getByRole('radio', { name: 'AM' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'PM' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling to PM shifts the 24h value by 12 hours', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.click(screen.getByRole('radio', { name: 'PM' }))
    expect(onChange).toHaveBeenCalledWith('21:00')
  })

  it('the hour wheel runs 1–12 (12h), not 0–23', () => {
    render(<TimePicker value="13:00" onChange={vi.fn()} label="Start" />) // 1 PM
    openPicker()
    expect(hours()).toHaveAttribute('aria-valuenow', '1')
  })
})

describe('TimePicker — AM/PM radiogroup keyboard model (WAI-ARIA APG)', () => {
  beforeEach(() => { mockTimeFormat = '12h' })

  const am = () => screen.getByRole('radio', { name: 'AM' })
  const pm = () => screen.getByRole('radio', { name: 'PM' })

  it('roving tabindex: only the checked radio is tabbable', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} label="Start" />) // 9 AM → AM checked
    openPicker()
    expect(am()).toHaveAttribute('tabindex', '0')
    expect(pm()).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight moves selection from AM to PM, updating checked + focus + tabindex', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />) // 9 AM
    openPicker()
    am().focus()
    fireEvent.keyDown(am(), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('21:00') // moving selects PM (9 PM)
  })

  it('ArrowRight from AM moves focus, checked state, and roving tabindex to PM', () => {
    const onChange = vi.fn()
    // Re-render the component with the post-select value so the radio reflects PM.
    const { rerender } = render(<TimePicker value="09:00" onChange={onChange} label="Start" />)
    openPicker()
    am().focus()
    fireEvent.keyDown(am(), { key: 'ArrowRight' })
    rerender(<TimePicker value="21:00" onChange={onChange} label="Start" />)
    expect(pm()).toHaveAttribute('aria-checked', 'true')
    expect(am()).toHaveAttribute('aria-checked', 'false')
    expect(pm()).toHaveAttribute('tabindex', '0')
    expect(am()).toHaveAttribute('tabindex', '-1')
    expect(pm()).toHaveFocus()
  })

  it('ArrowLeft moves selection from PM to AM', () => {
    const onChange = vi.fn()
    render(<TimePicker value="21:00" onChange={onChange} label="Start" />) // 9 PM
    openPicker()
    pm().focus()
    fireEvent.keyDown(pm(), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('09:00') // moving selects AM (9 AM)
  })

  it('ArrowDown also moves selection (vertical pair supported)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />) // 9 AM
    openPicker()
    am().focus()
    fireEvent.keyDown(am(), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('21:00') // → PM
  })

  it('ArrowUp also moves selection (vertical pair supported)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="21:00" onChange={onChange} label="Start" />) // 9 PM
    openPicker()
    pm().focus()
    fireEvent.keyDown(pm(), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith('09:00') // → AM
  })

  it('wraps: ArrowRight from PM (last) wraps to AM', () => {
    const onChange = vi.fn()
    render(<TimePicker value="21:00" onChange={onChange} label="Start" />) // 9 PM (PM, last)
    openPicker()
    pm().focus()
    fireEvent.keyDown(pm(), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('09:00') // wraps back to AM
  })

  it('wraps: ArrowLeft from AM (first) wraps to PM', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />) // 9 AM (AM, first)
    openPicker()
    am().focus()
    fireEvent.keyDown(am(), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('21:00') // wraps forward to PM
  })

  it('Home jumps to the first radio (AM)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="21:00" onChange={onChange} label="Start" />) // 9 PM
    openPicker()
    pm().focus()
    fireEvent.keyDown(pm(), { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('09:00') // → AM (first)
  })

  it('End jumps to the last radio (PM)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />) // 9 AM
    openPicker()
    am().focus()
    fireEvent.keyDown(am(), { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('21:00') // → PM (last)
  })

  it('Space/Enter still select the focused radio (native button behaviour preserved)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} label="Start" />) // 9 AM
    openPicker()
    // A native <button> turns Space/Enter into a click; emulate that activation.
    fireEvent.click(pm())
    expect(onChange).toHaveBeenCalledWith('21:00')
  })
})

describe('TimePicker — typeable fields', () => {
  const hourField = () => screen.getByRole('textbox', { name: /hour/i })
  const minuteField = () => screen.getByRole('textbox', { name: /minute/i })

  it('typing the hour field emits the typed hour (24h)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.change(hourField(), { target: { value: '7' } })
    expect(onChange).toHaveBeenLastCalledWith('07:30')
  })

  it('typing the minute field emits the typed minute', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.change(minuteField(), { target: { value: '45' } })
    expect(onChange).toHaveBeenLastCalledWith('09:45')
  })

  it('clamps an out-of-range typed minute (99 → 59)', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.change(minuteField(), { target: { value: '99' } })
    expect(onChange).toHaveBeenLastCalledWith('09:59')
  })

  it('ArrowUp in the hour field increments the hour', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:30" onChange={onChange} label="Start" />)
    openPicker()
    fireEvent.keyDown(hourField(), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('10:30')
  })

  it('12h: typing the hour respects the current AM/PM period', () => {
    mockTimeFormat = '12h'
    const onChange = vi.fn()
    render(<TimePicker value="13:05" onChange={onChange} label="Start" />) // 1:05 PM
    openPicker()
    fireEvent.change(hourField(), { target: { value: '3' } })
    expect(onChange).toHaveBeenLastCalledWith('15:05') // 3 PM
  })
})

describe('TimePicker — dismiss', () => {
  it('closes the popover on Escape', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    openPicker()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the popover on an outside click', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    openPicker()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirms (Enter) the typed field, closing the popover', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    openPicker()
    fireEvent.keyDown(screen.getByRole('textbox', { name: /hour/i }), { key: 'Enter' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TimePicker — focus restoration (WCAG 2.4.3)', () => {
  it('returns focus to the trigger when closed via Escape', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    const trigger = screen.getByRole('button', { name: /start/i })
    openPicker()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger when a value is confirmed (Enter)', () => {
    render(<TimePicker value="09:30" onChange={vi.fn()} label="Start" />)
    const trigger = screen.getByRole('button', { name: /start/i })
    openPicker()
    fireEvent.keyDown(screen.getByRole('textbox', { name: /hour/i }), { key: 'Enter' })
    expect(trigger).toHaveFocus()
  })
})
