import { render, screen, fireEvent } from '@testing-library/react'
import LongRunningMinutesInput from './LongRunningMinutesInput'

// Focused unit test for the long-running threshold picker (issue #111). It's now a
// popover (issue #229), so each case opens it first. jsdom has no layout/scroll,
// so this drives the ARIA spinbutton keyboard path + the typeable fields (the
// scroll-snap + wrap behaviour is exercised in a real browser).

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /long-running threshold/i }))

const setup = (minutes = 60) => {
  const onChange = vi.fn()
  const onTurnOff = vi.fn()
  render(<LongRunningMinutesInput minutes={minutes} onChange={onChange} onTurnOff={onTurnOff} />)
  openPicker()
  return {
    hours: screen.getByLabelText(/hours before a long-running timer reminder/i),
    mins: screen.getByLabelText(/minutes before a long-running timer reminder/i),
    onChange,
    onTurnOff,
  }
}

// jsdom has no layout but does store scrollTop. The minutes wheel renders its 12
// values as REPEAT(5) stacked copies of 34px rows, centred on the middle copy
// (PAD=1), so the scrollTop representing `steps` rows away from a centred index is:
const minScrollTop = (baseIdx, steps) => (2 * 12 + baseIdx + steps - 1) * 34

describe('LongRunningMinutesInput — trigger + typeable fields', () => {
  it('the trigger shows the duration', () => {
    render(<LongRunningMinutesInput minutes={90} onChange={vi.fn()} onTurnOff={vi.fn()} />)
    expect(screen.getByRole('button', { name: /long-running threshold: 1h 30m/i })).toBeInTheDocument()
  })

  it('typing the hours field sets the hour part', () => {
    const { onChange } = setup(90) // 1h 30m
    fireEvent.change(screen.getByLabelText(/^hours$/i), { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(150) // 2h 30m
  })

  it('typing the minutes field snaps to the 5-min grid', () => {
    const { onChange } = setup(60) // 1h 00m
    fireEvent.change(screen.getByLabelText(/^minutes$/i), { target: { value: '37' } })
    expect(onChange).toHaveBeenLastCalledWith(95) // 1h 35m (37 → 35)
  })
})

describe('LongRunningMinutesInput (#111 — 24h wheel, live minutes carry into hours)', () => {
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

  it('steps the hours by 1 (ArrowDown)', () => {
    const { hours, onChange } = setup(30) // h0 m30
    fireEvent.keyDown(hours, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(90) // 1h30
  })

  it('carries into the hour when minutes roll past 55', () => {
    const { mins, onChange } = setup(115) // 1h 55m
    fireEvent.keyDown(mins, { key: 'ArrowDown' }) // 55 → 00, +1 hour
    expect(onChange).toHaveBeenCalledWith(120) // 2h 00m
  })

  it('borrows from the hour when minutes roll below 00', () => {
    const { mins, onChange } = setup(120) // 2h 00m
    fireEvent.keyDown(mins, { key: 'ArrowUp' }) // 00 → 55, -1 hour
    expect(onChange).toHaveBeenCalledWith(115) // 1h 55m
  })

  it('wraps the hours wheel past 23 back to 0 (keeping minutes)', () => {
    const { hours, onChange } = setup(23 * 60 + 30) // 23h 30m
    fireEvent.keyDown(hours, { key: 'ArrowDown' }) // 23 → 0
    expect(onChange).toHaveBeenCalledWith(30) // 0h 30m
  })

  it('flips the hour live while the minutes wheel is mid-spin (before release)', () => {
    const { mins, hours, onChange } = setup(115) // 1h 55m; 55 is minutes index 11
    // Spin minutes up one row (55 → 00) without releasing — no settle yet.
    mins.scrollTop = minScrollTop(11, 1)
    fireEvent.scroll(mins)
    expect(hours).toHaveAttribute('aria-valuenow', '2') // hour carried over → 2h
    expect(onChange).not.toHaveBeenCalled() // nothing committed until the spin settles
  })

  it('rolls the hour back live when the minutes wheel spins below 00 (before release)', () => {
    const { mins, hours, onChange } = setup(120) // 2h 00m; 00 is minutes index 0
    mins.scrollTop = minScrollTop(0, -1) // spin down one row (00 → 55)
    fireEvent.scroll(mins)
    expect(hours).toHaveAttribute('aria-valuenow', '1') // hour borrowed → 1h
    expect(onChange).not.toHaveBeenCalled()
  })

  it('turns the reminder off when the wheels reach 0h 0m', () => {
    const { mins, onChange, onTurnOff } = setup(5) // h0 m05
    fireEvent.keyDown(mins, { key: 'ArrowUp' }) // → 0h 0m
    expect(onTurnOff).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
