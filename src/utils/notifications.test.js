import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from './notifications'

function setNotification(impl) {
  Object.defineProperty(window, 'Notification', { value: impl, configurable: true, writable: true })
}
function clearNotification() {
  delete window.Notification
}

afterEach(() => {
  clearNotification()
  vi.restoreAllMocks()
  // reset navigator.serviceWorker if a test added it
  if ('serviceWorker' in navigator) {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  }
})

describe('notificationsSupported', () => {
  it('is false when Notification is absent', () => {
    clearNotification()
    expect(notificationsSupported()).toBe(false)
  })

  it('is true when Notification exists', () => {
    setNotification(function () {})
    expect(notificationsSupported()).toBe(true)
  })
})

describe('notificationPermission', () => {
  it('returns "denied" when unsupported', () => {
    clearNotification()
    expect(notificationPermission()).toBe('denied')
  })

  it('reflects Notification.permission when supported', () => {
    const N = function () {}
    N.permission = 'granted'
    setNotification(N)
    expect(notificationPermission()).toBe('granted')
  })
})

describe('requestNotificationPermission', () => {
  it('returns "denied" when unsupported', async () => {
    clearNotification()
    expect(await requestNotificationPermission()).toBe('denied')
  })

  it('delegates to Notification.requestPermission', async () => {
    const N = function () {}
    N.requestPermission = vi.fn().mockResolvedValue('granted')
    setNotification(N)
    expect(await requestNotificationPermission()).toBe('granted')
    expect(N.requestPermission).toHaveBeenCalled()
  })

  it('returns "denied" if requestPermission throws', async () => {
    const N = function () {}
    N.requestPermission = vi.fn().mockRejectedValue(new Error('nope'))
    setNotification(N)
    expect(await requestNotificationPermission()).toBe('denied')
  })
})

describe('showNotification', () => {
  it('does nothing when permission is not granted', async () => {
    const ctor = vi.fn()
    ctor.permission = 'default'
    setNotification(ctor)
    expect(await showNotification('hi')).toBe(false)
    expect(ctor).not.toHaveBeenCalled()
  })

  it('uses the service worker registration when available', async () => {
    const ctor = vi.fn()
    ctor.permission = 'granted'
    setNotification(ctor)
    const showSW = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ showNotification: showSW }) },
      configurable: true,
    })
    expect(await showNotification('Title', { body: 'Body' })).toBe(true)
    expect(showSW).toHaveBeenCalledWith('Title', expect.objectContaining({ body: 'Body' }))
    expect(ctor).not.toHaveBeenCalled()
  })

  it('falls back to the Notification constructor when no SW registration', async () => {
    const ctor = vi.fn()
    ctor.permission = 'granted'
    setNotification(ctor)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue(null) },
      configurable: true,
    })
    expect(await showNotification('Title')).toBe(true)
    expect(ctor).toHaveBeenCalledWith('Title', expect.objectContaining({ icon: expect.any(String) }))
  })
})
