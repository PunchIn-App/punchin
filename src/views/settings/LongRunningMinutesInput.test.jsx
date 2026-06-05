import { render, screen, fireEvent } from '@testing-library/react'
import LongRunningMinutesInput from './LongRunningMinutesInput'

// Focused unit test for the long-running threshold duration picker (issue #111).
// Rendered in isolation — it deliberately does NOT pull in the full SettingsView
// graph, which is too heavy to import in a single local test worker.

const setup = (minutes = 60) => {
  const onChange = vi.fn()
  const onTurnOff = vi.fn()
  render(<LongRunningMinutesInput minutes={minutes} onChange={onChange} onTurnOff={onTurnOff} />)
  return {
    hours: screen.getByLabelText(/hours before a long-running timer reminder/i),
    mins: screen.getByLabelText(/minutes before a long-running timer reminder/i),
    onChange,
    onTurnOff,
  }
}

describe('LongRunningMinutesInput (#111 — duration picker)', () => {
  it('splits the stored minute count across the hours and minutes pickers', () => {
    const { hours, mins } = setup(90) // 1h 30m
    expect(hours.value).toBe('1')
    expect(mins.value).toBe('30')
  })

  it('uses native <select> pickers (no free-text input), avoiding AM/PM', () => {
    const { hours, mins } = setup(60)
    expect(hours.tagName).toBe('SELECT')
    expect(mins.tagName).toBe('SELECT')
  })

  it('commits the combined total when the minutes picker changes', () => {
    const { mins, onChange, onTurnOff } = setup(60) // h=1, m=0
    fireEvent.change(mins, { target: { value: '45' } })
    expect(onChange).toHaveBeenCalledWith(105) // 1h + 45m
    expect(onTurnOff).not.toHaveBeenCalled()
  })

  it('commits the combined total when the hours picker changes', () => {
    const { hours, onChange } = setup(30) // h=0, m=30
    fireEvent.change(hours, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith(150) // 2h + 30m
  })

  it('turns the reminder off when the picker reaches 0h 0m', () => {
    const { hours, onChange, onTurnOff } = setup(60) // h=1, m=0
    fireEvent.change(hours, { target: { value: '0' } }) // -> 0h 0m
    expect(onTurnOff).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clamps an out-of-range stored value to 23h 59m for display', () => {
    const { hours, mins } = setup(99999)
    expect(hours.value).toBe('23')
    expect(mins.value).toBe('59')
  })

  it('falls back to the 60-minute default for a non-finite value', () => {
    const { hours, mins } = setup(NaN)
    expect(hours.value).toBe('1')
    expect(mins.value).toBe('0')
  })
})
