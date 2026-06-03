import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import SettingsView from './SettingsView'

// Settings are grouped into a single-open accordion (issue #60); a section's
// content only renders once its header is expanded. This opens a section by
// clicking its header button (matched on the exact title).
const expand = (label) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }))

const mockUpdateSetting       = vi.fn()
const mockDbJobsToArray       = vi.fn().mockResolvedValue([])
const mockDbEntriesToArray    = vi.fn().mockResolvedValue([])
const mockDbLaborTypesToArray = vi.fn().mockResolvedValue([])
const mockDbEntriesClear      = vi.fn().mockResolvedValue(undefined)
const mockDbJobsClear         = vi.fn().mockResolvedValue(undefined)
const mockDbLaborTypesClear   = vi.fn().mockResolvedValue(undefined)
const mockDbSettingsClear     = vi.fn().mockResolvedValue(undefined)
const mockDbSettingsBulkPut   = vi.fn().mockResolvedValue(undefined)
const mockDbSettingsToArray   = vi.fn().mockResolvedValue([])
const mockDbSettingsPut       = vi.fn().mockResolvedValue(undefined)
const mockDbLaborTypesAdd     = vi.fn().mockResolvedValue(1)
const mockDbJobsAdd           = vi.fn().mockResolvedValue(1)
const mockDbEntriesAdd        = vi.fn().mockResolvedValue(1)

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { allowConcurrentTimers: false, weekStartsMonday: true, theme: 'auto', accentColor: '#F59E0B' },
    updateSetting: mockUpdateSetting,
  }),
}))

vi.mock('../db', () => ({
  db: {
    jobs: {
      get toArray() { return mockDbJobsToArray },
      get clear()   { return mockDbJobsClear },
      get add()     { return mockDbJobsAdd },
    },
    entries: {
      get toArray() { return mockDbEntriesToArray },
      get clear()   { return mockDbEntriesClear },
      get add()     { return mockDbEntriesAdd },
    },
    laborTypes: {
      get toArray() { return mockDbLaborTypesToArray },
      get clear()   { return mockDbLaborTypesClear },
      get add()     { return mockDbLaborTypesAdd },
    },
    settings: {
      get toArray() { return mockDbSettingsToArray },
      get clear()   { return mockDbSettingsClear },
      get bulkPut() { return mockDbSettingsBulkPut },
      get put()     { return mockDbSettingsPut },
    },
    transaction: (_mode, _tables, fn) => fn(),
  },
}))

vi.mock('../components/ColorPicker', () => ({
  default: ({ value, onChange, label }) => (
    <button data-testid="color-picker" aria-label={label} onClick={() => onChange('#FF0000')}>{value}</button>
  ),
}))

vi.mock('../components/ChangelogModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="changelog-modal"><button onClick={onClose}>close-changelog</button></div>
  ),
}))

const mockRunSync = vi.fn().mockResolvedValue(Date.now())
const mockDisconnectSync = vi.fn().mockResolvedValue(undefined)

vi.mock('../sync/syncManager', () => ({
  runSync: (...args) => mockRunSync(...args),
  disconnectSync: (...args) => mockDisconnectSync(...args),
}))

vi.mock('../sync/config', () => ({
  SYNC_CONFIG: {
    github:   { clientId: 'gh-test-id', callbackBase: 'https://example.com' },
    google:   { clientId: 'google-test-id' },
    onedrive: { clientId: 'od-test-id' },
  },
}))

