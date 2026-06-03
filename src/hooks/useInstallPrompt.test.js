import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'

beforeEach(() => {
  delete window.__pwaInstallPrompt
})

describe('useInstallPrompt', () => {
  it('reports canInstall=false when no prompt has been captured', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(result.current.isInstalled).toBe(false)
  })

  it('reports canInstall=true after pwa:install-ready fires with a captured prompt', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.__pwaInstallPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }
      window.dispatchEvent(new Event('pwa:install-ready'))
    })
    expect(result.current.canInstall).toBe(true)
  })

  it('marks installed and clears canInstall on pwa:installed', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.__pwaInstallPrompt = { prompt: vi.fn() }
      window.dispatchEvent(new Event('pwa:install-ready'))
    })
    act(() => {
      window.dispatchEvent(new Event('pwa:installed'))
    })
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('promptInstall returns null when no prompt is available', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    let outcome
    await act(async () => { outcome = await result.current.promptInstall() })
    expect(outcome).toBeNull()
  })

  it('promptInstall fires the native prompt and clears it when accepted', async () => {
    const prompt = vi.fn()
    window.__pwaInstallPrompt = { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) }
    const { result } = renderHook(() => useInstallPrompt())
    act(() => { window.dispatchEvent(new Event('pwa:install-ready')) })

    let outcome
    await act(async () => { outcome = await result.current.promptInstall() })
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('accepted')
    expect(window.__pwaInstallPrompt).toBeNull()
    expect(result.current.canInstall).toBe(false)
  })

  it('promptInstall keeps the prompt when the user dismisses it', async () => {
    const prompt = vi.fn()
    window.__pwaInstallPrompt = { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) }
    const { result } = renderHook(() => useInstallPrompt())
    act(() => { window.dispatchEvent(new Event('pwa:install-ready')) })

    let outcome
    await act(async () => { outcome = await result.current.promptInstall() })
    expect(outcome).toBe('dismissed')
    expect(window.__pwaInstallPrompt).not.toBeNull()
  })
})
