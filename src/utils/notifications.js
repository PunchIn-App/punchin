// Thin wrappers over the browser Notification API. No backend / Web Push is
// involved — these fire *local* notifications, which only deliver reliably
// while the app is open or installed and running in the background (issue #54).

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

// 'granted' | 'denied' | 'default'
export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

// Prefer the service worker registration (required for notifications inside an
// installed PWA on Android) and fall back to the Notification constructor.
export async function showNotification(title, options = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const opts = { icon: '/icon-192.png', badge: '/icon-192.png', ...options }

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, opts)
        return true
      }
    }
  } catch {
    // fall through to the constructor below
  }

  try {
    new Notification(title, opts)
    return true
  } catch {
    return false
  }
}