vi.mock('../sync/providers/github', () => ({
  buildGitHubOAuthUrl: () => 'https://github.com/oauth',
}))
vi.mock('../sync/providers/google', () => ({
  buildGoogleOAuthUrl: () => 'https://accounts.google.com/oauth',
}))
vi.mock('../sync/providers/onedrive', () => ({
  buildOneDriveOAuthUrl: () => 'https://login.microsoftonline.com/oauth',
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  global.URL.revokeObjectURL = vi.fn()
  global.alert = vi.fn()
})

describe('SettingsView — section rendering', () => {
  it('renders General, Appearance, Data, Sync, and About section headers', () => {
    render(<SettingsView />)
    expect(screen.getByRole('button', { name: /^general$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^appearance$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^data$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sync$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^about$/i })).toBeInTheDocument()
  })

  it('sections are collapsed by default (single-open accordion)', () => {
    render(<SettingsView />)
    // Content from collapsed sections is not rendered until expanded.
    expect(screen.queryByRole('switch', { name: /allow concurrent timers/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Clear time entries')).not.toBeInTheDocument()
  })

  it('opening one section closes the previously open one', () => {
    render(<SettingsView />)
    expand('General')
    expect(screen.getByRole('switch', { name: /allow concurrent timers/i })).toBeInTheDocument()
    expand('Data')
    // General collapsed when Data opened
    expect(screen.queryByRole('switch', { name: /allow concurrent timers/i })).not.toBeInTheDocument()
    expect(screen.getByText('Export data')).toBeInTheDocument()
  })

  it('Danger Zone section is collapsed by default', () => {
    render(<SettingsView />)
    expect(screen.queryByText('Clear time entries')).not.toBeInTheDocument()
  })
})

describe('SettingsView — Toggle', () => {
  it('renders Allow concurrent timers switch with aria-checked=false', () => {
    render(<SettingsView />)
    expand('General')
    const toggle = screen.getByRole('switch', { name: /allow concurrent timers/i })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('calls updateSetting when concurrent timers toggle is clicked', () => {
    render(<SettingsView />)
    expand('General')
    fireEvent.click(screen.getByRole('switch', { name: /allow concurrent timers/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('allowConcurrentTimers', true)
  })

  it('renders Week starts Monday switch with aria-checked=true', () => {
    render(<SettingsView />)
    expand('General')
    expect(screen.getByRole('switch', { name: /week starts monday/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls updateSetting when week start toggle is clicked', () => {
    render(<SettingsView />)
    expand('General')
    fireEvent.click(screen.getByRole('switch', { name: /week starts monday/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('weekStartsMonday', false)
  })
})

describe('SettingsView — Theme', () => {
  it('renders Auto, Light, and Dark theme buttons', () => {
    render(<SettingsView />)
    expand('Appearance')
    expect(screen.getByRole('button', { name: /^auto$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^light$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument()
  })

  it('calls updateSetting("theme", "dark") when Dark is clicked', () => {
    render(<SettingsView />)
    expand('Appearance')
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'dark')
  })

  it('calls updateSetting("theme", "light") when Light is clicked', () => {
    render(<SettingsView />)
    expand('Appearance')
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'light')
  })

  it('calls updateSetting("theme", "auto") when Auto is clicked', () => {
    render(<SettingsView />)
    expand('Appearance')
    fireEvent.click(screen.getByRole('button', { name: /^auto$/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'auto')
  })
})

describe('SettingsView — Accent color', () => {
  it('renders the ColorPicker', () => {
    render(<SettingsView />)
    expand('Appearance')
    expect(screen.getByTestId('color-picker')).toBeInTheDocument()
  })

  it('calls updateSetting("accentColor", ...) when color changes', () => {
    render(<SettingsView />)
    expand('Appearance')
    fireEvent.click(screen.getByTestId('color-picker'))
    expect(mockUpdateSetting).toHaveBeenCalledWith('accentColor', '#FF0000')
  })
})

describe('SettingsView — Data export', () => {
  it('calls db.jobs.toArray when Export data is clicked', async () => {
    render(<SettingsView />)
    expand('Data')
    fireEvent.click(screen.getByText('Export data'))
    await waitFor(() => expect(mockDbJobsToArray).toHaveBeenCalled())
  })

  it('calls URL.createObjectURL when Export data is clicked', async () => {
    render(<SettingsView />)
    expand('Data')
    fireEvent.click(screen.getByText('Export data'))
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
  })

  it('calls db.entries.toArray when Export CSV is clicked', async () => {
    render(<SettingsView />)
    expand('Data')
    fireEvent.click(screen.getByText('Export CSV'))
    await waitFor(() => expect(mockDbEntriesToArray).toHaveBeenCalled())
  })

  it('calls URL.createObjectURL when Export CSV is clicked', async () => {
    render(<SettingsView />)
    expand('Data')
    fireEvent.click(screen.getByText('Export CSV'))
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
  })
})

describe('SettingsView — Data import', () => {
  it('triggers the hidden file input when Import data is clicked', () => {
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByText('Import data'))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('shows alert for invalid JSON', async () => {
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const file = new File(['not json'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Error importing data'))
    )
  })

  it('shows alert for invalid backup file structure', async () => {
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const file = new File([JSON.stringify({ version: 1 })], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith('Invalid backup file structure.')
    )
  })

  it('shows success alert and adds job for a valid backup', async () => {
    const backup = JSON.stringify({
      version: 1,
      jobs: [{ id: 1, name: 'Imported Job', isActive: true }],
      entries: [],
      laborTypes: [],
    })
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const file = new File([backup], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Import successful'))
    )
    expect(mockDbJobsAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Imported Job' })
    )
  })
})

describe('SettingsView — Danger Zone', () => {
  it('expands when the Danger Zone header is clicked', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    expect(screen.getByText('Clear time entries')).toBeInTheDocument()
  })

  it('shows ConfirmModal when Clear time entries is clicked', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Clear time entries'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Clear all time entries?')).toBeInTheDocument()
  })

  it('calls db.entries.clear() when ConfirmModal is confirmed', async () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Clear time entries'))
    fireEvent.click(screen.getByRole('button', { name: /clear entries/i }))
    await waitFor(() => expect(mockDbEntriesClear).toHaveBeenCalled())
  })

  it('closes ConfirmModal when Cancel is clicked', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Clear time entries'))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows Factory Reset button when Danger Zone is expanded', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    expect(screen.getByText('Factory Reset')).toBeInTheDocument()
  })

  it('advances to warn stage when Factory Reset is clicked', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    expect(screen.getByText('Reset to factory defaults?')).toBeInTheDocument()
  })

  it('advances to final stage when Continue is clicked in warn stage', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByText('There is no going back.')).toBeInTheDocument()
  })

  it('returns to null stage when Cancel is clicked in warn stage', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText('Reset to factory defaults?')).not.toBeInTheDocument()
    expect(screen.getByText('Factory Reset')).toBeInTheDocument()
  })

  it('calls all db.clear methods when "Yes, wipe everything" is confirmed', async () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, wipe everything/i }))
    await waitFor(() => {
      expect(mockDbEntriesClear).toHaveBeenCalled()
      expect(mockDbJobsClear).toHaveBeenCalled()
      expect(mockDbLaborTypesClear).toHaveBeenCalled()
      expect(mockDbSettingsClear).toHaveBeenCalled()
      expect(mockDbSettingsBulkPut).toHaveBeenCalled()
    })
  })

  it('re-seeds the default blue accent (#1f6feb), not amber, after factory reset (#69)', async () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, wipe everything/i }))
    await waitFor(() => expect(mockDbSettingsBulkPut).toHaveBeenCalled())
    const seeded = mockDbSettingsBulkPut.mock.calls.at(-1)[0]
    const accent = seeded.find(s => s.key === 'accentColor')
    expect(accent.value).toBe('#1f6feb')
  })

  it('returns to null stage after factory reset completes', async () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, wipe everything/i }))
    await waitFor(() => expect(mockDbSettingsBulkPut).toHaveBeenCalled())
    expect(screen.queryByText('Yes, wipe everything')).not.toBeInTheDocument()
    expect(screen.getByText('Factory Reset')).toBeInTheDocument()
  })
})

