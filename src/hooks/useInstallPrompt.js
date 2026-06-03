import { useState, useEffect, useCallback } from 'react'
import { getInstallPrompt } from '../utils/pwa'
import { usePlatformContext } from './usePlatformContext'

// Single source of truth for PWA install state, consumed by both the Settings
// "Add to Home Screen" row and the first-run install nudge.
//
// Platform reality this encodes:
//   - Chrome/Edge (Android + desktop) fire `beforeinstallprompt`, which pwa.js
//     captures into window.__pwaInstallPrompt and surfaces via the
//     `pwa:install-ready` event. We can replay it with .prompt() — but ONLY
//     inside a user-gesture handler, never on load.
//   - iOS Safari has no install API at all; the only path is the Share sheet's
//     "Add to Home Screen". We can show instructions but cannot trigger it.
//   - When already running standalone, nothing should be offered.
export function useInstallPrompt() {
  const { isStandalone, os } = usePlatformContext()
  const [prompt, setPrompt] = useState(getInstallPrompt)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onReady = () => setPrompt(getInstallPrompt())
    const onInstalled = () => { setPrompt(null); setInstalled(true) }
    window.addEventListener('pwa:install-ready', onReady)
    window.addEventListener('pwa:installed', onInstalled)
    return () => {
      window.removeEventListener('pwa:install-ready', onReady)
      window.removeEventListener('pwa:installed', onInstalled)
    }
  }, [])

  // Fire the captured native prompt. Must be called from a user gesture.
  // Returns the outcome string ('accepted' | 'dismissed') or null if no prompt.
  const promptInstall = useCallback(async () => {
    const p = getInstallPrompt()
    if (!p) return null
    await p.prompt()
    const { outcome } = await p.userChoice
    if (outcome === 'accepted') {
      window.__pwaInstallPrompt = null
      setPrompt(null)
    }
    return outcome
  }, [])

  return {
    // True only when a real native prompt is available and we're not already installed.
    canInstall: !!prompt && !isStandalone,
    // True when running as an installed app (or appinstalled fired this session).
    isInstalled: isStandalone || installed,
    // iOS Safari path: no API, instructions only.
    isIOS: os === 'ios',
    os,
    isStandalone,
    promptInstall,
  }
}
