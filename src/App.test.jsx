import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import App from './App'

const mockUseSettings = vi.fn()
const mockDbSettingsPut     = vi.fn().mockResolvedValue(undefined)
const mockDbSettingsBulkPut = vi.fn().mockResolvedValue(undefined)

vi.mock('./hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}))

// Reminders run their own live queries against Dexie; exercised in
// useReminders.test.js, mocked here so App tests stay focused.
vi.mock('./hooks/useReminders', () => ({
  useReminders: () => {},
}))

// Transfer-link import (issue #77): mock the decode + merge so the App test can
// drive the confirmation prompt without real Dexie/compression.
const mockDecodeSnapshot = vi.fn()
const mockImportSnapshot = vi.fn().mockResolvedValue(3)
vi.mock('./utils/transfer', () => ({
  decodeSnapshot: (...a) => mockDecodeSnapshot(...a),
}))
vi.mock('./sync/syncManager', () => ({
  importSnapshot: (...a) => mockImportSnapshot(...a),
}))

const mockFetchGitHubUser = vi.fn().mockResolvedValue({ login: 'octocat' })
vi.mock('./sync/providers/github', () => ({
  fetchGitHubUser: (...a) => mockFetchGitHubUser(...a),
}))

// Token is encrypted at rest via tokenStore (issue #126); mock it so the OAuth
// tests can assert the token is handed off without real WebCrypto/Dexie.
const mockSetSyncToken = vi.fn().mockResolvedValue(undefined)
vi.mock('./sync/tokenStore', () => ({
  setSyncToken: (...a) => mockSetSyncToken(...a),
}))

// OneDrive Auth Code + PKCE (issue #128): mock the token exchange + verifier.
const mockExchangeOneDriveCode = vi.fn()
vi.mock('./sync/providers/onedrive', () => ({
  exchangeOneDriveCode: (...a) => mockExchangeOneDriveCode(...a),
}))
const mockConsumePkceVerifier = vi.fn(() => 'verifier')
vi.mock('./sync/pkce', () => ({
  consumePkceVerifier: () => mockConsumePkceVerifier(),
}))
vi.mock('./sync/config', () => ({
  SYNC_CONFIG: {
    github: { clientId: 'gh', callbackBase: 'https://app' },
    google: { clientId: 'g' },
    onedrive: { clientId: 'od' },
  },
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
  default: ({ children, onNavigate }) => (
    <div data-testid="layout">
      <button onClick={() => onNavigate('jobs')}>go-jobs</button>
      <button onClick={() => onNavigate('settings')}>go-settings</button>
      {children}
    </div>
  ),
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
  mockFetchGitHubUser.mockResolvedValue({ login: 'octocat' })
  document.documentElement.classList.remove('light')
  document.documentElement.style.removeProperty('--accent-rgb')
  window.location.hash = ''
  sessionStorage.clear() // clear any leftover OAuth CSRF nonce between tests (issue #125)
  // Reset the URL (path/search/hash) + global history state so back-button /
  // OAuth tests can't leak state into each other and become order-dependent.
  window.history.replaceState(null, '', '/')
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

describe('App — back-button navigation (#65)', () => {
  it('seeds a history entry tagged with the default view on mount', () => {
    render(<App />)
    expect(history.state?.piView).toBe('timer')
  })

  it('pushes a history entry when navigating to another tab', () => {
    render(<App />)
    fireEvent.click(screen.getByText('go-jobs'))
    expect(screen.getByText('JobsView')).toBeInTheDocument()
    expect(history.state?.piView).toBe('jobs')
  })

  it('restores the previous view on popstate (hardware/gesture Back)', () => {
    render(<App />)
    fireEvent.click(screen.getByText('go-jobs'))
    expect(screen.getByText('JobsView')).toBeInTheDocument()
    // Browser Back fires popstate with the previous entry's state.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { piView: 'timer' } }))
    })
    expect(screen.getByText('TimerView')).toBeInTheDocument()
  })

  it('keeps the back stack bounded across many tab switches (#80)', () => {
    render(<App />)
    const before = history.length
    // First step away from home pushes exactly one entry...
    fireEvent.click(screen.getByText('go-jobs'))
    expect(history.length).toBe(before + 1)
    expect(history.state?.piView).toBe('jobs')
    // ...and every further tab switch replaces it rather than growing the stack.
    fireEvent.click(screen.getByText('go-settings'))
    fireEvent.click(screen.getByText('go-jobs'))
    fireEvent.click(screen.getByText('go-settings'))
    expect(history.length).toBe(before + 1)
    expect(history.state?.piView).toBe('settings')
  })
})

describe('App — OAuth callback handling', () => {
  const NONCE = 'test-nonce-abc'
  beforeEach(() => {
    mockFetchGitHubUser.mockResolvedValue({ login: 'octocat' })
    sessionStorage.setItem('pi.oauthState', NONCE) // valid CSRF nonce for the happy-path tests (issue #125)
  })

  it('navigates to Settings and shows account confirmation dialog after GitHub OAuth', async () => {
    window.location.hash = `#sync_token=ghtoken123&sync_provider=github&state=${NONCE}`
    render(<App />)
    await waitFor(() => expect(screen.getByText('SettingsView')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/Connect as @octocat/)).toBeInTheDocument()
    // discloses the broad gist scope so the grant is informed (issue #127)
    expect(screen.getByText(/grants access to your GitHub gists/i)).toBeInTheDocument()
    // token must NOT be saved to DB until user confirms
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
  })

  it('saves GitHub token and username when the user confirms the account', async () => {
    window.location.hash = `#sync_token=ghtoken123&sync_provider=github&state=${NONCE}`
    render(<App />)
    await waitFor(() => screen.getByRole('dialog'))
    await act(async () => { screen.getByRole('button', { name: 'Connect' }).click() })
    expect(mockSetSyncToken).toHaveBeenCalledWith('ghtoken123') // encrypted at rest (issue #126)
    expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'syncProvider', value: 'github' },
        { key: 'syncUsername', value: 'octocat'    },
      ])
    )
  })

  it('saves syncUsername as null when GitHub user fetch returns null', async () => {
    mockFetchGitHubUser.mockResolvedValueOnce(null)
    window.location.hash = `#sync_token=tok&sync_provider=github&state=${NONCE}`
    render(<App />)
    await waitFor(() => screen.getByRole('dialog'))
    await act(async () => { screen.getByRole('button', { name: 'Connect' }).click() })
    expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([{ key: 'syncUsername', value: null }])
    )
  })

  it('does not save anything when the user cancels the account confirmation', async () => {
    window.location.hash = `#sync_token=ghtoken123&sync_provider=github&state=${NONCE}`
    render(<App />)
    await waitFor(() => screen.getByRole('dialog'))
    await act(async () => { screen.getByRole('button', { name: 'Cancel' }).click() })
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes the confirmation on Escape without saving', async () => {
    window.location.hash = `#sync_token=ghtoken123&sync_provider=github&state=${NONCE}`
    render(<App />)
    await screen.findByRole('dialog')
    // Flush effects so the dialog's document-level Escape listener is attached
    // before we dispatch the key — otherwise the keydown can race the listener.
    await act(async () => {})
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('stores Google token when hash has access_token + state=google', async () => {
    window.location.hash = `#access_token=googletoken&token_type=Bearer&expires_in=3600&state=google:${NONCE}`
    render(<App />)
    await waitFor(() => expect(mockSetSyncToken).toHaveBeenCalledWith('googletoken'))
    expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([{ key: 'syncProvider', value: 'google' }])
    )
  })

  it('navigates to Settings after Google OAuth callback', async () => {
    window.location.hash = `#access_token=googletoken&token_type=Bearer&expires_in=3600&state=google:${NONCE}`
    render(<App />)
    await waitFor(() => expect(screen.getByText('SettingsView')).toBeInTheDocument())
  })

  it('exchanges the OneDrive auth code (PKCE) and stores the token (issue #128)', async () => {
    mockExchangeOneDriveCode.mockResolvedValueOnce({ access_token: 'odtoken', expires_in: 3600 })
    window.history.replaceState(null, '', `/?code=AUTHCODE&state=onedrive:${NONCE}`)
    render(<App />)
    await waitFor(() => expect(mockExchangeOneDriveCode).toHaveBeenCalledWith('od', 'AUTHCODE', 'verifier'))
    await waitFor(() => expect(mockSetSyncToken).toHaveBeenCalledWith('odtoken'))
    expect(mockDbSettingsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([{ key: 'syncProvider', value: 'onedrive' }])
    )
  })

  it('rejects the GitHub callback when the CSRF state does not match (no token, no dialog)', async () => {
    window.location.hash = `#sync_token=ghtoken123&sync_provider=github&state=WRONG-${NONCE}`
    render(<App />)
    await waitFor(() => expect(mockDbSettingsPut).toHaveBeenCalledWith(
      { key: 'syncError', value: 'Sign-in failed: the security check did not match. Please try connecting again.' }
    ))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
  })

  it('rejects a Google callback when the CSRF nonce does not match (no token saved)', async () => {
    window.location.hash = `#access_token=googletoken&expires_in=3600&state=google:WRONG-${NONCE}`
    render(<App />)
    await waitFor(() => expect(mockDbSettingsPut).toHaveBeenCalledWith(
      { key: 'syncError', value: 'Sign-in failed: the security check did not match. Please try connecting again.' }
    ))
    expect(mockDbSettingsBulkPut).not.toHaveBeenCalled()
  })

  it('stores a friendly message for a known sync_error code', async () => {
    window.location.hash = '#sync_error=auth_failed'
    render(<App />)
    await waitFor(() => expect(mockDbSettingsPut).toHaveBeenCalledWith(
      { key: 'syncError', value: 'Sign-in failed: authorization was denied.' }
    ))
  })

  it('maps an unknown/crafted sync_error code to a generic message (no reflected text)', async () => {
    window.location.hash = '#sync_error=' + encodeURIComponent('<b>Totally legit</b> — call 1-800-SCAM')
    render(<App />)
    await waitFor(() => expect(mockDbSettingsPut).toHaveBeenCalledWith(
      { key: 'syncError', value: 'Sign-in failed. Please try again.' }
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

describe('App — transfer link import (#77)', () => {
  it('shows an import confirmation when opened with an #import= link', async () => {
    mockDecodeSnapshot.mockResolvedValue({ jobs: [{}], entries: [{}, {}], laborTypes: [] })
    window.location.hash = '#import=gABCDEF'
    render(<App />)
    expect(await screen.findByText('Import shared data?')).toBeInTheDocument()
    expect(mockDecodeSnapshot).toHaveBeenCalledWith('gABCDEF')
  })

  it('merges the snapshot when the import is confirmed', async () => {
    const snap = { jobs: [{}], entries: [{}, {}], laborTypes: [] }
    mockDecodeSnapshot.mockResolvedValue(snap)
    window.location.hash = '#import=gABCDEF'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^import$/i }))
    await waitFor(() => expect(mockImportSnapshot).toHaveBeenCalledWith(snap))
  })

  it('does not import when the confirmation is cancelled', async () => {
    mockDecodeSnapshot.mockResolvedValue({ jobs: [], entries: [], laborTypes: [] })
    window.location.hash = '#import=gABCDEF'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }))
    expect(mockImportSnapshot).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Import shared data?')).not.toBeInTheDocument())
  })

  it('ignores a corrupt transfer link silently', async () => {
    mockDecodeSnapshot.mockRejectedValue(new Error('bad'))
    window.location.hash = '#import=gBAD'
    render(<App />)
    // Deterministic: wait for the decode to be attempted, then let its rejection
    // settle, instead of sleeping a fixed time and asserting a negative.
    await waitFor(() => expect(mockDecodeSnapshot).toHaveBeenCalledWith('gBAD'))
    await act(async () => {})
    expect(screen.queryByText('Import shared data?')).not.toBeInTheDocument()
  })
})