describe('SettingsView — About', () => {
  it('renders version info', () => {
    render(<SettingsView />)
    expand('About')
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument()
  })

  it('renders Changelog button', () => {
    render(<SettingsView />)
    expand('About')
    expect(screen.getByText('Changelog')).toBeInTheDocument()
  })

  it('opens ChangelogModal when Changelog is clicked', () => {
    render(<SettingsView />)
    expand('About')
    fireEvent.click(screen.getByText('Changelog'))
    expect(screen.getByTestId('changelog-modal')).toBeInTheDocument()
  })

  it('closes ChangelogModal when it requests close', () => {
    render(<SettingsView />)
    expand('About')
    fireEvent.click(screen.getByText('Changelog'))
    fireEvent.click(screen.getByText('close-changelog'))
    expect(screen.queryByTestId('changelog-modal')).not.toBeInTheDocument()
  })

  it('renders Check for updates button', () => {
    render(<SettingsView />)
    expand('About')
    expect(screen.getByText('Check for updates')).toBeInTheDocument()
  })

  it('shows "Already up to date" after clicking Check for updates (no service worker)', async () => {
    render(<SettingsView />)
    expand('About')
    fireEvent.click(screen.getByText('Check for updates'))
    await waitFor(() => expect(screen.getByText('Already up to date')).toBeInTheDocument())
  })
})

