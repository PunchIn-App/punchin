import { useMemo } from 'react'

function detectOS() {
  const ua = navigator.userAgent || ''
  // navigator.userAgentData is available in Chromium-based browsers and avoids
  // UA string parsing, but we still need the UA fallback for Safari/iOS.
  const platform = navigator.userAgentData?.platform?.toLowerCase() ?? ''

  if (/iphone|ipad|ipod/i.test(ua) || platform === 'ios') return 'ios'
  // iPadOS 13+ Safari requests the desktop site by default, sending a
  // "Macintosh" UA with no iPad token. Real Macs have no touchscreen, so a
  // touch-capable "Macintosh" is an iPad running in desktop mode — without
  // this, a physical iPad would be misdetected as desktop web and miss the
  // iOS install guidance entirely.
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return 'ios'
  if (/android/i.test(ua) || platform === 'android') return 'android'
  return 'web'
}

// Distinguishes iPad from iPhone. Needed because iPads have no vibration motor,
// so haptic affordances are hidden on them. Covers both the mobile-mode "iPad"
// UA and the desktop-mode touch-capable "Macintosh" UA.
function detectIPad(os) {
  if (os !== 'ios') return false
  const ua = navigator.userAgent || ''
  return /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
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
      // iPad (vs iPhone) — iPads can't do haptics, so the UI hides them there.
      isIPad: detectIPad(os),
    }
  }, [])
}
