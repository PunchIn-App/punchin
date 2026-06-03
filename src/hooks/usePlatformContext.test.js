import { renderHook } from '@testing-library/react'
import { usePlatformContext } from './usePlatformContext'

const originalMatchMedia = window.matchMedia

function setUA(ua) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, writable: true, configurable: true })
}

afterEach(() => {
  setUA('')
  Object.defineProperty(navigator, 'userAgentData', { value: undefined, writable: true, configurable: true })
  Object.defineProperty(navigator, 'standalone', { value: undefined, writable: true, configurable: true })
  window.matchMedia = originalMatchMedia
})

describe('usePlatformContext — OS detection', () => {
  it('returns "ios" for iPhone UA', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('ios')
  })

  it('returns "ios" for iPad UA', () => {
    setUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('ios')
  })

  it('returns "android" for Android UA', () => {
    setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('android')
  })

  it('returns "web" for desktop UA', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('web')
  })

  it('returns "ios" when userAgentData.platform is "iOS"', () => {
    setUA('')
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'iOS' }, writable: true, configurable: true,
    })
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('ios')
  })

  it('returns "android" when userAgentData.platform is "Android"', () => {
    setUA('')
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'Android' }, writable: true, configurable: true,
    })
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.os).toBe('android')
  })
})

describe('usePlatformContext — iOS Safari detection', () => {
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '

  it('isIOSSafari=true for iOS Safari (no third-party browser token)', () => {
    setUA(IOS + 'Version/17.0 Mobile/15E148 Safari/604.1')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isIOSSafari).toBe(true)
  })

  it('isIOSSafari=false for Chrome on iOS (CriOS)', () => {
    setUA(IOS + 'CriOS/120.0 Mobile/15E148 Safari/604.1')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isIOSSafari).toBe(false)
  })

  it('isIOSSafari=false for Firefox on iOS (FxiOS)', () => {
    setUA(IOS + 'FxiOS/121.0 Mobile/15E148 Safari/604.1')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isIOSSafari).toBe(false)
  })

  it('isIOSSafari=false for Edge on iOS (EdgiOS)', () => {
    setUA(IOS + 'EdgiOS/120.0 Mobile/15E148 Safari/604.1')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isIOSSafari).toBe(false)
  })

  it('isIOSSafari=false on non-iOS platforms', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0')
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isIOSSafari).toBe(false)
  })
})

describe('usePlatformContext — standalone detection', () => {
  beforeEach(() => {
    setUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36')
  })

  it('returns isStandalone=false when not in standalone mode (default test env)', () => {
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isStandalone).toBe(false)
  })

  it('returns isStandalone=true when matchMedia reports display-mode standalone', () => {
    window.matchMedia = (query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isStandalone).toBe(true)
  })

  it('returns isStandalone=true when navigator.standalone is true (iOS Safari)', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, writable: true, configurable: true })
    const { result } = renderHook(() => usePlatformContext())
    expect(result.current.isStandalone).toBe(true)
  })
})