// ─── Check for updates: service worker path ───────────────────────────────────

describe('SettingsView — check for updates (service worker)', () => {
  it('shows "Already up to date" when serviceWorker registration is null', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue(null) },
      configurable: true,
    })
    render(<SettingsView />)
    expand('About')
    fireEvent.click(screen.getByText('Check for updates'))
    await waitFor(() => expect(screen.getByText('Already up to date')).toBeInTheDocument())
    // restore: remove the mock so other tests see no serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  })

  it('surfaces "Update available" on mount when a worker is already waiting (issue #57)', async () => {
    // Simulates an update that downloaded in a previous page load: the in-memory
    // flag is gone after a reload/factory reset, but reg.waiting still holds it.
    window.__pwaUpdateAvailable = false
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ waiting: {} }) },
      configurable: true,
    })
    render(<SettingsView />)
    expand('About')
    await waitFor(() => expect(screen.getByText('Update available')).toBeInTheDocument())
    const button = screen.getByText('Update available').closest('button')
    expect(button).not.toBeDisabled()

    // cleanup
    window.__pwaUpdateAvailable = false
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  })

  it('re-enables the button when an update is found during the check (issue #57)', async () => {
    // reg.update() simulates the browser discovering a new SW: it sets the
    // global and dispatches the event the same way main.jsx's onNeedRefresh does.
    const update = vi.fn().mockImplementation(async () => {
      window.__pwaUpdateAvailable = true
      window.dispatchEvent(new Event('pwa:update-ready'))
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ update }) },
      configurable: true,
    })
    render(<SettingsView />)
    expand('About')
    fireEvent.click(screen.getByText('Check for updates'))

    // Once the update is found the button must reflect "Update available"...
    await waitFor(() => expect(screen.getByText('Update available')).toBeInTheDocument())
    // ...and after the post-check settle must NOT remain stuck disabled
    // (the bug: updateStatus stayed 'checking' forever, greying the button out).
    const button = screen.getByText('Update available').closest('button')
    await waitFor(() => expect(button).not.toBeDisabled(), { timeout: 4000 })

    // cleanup
    window.__pwaUpdateAvailable = false
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
  })
})

// ─── Data import: edge cases ──────────────────────────────────────────────────

describe('SettingsView — Data import: edge cases', () => {
  it('does not call db.laborTypes.add when labor type name matches an existing one', async () => {
    // Existing DB already has a labor type named 'Design' — backup has same name → matched, no add
    mockDbLaborTypesToArray.mockResolvedValue([{ id: 1, name: 'Design', color: '#6366F1' }])
    const backup = JSON.stringify({
      version: 1,
      jobs: [],
      entries: [],
      laborTypes: [{ id: 5, name: 'Design', color: '#6366F1' }],
    })
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const file = new File([backup], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Import successful'))
    )
    expect(mockDbLaborTypesAdd).not.toHaveBeenCalled()
  })

  it('imports an entry when its job matches an existing job by name', async () => {
    // Existing DB has 'Acme Corp'; backup has same job name and an entry for it
    mockDbJobsToArray.mockResolvedValue([{ id: 1, name: 'Acme Corp', isActive: true }])
    mockDbLaborTypesToArray.mockResolvedValue([])
    mockDbEntriesToArray.mockResolvedValue([])
    const backup = JSON.stringify({
      version: 1,
      jobs: [{ id: 1, name: 'Acme Corp', isActive: true }],
      entries: [
        {
          jobId: 1,
          laborTypeId: null,
          punchIn: '2025-06-01T09:00:00.000Z',
          punchOut: '2025-06-01T10:00:00.000Z',
        },
      ],
      laborTypes: [],
    })
    render(<SettingsView />)
    expand('Data')
    const input = document.querySelector('input[type="file"]')
    const file = new File([backup], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() =>
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('1 new time entries'))
    )
    expect(mockDbEntriesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 1 })
    )
  })
})

