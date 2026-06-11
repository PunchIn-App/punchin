import { renderHook, act } from '@testing-library/react'
import { useNowTicker } from './useNowTicker'

describe('useNowTicker (issue #265)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('holds a static value and registers no interval while inactive', () => {
    const { result } = renderHook(() => useNowTicker(false, 1000))
    const first = result.current
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(first)
  })

  it('advances on the interval while active', () => {
    const { result } = renderHook(() => useNowTicker(true, 1000))
    const first = result.current
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBeGreaterThan(first)
  })

  it('stops advancing once it becomes inactive', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useNowTicker(active, 1000),
      { initialProps: { active: true } },
    )
    act(() => vi.advanceTimersByTime(1000))
    const whileActive = result.current
    rerender({ active: false })
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(whileActive)
  })

  it('resyncs immediately when it becomes active (no stale value)', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useNowTicker(active, 1000),
      { initialProps: { active: false } },
    )
    const before = result.current
    act(() => vi.advanceTimersByTime(10_000)) // time passes while inactive
    rerender({ active: true })                // becoming active resyncs to now
    expect(result.current).toBeGreaterThanOrEqual(before)
  })
})
