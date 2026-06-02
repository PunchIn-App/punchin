import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

const mockUseSettings = vi.fn()
const mockDbSettingsPut     = vi.fn().mockResolvedValue(undefined)
const mockDbSettingsBulkPut = vi.fn().mockResolvedValue(undefined)

vi.mock('./hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}))

vi.mock('./db', () => ({
  db: {
    settings: {
      put:     (...a) => mockDbSettingsPut(...a),
      bulkPut: (...a) => mockDbSettingsBulkPut(...a),
    },
  },
}))
vi.mock('./components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}))
vi.mock('./components/ErrorBoundary', () => ({
  default: ({ children }) => <>{children}</>,
}))
vi.mock('./views/TimerView',      () => ({ default: () => <div>TimerView</div>      }))
vi.mock('./views/JobsView',       () => ({ default: () => <div>JobsView</div>       }))
vi.mock('./views/TimesheetsView', () => ({ default: () => <div>TimesheetsView</div> }))
vi.mock('./views/AnalyticsView',  () => ({ default: () => <div>AnalyticsView</div>  }))
vi.mock('./views/SettingsView',   () => ({ default: () => <div>SettingsView</div>   }))

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.classList.remove('light')
  document.documentElement.style.removeProperty('--accent-rgb')
  window.location.hash = ''
  mockUseSettings.mockReturnValue({
    settings: { theme: 'dark', accentColor: '#F59E0B' },
    updateSetting: vi.fn(),
  })
})

describe('App — accent color CSS variable', () => {
  it('sets --accent-rgb on the root element from accentColor', () => {
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('245 158 11')
  })

  it('converts a custom hex accent color to space-separated RGB', () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: 'dark', accentColor: '#FF0000' },
      updateSetting: vi.fn(),
    })
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('255 0 0')
  })

  it('falls back to #1f6feb when accentColor is missing', () => {
    mockUseSettings.mockReturnValue({ settings: {}, updateSetting: vi.fn() })
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('31 111 235')
  })
})

describe('App — theme class', () => {
  it('does not add "light" class when theme is dark', () => {
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('adds "light" class to documentElement when theme is light', () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: 'light', accentColor: '#F59E0B' },
      updateSetting: vi.fn(),
    })
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('removes "light" class when switching back to dark theme', () => {
    document.documentElement.classList.add('light')
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})

describe('App — default view', () => {
  it('renders the Timer view by default', () => {
    render(<App />)
    expect(screen.getByText('TimerView')).toBeInTheDocument()
  })
})

describe('App — OAuth callback handling', () => {
  it('stores GitHub token when hash contains sync_token + sync_provider=github', async () => {
    window.location.hash = '#sync_token=ghtoken123&sync_provider=github'
    render(<App />)
    await waitFor(() => expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'syncProvider', value: 'github' },
        { key: 'syncToken',    value: 'ghtoken123' },
      ])
    ))
  })

  it('stores Google token when hash has access_token + state=google', async () => {
    window.location.hash = '#access_token=googletoken&token_type=Bearer&expires_in=3600&state=google'
    render(<App />)
    await waitFor(() => expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'syncProvider', value: 'google' },
        { key: 'syncToken',    value: 'googletoken' },
      ])
    ))
  })

  it('stores OneDrive token when hash has access_token + state=onedrive', async () => {
    window.location.hash = '#access_token=odtoken&expires_in=3600&state=onedrive'
    render(<App />)
    await waitFor(() => expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'syncProvider', value: 'onedrive' },
        { key: 'syncToken',    value: 'odtoken' },
      ])
    ))
  })

  it('stores sync error when hash has sync_error', async () => {
    window.location.hash = '#sync_error=auth_failed'
    render(<App />)
    await waitFor(() => expect(mockDbSettingsPut).toHaveBeenCalledWith(
      { key: 'syncError', value: 'auth_failed' }
    ))
  })

  it('ignores hash with unknown state for implicit flow', () => {
    window.location.hash = '#access_token=tok&state=unknown_provider'
    render(<App />)
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
  })

  it('does nothing when hash is empty', () => {
    window.location.hash = ''
    render(<App />)
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
    expect(mockDbSettingsPut).not.toHaveBeenCalled()
  })
})
