import { render, screen } from '@testing-library/react'
import DataSyncPanel from './DataSyncPanel'

// Focused test for the sync status live region (WCAG 4.1.3). Rendered directly
// (not through the full SettingsView graph). A connected provider is required
// for the status block to show, so settings.syncProvider is set.

let mockSettings = {}
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: vi.fn() }),
}))

vi.mock('../../db', () => ({
  db: { settings: { put: vi.fn() } },
  defaultSettingsRows: () => [],
}))

vi.mock('../../sync/syncManager', () => ({
  runSync: vi.fn(),
  disconnectSync: vi.fn(),
  importSnapshot: vi.fn(),
}))

vi.mock('../../sync/config', () => ({
  SYNC_CONFIG: {
    github:   { clientId: '', callbackBase: 'https://example.com' },
    google:   { clientId: '' },
    onedrive: { clientId: '' },
  },
}))

vi.mock('../../sync/providers/github',   () => ({ buildGitHubOAuthUrl:   () => '' }))
vi.mock('../../sync/providers/google',   () => ({ buildGoogleOAuthUrl:   () => '' }))
vi.mock('../../sync/providers/onedrive', () => ({ buildOneDriveOAuthUrl: () => '' }))
vi.mock('../../sync/oauthState', () => ({ createOAuthState: () => 'state' }))

vi.mock('../../utils/backup', () => ({ exportBackup: vi.fn(), exportCsv: vi.fn() }))
vi.mock('../../components/DataTransfer', () => ({ default: () => <div data-testid="data-transfer" /> }))

beforeEach(() => {
  mockSettings = {}
})

describe('DataSyncPanel — sync status live region (WCAG 4.1.3)', () => {
  it('announces a sync error via role="alert" so it is read after Sync Now', () => {
    mockSettings = { syncProvider: 'github', syncError: 'Network request failed' }
    render(<DataSyncPanel onBack={() => {}} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Network request failed')
  })

  it('keeps the full error text in the accessibility tree despite truncate', () => {
    const long = 'A very long sync error message that visually truncates but must be fully announced'
    mockSettings = { syncProvider: 'github', syncError: long }
    render(<DataSyncPanel onBack={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent(long)
  })

  it('exposes the last-synced / reconnect line as a polite status', () => {
    mockSettings = { syncProvider: 'github', lastSyncedAt: Date.now() }
    render(<DataSyncPanel onBack={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Last synced/i)
  })
})
