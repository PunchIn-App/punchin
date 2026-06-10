import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import SettingsView from './SettingsView'

// Reminders settings section (issue #54). The Notification API is wrapped by
// src/utils/notifications; mock it so we can drive support/permission states.
const n = vi.hoisted(() => ({ supported: true, perm: 'default' }))
const mockRequest = vi.fn()

vi.mock('../utils/notifications', () => ({
  notificationsSupported: () => n.supported,
  notificationPermission: () => n.perm,
  requestNotificationPermission: (...a) => mockRequest(...a),
}))

const mockUpdateSetting = vi.fn()
let mockSettings = {}

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting }),
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

vi.mock('../components/ColorPicker', () => ({ default: () => <div data-testid="color-picker" /> }))
vi.mock('../components/ChangelogModal', () => ({ default: () => <div data-testid="changelog-modal" /> }))
vi.mock('../sync/syncManager', () => ({ runSync: vi.fn(), disconnectSync: vi.fn() }))
vi.mock('../sync/config', () => ({
  SYNC_CONFIG: { github: { clientId: '' }, google: { clientId: '' }, onedrive: { clientId: '' } },
}))
vi.mock('../sync/providers/github',   () => ({ buildGitHubOAuthUrl:   () => '' }))
vi.mock('../sync/providers/google',   () => ({ buildGoogleOAuthUrl:   () => '' }))
vi.mock('../sync/providers/onedrive', () => ({ buildOneDriveOAuthUrl: () => '' }))

// Reminders now lives in its own drill-in page (issue #60); open it first.
const expandReminders = () =>
  fireEvent.click(screen.getByRole('button', { name: /^reminders/i }))

beforeEach(() => {
  vi.clearAllMocks()
  n.supported = true
  n.perm = 'default'
  mockSettings = {}
})

describe('SettingsView — Reminders section (#54)', () => {
  it('shows an unavailable message when notifications are not supported', () => {
    n.supported = false
    render(<SettingsView />)
    expandReminders()
    expect(screen.getByText(/Reminders aren't available here/i)).toBeInTheDocument()
  })

  it('shows the master Reminders toggle when supported', () => {
    render(<SettingsView />)
    expandReminders()
    expect(screen.getByRole('switch', { name: /enable reminders/i })).toBeInTheDocument()
  })

  it('requests permission and enables the setting when the master toggle is turned on (granted)', async () => {
    mockRequest.mockResolvedValue('granted')
    render(<SettingsView />)
    expandReminders()
    fireEvent.click(screen.getByRole('switch', { name: /enable reminders/i }))
    await waitFor(() => expect(mockRequest).toHaveBeenCalled())
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindersEnabled', true)
  })

  it('does not enable the setting when permission is denied', async () => {
    mockRequest.mockResolvedValue('denied')
    render(<SettingsView />)
    expandReminders()
    fireEvent.click(screen.getByRole('switch', { name: /enable reminders/i }))
    await waitFor(() => expect(mockRequest).toHaveBeenCalled())
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindersEnabled', false)
    await waitFor(() => expect(screen.getByText(/Notifications are blocked/i)).toBeInTheDocument())
  })

  it('reveals the per-reminder options when enabled and granted', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: true, remindLongRunningMinutes: 60 }
    render(<SettingsView />)
    expandReminders()
    expect(screen.getByText('Long-running timer')).toBeInTheDocument()
    expect(screen.getByText('No timer running')).toBeInTheDocument()
    expect(screen.getByText('Timer still running')).toBeInTheDocument()
    expect(screen.getByText('Daily timesheet')).toBeInTheDocument()
    expect(screen.getByText('Weekly timesheet')).toBeInTheDocument()
  })

  it('updates the long-running threshold from the duration wheel (#111)', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: true, remindLongRunningMinutes: 60 }
    render(<SettingsView />)
    expandReminders()
    fireEvent.click(screen.getByRole('button', { name: /long-running threshold/i })) // open the duration popover
    // 60 min = 1h 0m; ArrowDown on the minutes wheel steps +5 → 1h 05 = 65.
    fireEvent.keyDown(screen.getByLabelText(/minutes before a long-running timer reminder/i), { key: 'ArrowDown' })
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindLongRunningMinutes', 65)
    // ArrowDown on the hours wheel steps +1 hour (minutes still 0 from the static mock) => 120.
    fireEvent.keyDown(screen.getByLabelText(/hours before a long-running timer reminder/i), { key: 'ArrowDown' })
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindLongRunningMinutes', 120)
  })

  it('toggles an individual reminder off', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: true }
    render(<SettingsView />)
    expandReminders()
    fireEvent.click(screen.getByRole('switch', { name: /long-running timer/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindLongRunning', false)
  })

  it('shows a weekday picker for an enabled time-of-day reminder', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00', remindIdleDays: [0, 1, 2, 3, 4, 5, 6] }
    render(<SettingsView />)
    expandReminders()
    expect(screen.getByRole('group', { name: /days for the no-timer reminder/i })).toBeInTheDocument()
  })

  it('toggles a weekday off, writing the remaining days to settings', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00', remindIdleDays: [0, 1, 2, 3, 4, 5, 6] }
    render(<SettingsView />)
    expandReminders()
    const group = screen.getByRole('group', { name: /days for the no-timer reminder/i })
    // Sunday is weekday 0 — removing it leaves Mon–Sat.
    fireEvent.click(within(group).getByRole('button', { name: /^sunday$/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindIdleDays', [1, 2, 3, 4, 5, 6])
  })

  it('turns the reminder off (and restores all days) when the last day is cleared', () => {
    n.perm = 'granted'
    mockSettings = { remindersEnabled: true, remindLongRunning: false, remindIdle: true, remindIdleTime: '09:00', remindIdleDays: [0] }
    render(<SettingsView />)
    expandReminders()
    const group = screen.getByRole('group', { name: /days for the no-timer reminder/i })
    fireEvent.click(within(group).getByRole('button', { name: /^sunday$/i })) // removes the only remaining day
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindIdle', false)
    expect(mockUpdateSetting).toHaveBeenCalledWith('remindIdleDays', [0, 1, 2, 3, 4, 5, 6])
  })
})
