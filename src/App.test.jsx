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

describe('App — first-run install nudge', () => {
  // jsdom in this setup does not provide localStorage; the app guards every
  // access in try/catch. Provide a Map-backed fake so the nudge logic runs.
  function fakeStorage() {
    const m = new Map()
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
      clear: () => m.clear(),
    }
  }

  // The auto-nudge is mobile-only, so present an Android UA for these tests.
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
  let realUA
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage())
    realUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    Object.defineProperty(navigator, 'userAgent', { value: ANDROID_UA, configurable: true })
    delete window.__pwaInstallPrompt
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (realUA) Object.defineProperty(navigator, 'userAgent', realUA)
    delete window.__pwaInstallPrompt
  })

  const nudge = () => screen.queryByRole('heading', { name: /install punchin/i })

  it('does not show the nudge on the very first open', () => {
    window.__pwaInstallPrompt = { prompt: vi.fn() }
    render(<App />)
    expect(nudge()).not.toBeInTheDocument()
  })

  it('shows the install nudge once the user has opened the app enough times', () => {
    localStorage.setItem('pi.opens', '1') // this mount becomes the 2nd open
    window.__pwaInstallPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) }
    render(<App />)
    expect(nudge()).toBeInTheDocument()
  })

  it('does not show the nudge again after it has been dismissed', () => {
    localStorage.setItem('pi.opens', '5')
    localStorage.setItem('pi.installNudgeDismissed', '1')
    window.__pwaInstallPrompt = { prompt: vi.fn() }
    render(<App />)
    expect(nudge()).not.toBeInTheDocument()
  })

  it('shows the nudge on Chrome-for-iOS (no native prompt, ios-other mode)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    localStorage.setItem('pi.opens', '3')
    render(<App />)
    expect(nudge()).toBeInTheDocument()
    expect(screen.getByText(/only ios browser that can add web apps/i)).toBeInTheDocument()
  })

  it('does not auto-show the nudge on desktop even when installable', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      configurable: true,
    })
    localStorage.setItem('pi.opens', '5')
    window.__pwaInstallPrompt = { prompt: vi.fn() }
    render(<App />)
    expect(nudge()).not.toBeInTheDocument()
  })
})
