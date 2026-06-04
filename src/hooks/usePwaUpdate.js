import { useState, useEffect } from 'react'
import { applyUpdate, hasWaitingUpdate } from '../utils/pwa'

// PWA "update available" coordination, isolated from SettingsView (issue #149).
// The signal arrives via four mechanisms that have to agree:
//   - React state (updateAvailable) drives the UI affordance
//   - window.__pwaUpdateAvailable is a cross-reload flag main.jsx also sets
//   - the service worker's reg.waiting holds an update that downloaded earlier
//   - a 'pwa:update-ready' window event fires when onNeedRefresh runs
// Returns { updateAvailable, updateStatus, checkForUpdates }.
export function usePwaUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(() => !!window.__pwaUpdateAvailable)
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'latest'

  useEffect(() => {
    const onUpdateReady = () => setUpdateAvailable(true)
    window.addEventListener('pwa:update-ready', onUpdateReady)
    return () => window.removeEventListener('pwa:update-ready', onUpdateReady)
  }, [])

  // An update may have downloaded in a previous page load and still be waiting
  // to activate, but the in-memory flag resets on mount. Re-surface it so the
  // "Update available" affordance survives reloads / factory reset (issue #57).
  useEffect(() => {
    let cancelled = false
    hasWaitingUpdate().then(waiting => {
      if (waiting && !cancelled) {
        window.__pwaUpdateAvailable = true
        setUpdateAvailable(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  const checkForUpdates = async () => {
    if (updateAvailable) {
      applyUpdate()
      return
    }

    setUpdateStatus('checking')

    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 3000)
      return
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3000)
        return
      }

      // Prompt the browser to fetch the SW from the server right now.
      // If a new version is found, onNeedRefresh in main.jsx fires and
      // dispatches pwa:update-ready, which sets updateAvailable via the
      // useEffect listener above.
      await reg.update()

      // Wait long enough for the new SW to download and trigger onNeedRefresh.
      await new Promise(r => setTimeout(r, 2500))

      // Treat the update as available if either onNeedRefresh fired during the
      // wait OR a worker is already sitting in reg.waiting (downloaded earlier,
      // e.g. before a reload, so the in-memory flag never got set). Without the
      // reg.waiting check, a pending update reports "Already up to date" and
      // can never be applied (issue #57).
      const updateReady = window.__pwaUpdateAvailable || await hasWaitingUpdate()

      if (!updateReady) {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus(null), 3000)
      } else {
        // An update is ready. Surface it and clear the 'checking' status so the
        // button re-enables — otherwise it stays disabled/greyed out and the
        // user can't tap again to apply the update.
        window.__pwaUpdateAvailable = true
        setUpdateAvailable(true)
        setUpdateStatus(null)
      }
    } catch {
      setUpdateStatus('latest')
      setTimeout(() => setUpdateStatus(null), 3000)
    }
  }

  return { updateAvailable, updateStatus, checkForUpdates }
}
