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

// On iOS, Add-to-Home-Screen that produces a real standalone PWA is Safari-only.
// Third-party iOS browsers (Chrome/CriOS, Firefox/FxiOS, Edge/EdgiOS) are WebKit
// under the hood but cannot install a true PWA — so we must distinguish them.
function detectIOSSafari(os) {
  if (os !== 'ios') return false
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(navigator.userAgent || '')
}

export function usePlatformContext() {
  return useMemo(() => {
    const os = detectOS()
    return {
      isStandalone: detectStandalone(),
      os,
      // True only in iOS Safari, where Add to Home Screen actually works.
      isIOSSafari: detectIOSSafari(os),
    }
  }, [])
}
