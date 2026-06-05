import { render, screen, fireEvent } from '@testing-library/react'
import LongRunningMinutesInput from './LongRunningMinutesInput'

// Focused unit test for the long-running threshold field (issue #111). Rendered
// in isolation — it deliberately does NOT pull in the full SettingsView graph,
// which is too heavy to import in a single local test worker.

const setup = (minutes = 60) => {
  const onChange = vi.fn()
  const onTurnOff = vi.fn()
  render(<LongRunningMinutesInput minutes={minutes} onChange={onChange} onTurnOff={onTurnOff} />)
  const input = screen.getByLabelText(/minutes before a long-running timer reminder/i)
  return { input, onChange, onTurnOff }
}

describe('LongRunningMinutesInput (#111)', () => {
  it('shows the current threshold', () => {
    const { input } = setup(45)
    expect(input.value).toBe('45')
  })

  it('commits a clean, in-range value as it is typed', () => {
    const { input, onChange, onTurnOff } = setup(60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith(30)
    expect(onTurnOff).not.toHaveBeenCalled()
  })

  it('can be backspaced fully empty without snapping back (the bug)', () => {
    const { input, onChange } = setup(60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    // The field holds the empty draft instead of being forced back to 60…
    expect(input.value).toBe('')
    // …and nothing is persisted while it's empty.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('turns the reminder off when blurred empty', () => {
    const { input, onChange, onTurnOff } = setup(60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onTurnOff).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not persist a zero while editing, and turns the reminder off on blur', () => {
    const { input, onChange, onTurnOff } = setup(60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '0' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onTurnOff).toHaveBeenCalledTimes(1)
  })

  it('clamps an over-max value to 1440 on blur', () => {
    const { input, onChange, onTurnOff } = setup(60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '5000' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(1440)
    expect(onTurnOff).not.toHaveBeenCalled()
    expect(input.value).toBe('1440')
  })

  it('reflects an external minutes change only while not editing', () => {
    const onChange = vi.fn()
    const onTurnOff = vi.fn()
    const { rerender } = render(
      <LongRunningMinutesInput minutes={60} onChange={onChange} onTurnOff={onTurnOff} />,
    )
    const input = screen.getByLabelText(/minutes before a long-running timer reminder/i)
    // Not editing: an external update (e.g. cloud sync) flows into the field.
    rerender(<LongRunningMinutesInput minutes={90} onChange={onChange} onTurnOff={onTurnOff} />)
    expect(input.value).toBe('90')
    // While editing: an external update must NOT clobber the user's keystrokes.
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '12' } })
    rerender(<LongRunningMinutesInput minutes={5} onChange={onChange} onTurnOff={onTurnOff} />)
    expect(input.value).toBe('12')
  })
})
