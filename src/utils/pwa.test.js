import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initPwaInstallPrompt,
  getInstallPrompt,
  notifyUpdateAvailable,
  setPwaUpdateFn,
  applyUpdate,
  hasWaitingUpdate,
} from './pwa'

beforeEach(() => {
  delete window.__pwaInstallPrompt
  delete window.__pwaUpdateAvailable
  delete window.__pwaUpdateFn
})

describe('getInstallPrompt', () => {
  it('returns null when nothing is stored', () => {
    expect(getInstallPrompt()).toBeNull()
  })

  it('returns the stored prompt object', () => {
    const fakePrompt = { prompt: vi.fn() }
    window.__pwaInstallPrompt = fakePrompt
    expect(getInstallPrompt()).toBe(fakePrompt)
  })
})

describe('notifyUpdateAvailable', () => {
  it('sets window.__pwaUpdateAvailable to true', () => {
    notifyUpdateAvailable()
    expect(window.__pwaUpdateAvailable).toBe(true)
  })

  it('dispatches pwa:update-ready event', () => {
    const handler = vi.fn()
    window.addEventListener('pwa:update-ready', handler)
    notifyUpdateAvailable()
    window.removeEventListener('pwa:update-ready', handler)
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('hasWaitingUpdate', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
  const setSW = value =>
    Object.defineProperty(navigator, 'serviceWorker', { value, configurable: true })
  const restore = () => {
    if (original) Object.defineProperty(navigator, 'serviceWorker', original)
    else setSW(undefined)
  }

  it('returns false when serviceWorker is unsupported', async () => {
    setSW(undefined)
    expect(await hasWaitingUpdate()).toBe(false)
    restore()
  })

  it('returns false when there is no registration', async () => {
    setSW({ getRegistration: vi.fn().mockResolvedValue(null) })
    expect(await hasWaitingUpdate()).toBe(false)
    restore()
  })

  it('returns false when the registration has no waiting worker', async () => {
    setSW({ getRegistration: vi.fn().mockResolvedValue({ waiting: null }) })
    expect(await hasWaitingUpdate()).toBe(false)
    restore()
  })

  it('returns true when a worker is waiting to activate', async () => {
    setSW({ getRegistration: vi.fn().mockResolvedValue({ waiting: {} }) })
    expect(await hasWaitingUpdate()).toBe(true)
    restore()
  })

  it('returns false (does not throw) when getRegistration rejects', async () => {
    setSW({ getRegistration: vi.fn().mockRejectedValue(new Error('boom')) })
    expect(await hasWaitingUpdate()).toBe(false)
    restore()
  })
})

describe('setPwaUpdateFn', () => {
  it('stores the function so applyUpdate can call it', () => {
    const fn = vi.fn()
    setPwaUpdateFn(fn)
    applyUpdate()
    expect(fn).toHaveBeenCalledWith(true)
  })
})

describe('applyUpdate', () => {
  it('calls the stored update function with true', () => {
    const fn = vi.fn()
    window.__pwaUpdateFn = fn
    applyUpdate()
    expect(fn).toHaveBeenCalledWith(true)
  })

  it('does not call the update function when none is stored', () => {
    // Verifies the branch is exercised without trying to mock location.reload
    // (jsdom does not allow redefining window.location.reload via spyOn).
    expect(() => applyUpdate()).not.toThrow()
  })
})

describe('initPwaInstallPrompt', () => {
  // initPwaInstallPrompt registers persistent window listeners. Call it once
  // for this block so that multiple tests don't stack duplicate handlers.
  beforeEach(() => {
    initPwaInstallPrompt()
  })

  it('stores the event and dispatches pwa:install-ready on beforeinstallprompt', () => {
    const readyHandler = vi.fn()
    window.addEventListener('pwa:install-ready', readyHandler)

    const fakeEvent = new Event('beforeinstallprompt')
    fakeEvent.preventDefault = vi.fn()
    window.dispatchEvent(fakeEvent)

    window.removeEventListener('pwa:install-ready', readyHandler)
    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    expect(window.__pwaInstallPrompt).toBe(fakeEvent)
    expect(readyHandler).toHaveBeenCalled()
  })

  it('clears the stored prompt and dispatches pwa:installed on appinstalled', () => {
    window.__pwaInstallPrompt = { prompt: vi.fn() }
    const installedHandler = vi.fn()
    window.addEventListener('pwa:installed', installedHandler)

    window.dispatchEvent(new Event('appinstalled'))

    window.removeEventListener('pwa:installed', installedHandler)
    expect(window.__pwaInstallPrompt).toBeNull()
    expect(installedHandler).toHaveBeenCalled()
  })
})
