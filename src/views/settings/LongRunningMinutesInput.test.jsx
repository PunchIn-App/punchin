import { render, screen, fireEvent } from '@testing-library/react'
import LongRunningMinutesInput from './LongRunningMinutesInput'

// Focused unit test for the long-running threshold wheel picker (issue #111).
// jsdom has no layout/scroll, so this drives the ARIA spinbutton keyboard path
// (the scroll-snap behaviour is exercised in a real browser, not here).

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

describe('LongRunningMinutesInput (#111 — 24h wheel picker)', () => {
  it('splits the stored minutes across two spinbutton wheels', () => {
    const { hours, mins } = setup(90) // 1h 30m
    expect(hours).toHaveAttribute('role', 'spinbutton')
    expect(hours).toHaveAttribute('aria-valuenow', '1')
    expect(mins).toHaveAttribute('aria-valuenow', '30')
  })

  it('snaps an off-grid stored value to the nearest 5', () => {
    expect(setup(53).mins).toHaveAttribute('aria-valuenow', '55') // 53 → 55
  })

  it('caps the minutes wheel at 55 (5-min grid)', () => {
    expect(setup(60).mins).toHaveAttribute('aria-valuemax', '55')
  })

  it('steps minutes up by 5 (ArrowDown)', () => {
    const { mins, onChange } = setup(60) // h1 m0
    fireEvent.keyDown(mins, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(65) // 1h05
  })

  it('steps minutes down by 5 (ArrowUp)', () => {
    const { mins, onChange } = setup(65) // h1 m5
    fireEvent.keyDown(mins, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith(60) // 1h00
  })

  it('steps the hours by 1 with the arrow keys', () => {
    const { hours, onChange } = setup(30) // h0 m30
    fireEvent.keyDown(hours, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(90) // 1h30
  })

  it('turns the reminder off when the wheels reach 0h 0m', () => {
    const { mins, onChange, onTurnOff } = setup(5) // h0 m05
    fireEvent.keyDown(mins, { key: 'ArrowUp' }) // → 0h 0m
    expect(onTurnOff).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clamps at the grid ends (no overflow past 23h / 55m)', () => {
    const { hours, onChange } = setup(23 * 60 + 55) // 23h55m (max)
    fireEvent.keyDown(hours, { key: 'ArrowDown' }) // already at max hour
    expect(onChange).not.toHaveBeenCalled()
  })
})
