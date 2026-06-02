import { renderHook, act } from '@testing-library/react'
import { useHapticFeedback } from './useHapticFeedback'

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    configurable: true,
    value: vi.fn(),
  })
})

describe('useHapticFeedback — hapticEl', () => {
  it('returns null for "web"', () => {
    const { result } = renderHook(() => useHapticFeedback('web'))
    expect(result.current.hapticEl).toBeNull()
  })

  it('returns null for "android"', () => {
    const { result } = renderHook(() => useHapticFeedback('android'))
    expect(result.current.hapticEl).toBeNull()
  })

  it('returns a non-null JSX element for "ios"', () => {
    const { result } = renderHook(() => useHapticFeedback('ios'))
    expect(result.current.hapticEl).not.toBeNull()
  })
})

describe('useHapticFeedback — trigger', () => {
  it('calls navigator.vibrate(40) on android', () => {
    const { result } = renderHook(() => useHapticFeedback('android'))
    act(() => { result.current.trigger() })
    expect(navigator.vibrate).toHaveBeenCalledWith(40)
  })

  it('does not call navigator.vibrate on web', () => {
    const { result } = renderHook(() => useHapticFeedback('web'))
    act(() => { result.current.trigger() })
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })

  it('does not call navigator.vibrate on ios', () => {
    const { result } = renderHook(() => useHapticFeedback('ios'))
    act(() => { result.current.trigger() })
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })
})