// ─── Danger Zone: cancel at final stage ──────────────────────────────────────

describe('SettingsView — Danger Zone: cancel at final stage', () => {
  it('returns to Factory Reset button when Cancel is clicked in the final stage', () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByText(/danger zone/i))
    fireEvent.click(screen.getByText('Factory Reset'))
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    // Confirm we are now in the final stage
    expect(screen.getByText('There is no going back.')).toBeInTheDocument()
    // Click the Cancel button in the final stage
    const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i })
    fireEvent.click(cancelButtons[cancelButtons.length - 1])
    // Final stage content is gone; top-level Factory Reset button is restored
    expect(screen.queryByText('There is no going back.')).not.toBeInTheDocument()
    expect(screen.getByText('Factory Reset')).toBeInTheDocument()
  })
})

describe('SettingsView — Sync section', () => {
  it('renders Sync section header', () => {
    render(<SettingsView />)
    expect(screen.getByRole('button', { name: /^sync$/i })).toBeInTheDocument()
  })

  it('shows disconnected state with provider buttons when client IDs are configured', () => {
    render(<SettingsView />)
    expand('Sync')
    expect(screen.getByText('Sync across devices')).toBeInTheDocument()
    expect(screen.getByText('GitHub Gist')).toBeInTheDocument()
    expect(screen.getByText('Google Drive')).toBeInTheDocument()
    expect(screen.getByText('OneDrive')).toBeInTheDocument()
  })

  it('shows connected state for GitHub when syncProvider is github', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    expect(await screen.findByRole('button', { name: /Sync Now/i })).toBeInTheDocument()
    expect(screen.getByText('GitHub Gist')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument()
  })

  it('shows a clear "Connected" indicator when a provider is connected (issue #76)', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('shows connected state for Google Drive', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'google' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    // Wait on a connected-only sentinel so the async live-query settle is
    // observed before asserting the provider label (which also appears as a
    // connect button in the disconnected state).
    await screen.findByRole('button', { name: /Sync Now/i })
    expect(screen.getByText('Google Drive')).toBeInTheDocument()
    expect(screen.getByText(/Never synced/)).toBeInTheDocument()
  })

  it('shows connected state for OneDrive', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'onedrive' },
      { key: 'lastSyncedAt', value: Date.now() - 30000 },
    ])
    render(<SettingsView />)
    expand('Sync')
    await screen.findByRole('button', { name: /Sync Now/i })
    expect(screen.getByText('OneDrive')).toBeInTheDocument()
    expect(screen.getByText(/Just now/)).toBeInTheDocument()
  })

  it('shows "Token expired" and disables Sync Now when token is expired', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'google' },
      { key: 'syncTokenExpiry', value: Date.now() - 1000 },
    ])
    render(<SettingsView />)
    expand('Sync')
    expect(await screen.findByText(/Token expired/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sync Now/i })).toBeDisabled()
  })

  it('shows sync error when present', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'syncError', value: 'GitHub 401' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    expect(await screen.findByText('GitHub 401')).toBeInTheDocument()
  })

  it('calls runSync when Sync Now is clicked', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    fireEvent.click(await screen.findByRole('button', { name: /Sync Now/i }))
    await waitFor(() => expect(mockRunSync).toHaveBeenCalled())
  })

  it('calls disconnectSync when Disconnect is confirmed in the modal (issue #76)', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/i }))
    // A confirmation dialog appears (replaces the old window.confirm)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Disconnect sync?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /^Disconnect$/i }))
    await waitFor(() => expect(mockDisconnectSync).toHaveBeenCalled())
  })

  it('does not call disconnectSync when the confirmation is cancelled (issue #76)', async () => {
    mockDbSettingsToArray.mockResolvedValue([
      { key: 'syncProvider', value: 'github' },
      { key: 'lastSyncedAt', value: null },
    ])
    render(<SettingsView />)
    expand('Sync')
    fireEvent.click(await screen.findByRole('button', { name: /Disconnect/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }))
    expect(mockDisconnectSync).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
