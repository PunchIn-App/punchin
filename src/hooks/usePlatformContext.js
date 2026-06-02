import { useMemo } from 'react'

function detectOS() {
  const ua = navigator.userAgent || ''
  // navigator.userAgentData is available in Chromium-based browsers and avoids
  // UA string parsing, but we still need the UA fallback for Safari/iOS.
  const platform = navigator.userAgentData?.platform?.toLowerCase() ?? ''

  if (/iphone|ipad|ipod/i.test(ua) || platform === 'ios') return 'ios'
  if (/android/i.test(ua) || platform === 'android') return 'android'
  return 'web'
}

function detectStandalone() {
  // iOS Safari sets navigator.standalone when launched from home screen.
  // All other browsers (including Chrome on iOS) expose display-mode via matchMedia.
  return (
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function usePlatformContext() {
  return useMemo(() => ({
    isStandalone: detectStandalone(),
    os: detectOS(),
  }), [])
}
