import { render, screen, fireEvent } from '@testing-library/react'
import SettingsView from './SettingsView'

// Sync now lives inside the "Data & Sync" drill-in page (issue #60); open that
// page before asserting on its contents.
const expandSync = () =>
  fireEvent.click(screen.getByRole('button', { name: /^data & sync/i }))

// Mirrors a production build with NO VITE_*_CLIENT_ID set — every provider
// clientId is empty, so the Sync section must fall back to the friendly
// "not set up" message instead of showing developer env-var jargon (issue #59).

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { allowConcurrentTimers: false, weekStartsMonday: true, theme: 'auto', accentColor: '#1f6feb' },
    updateSetting: vi.fn(),
  }),
}))

vi.mock('../db', () => ({
  db: {
    jobs:       { get toArray() { return vi.fn().mockResolvedValue([]) } },
    entries:    { get toArray() { return vi.fn().mockResolvedValue([]) } },
    laborTypes: { get toArray() { return vi.fn().mockResolvedValue([]) } },
    settings:   { get toArray() { return vi.fn().mockResolvedValue([]) } },
    transaction: (_mode, _tables, fn) => fn(),
  },
}))

vi.mock('../components/ColorPicker', () => ({
  default: () => <div data-testid="color-picker" />,
}))
vi.mock('../components/ChangelogModal', () => ({
  default: () => <div data-testid="changelog-modal" />,
}))

vi.mock('../sync/syncManager', () => ({
  runSync: vi.fn(),
  disconnectSync: vi.fn(),
}))

vi.mock('../sync/config', () => ({
  SYNC_CONFIG: {
    github:   { clientId: '', callbackBase: 'https://example.com' },
    google:   { clientId: '' },
    onedrive: { clientId: '' },
    dropbox:  { clientId: '' },
  },
}))

vi.mock('../sync/providers/github',   () => ({ buildGitHubOAuthUrl:   () => '' }))
vi.mock('../sync/providers/google',   () => ({ buildGoogleOAuthUrl:   () => '' }))
vi.mock('../sync/providers/onedrive', () => ({ buildOneDriveOAuthUrl: () => '' }))
vi.mock('../sync/providers/dropbox',  () => ({ buildDropboxOAuthUrl:  () => '' }))

describe('SettingsView — Sync section with no providers configured', () => {
  it('shows the friendly "not set up" message instead of env-var instructions', () => {
    render(<SettingsView />)
    expandSync()
    expect(screen.getByText(/Sync isn’t set up on this version/)).toBeInTheDocument()
    expect(screen.getByText(/hasn’t been configured for this deployment/)).toBeInTheDocument()
  })

  it('does not leak developer env-var names into the UI', () => {
    render(<SettingsView />)
    expandSync()
    expect(screen.queryByText(/VITE_GITHUB_CLIENT_ID/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\.env\.example/)).not.toBeInTheDocument()
  })

  it('renders no provider connect buttons', () => {
    render(<SettingsView />)
    expandSync()
    expect(screen.queryByText('GitHub Gist')).not.toBeInTheDocument()
    expect(screen.queryByText('Google Drive')).not.toBeInTheDocument()
    expect(screen.queryByText('OneDrive')).not.toBeInTheDocument()
  })
})
