import { renderHook, act, waitFor } from '@testing-library/react'
import { usePwaUpdate } from './usePwaUpdate'

const mockApplyUpdate      = vi.fn()
const mockHasWaitingUpdate = vi.fn().mockResolvedValue(false)

vi.mock('../utils/pwa', () => ({
  applyUpdate: (...a) => mockApplyUpdate(...a),
  hasWaitingUpdate: (...a) => mockHasWaitingUpdate(...a),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockHasWaitingUpdate.mockResolvedValue(false)
  window.__pwaUpdateAvailable = false
})

describe('usePwaUpdate', () => {
  it('starts with updateAvailable reflecting window.__pwaUpdateAvailable', () => {
    window.__pwaUpdateAvailable = true
    const { result } = renderHook(() => usePwaUpdate())
    expect(result.current.updateAvailable).toBe(true)
  })

  it('sets updateAvailable when a pwa:update-ready event fires', () => {
    const { result } = renderHook(() => usePwaUpdate())
    expect(result.current.updateAvailable).toBe(false)
    act(() => { window.dispatchEvent(new Event('pwa:update-ready')) })
    expect(result.current.updateAvailable).toBe(true)
  })

  it('re-surfaces a waiting update on mount (issue #57)', async () => {
    mockHasWaitingUpdate.mockResolvedValue(true)
    const { result } = renderHook(() => usePwaUpdate())
    await waitFor(() => expect(result.current.updateAvailable).toBe(true))
    expect(window.__pwaUpdateAvailable).toBe(true)
  })

  it('applies the update immediately when one is already available', async () => {
    window.__pwaUpdateAvailable = true
    const { result } = renderHook(() => usePwaUpdate())
    await act(async () => { await result.current.checkForUpdates() })
    expect(mockApplyUpdate).toHaveBeenCalled()
  })

  it('reports "latest" when there is no service worker registration', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue(null) },
      configurable: true,
    })
    const { result } = renderHook(() => usePwaUpdate())
    await act(async () => { await result.current.checkForUpdates() })
    expect(result.current.updateStatus).toBe('latest')
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  })
})
