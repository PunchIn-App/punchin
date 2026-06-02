import { renderHook, act } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSettings } from './useSettings'

// Hoist-safe mock variables (must start with "mock")
const mockSettingsPut = vi.fn().mockResolvedValue(undefined)

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../db', () => ({
  db: {
    settings: {
      toArray: vi.fn(),
      get put() { return mockSettingsPut },
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSettings', () => {
  it('returns empty settings object while loading (useLiveQuery returns undefined)', () => {
    useLiveQuery.mockReturnValue(undefined)
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual({})
  })

  it('returns the settings object from useLiveQuery when loaded', () => {
    useLiveQuery.mockReturnValue({
      allowConcurrentTimers: false,
      weekStartsMonday: true,
      theme: 'auto',
      accentColor: '#F59E0B',
    })
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual({
      allowConcurrentTimers: false,
      weekStartsMonday: true,
      theme: 'auto',
      accentColor: '#F59E0B',
    })
  })

  it('exposes an updateSetting function', () => {
    useLiveQuery.mockReturnValue({})
    const { result } = renderHook(() => useSettings())
    expect(typeof result.current.updateSetting).toBe('function')
  })

  it('updateSetting calls db.settings.put with the correct key and value', async () => {
    useLiveQuery.mockReturnValue({})
    const { result } = renderHook(() => useSettings())
    await act(async () => {
      await result.current.updateSetting('theme', 'dark')
    })
    expect(mockSettingsPut).toHaveBeenCalledWith({ key: 'theme', value: 'dark' })
  })

  it('updateSetting works with boolean values', async () => {
    useLiveQuery.mockReturnValue({})
    const { result } = renderHook(() => useSettings())
    await act(async () => {
      await result.current.updateSetting('allowConcurrentTimers', true)
    })
    expect(mockSettingsPut).toHaveBeenCalledWith({ key: 'allowConcurrentTimers', value: true })
  })

  it('settings falls back to {} when useLiveQuery returns null', () => {
    useLiveQuery.mockReturnValue(null)
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual({})
  })
})
