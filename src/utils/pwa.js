// PWA state bridge — avoids prop-drilling in an app with no global context.
// main.jsx initialises this on startup; components subscribe to the window
// events and read the window globals to pick up current state.

export function initPwaInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    window.__pwaInstallPrompt = e
    window.dispatchEvent(new Event('pwa:install-ready'))
  })
  window.addEventListener('appinstalled', () => {
    window.__pwaInstallPrompt = null
    window.dispatchEvent(new Event('pwa:installed'))
  })
}

export function getInstallPrompt() {
  return window.__pwaInstallPrompt ?? null
}

// Called by registerSW's onNeedRefresh callback in main.jsx.
export function notifyUpdateAvailable() {
  window.__pwaUpdateAvailable = true
  window.dispatchEvent(new Event('pwa:update-ready'))
}

// Detects a service worker that has already downloaded and is waiting to
// activate. onNeedRefresh only fires once per page load, so after a reload
// (or anything that re-mounts the app, like a factory reset) the in-memory
// __pwaUpdateAvailable flag is lost even though reg.waiting still holds a
// ready update. Checking reg.waiting directly lets the UI re-surface it so
// the user can still apply the update instead of seeing "Already up to date".
export async function hasWaitingUpdate() {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return !!reg?.waiting
  } catch {
    return false
  }
}

// Stored by main.jsx so components can trigger skipWaiting without needing
// a direct reference to the registerSW return value.
export function setPwaUpdateFn(fn) {
  window.__pwaUpdateFn = fn
}

export function applyUpdate() {
  if (typeof window.__pwaUpdateFn === 'function') {
    window.__pwaUpdateFn(true)
  } else {
    window.location.reload()
  }
}
