import { render, screen, fireEvent } from '@testing-library/react'
import SettingsView from './SettingsView'

// The "Haptic feedback" toggle (issue #65) only makes sense where the device
// can actually vibrate, so it is shown on phones (os ios/android) and hidden
// on the web/desktop. These tests drive the platform mock to exercise both.

const mockUpdateSetting = vi.fn()
let mockOs = 'android'
let mockIsIPad = false

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { theme: 'auto', accentColor: '#1f6feb', hapticFeedback: true },
    updateSetting: mockUpdateSetting,
  }),
}))

vi.mock('../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ isStandalone: true, os: mockOs, isIPad: mockIsIPad }),
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
  SYNC_CONFIG: { github: { clientId: '', callbackBase: '' }, google: { clientId: '' }, onedrive: { clientId: '' } },
}))
vi.mock('../sync/providers/github',   () => ({ buildGitHubOAuthUrl:   () => '' }))
vi.mock('../sync/providers/google',   () => ({ buildGoogleOAuthUrl:   () => '' }))
vi.mock('../sync/providers/onedrive', () => ({ buildOneDriveOAuthUrl: () => '' }))

beforeEach(() => {
  vi.clearAllMocks()
  mockOs = 'android'
  mockIsIPad = false
})

// Haptic feedback now lives inside the collapsible "General" group (issue #60),
// so expand it before asserting the toggle's presence/absence.
const expandGeneral = () =>
  fireEvent.click(screen.getByRole('button', { name: /^general$/i }))

describe('SettingsView — haptic feedback toggle (#65)', () => {
  it('shows the Haptic feedback toggle on a phone', () => {
    render(<SettingsView />)
    expandGeneral()
    expect(screen.getByText('Haptic feedback')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Haptic feedback/i })).toBeInTheDocument()
  })

  it('toggles the hapticFeedback setting when tapped', () => {
    render(<SettingsView />)
    expandGeneral()
    fireEvent.click(screen.getByRole('switch', { name: /Haptic feedback/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('hapticFeedback', false)
  })

  it('shows the toggle on an iPhone', () => {
    mockOs = 'ios'
    mockIsIPad = false
    render(<SettingsView />)
    expandGeneral()
    expect(screen.getByText('Haptic feedback')).toBeInTheDocument()
  })

  it('hides the toggle on an iPad (no vibration motor)', () => {
    mockOs = 'ios'
    mockIsIPad = true
    render(<SettingsView />)
    expandGeneral()
    expect(screen.queryByText('Haptic feedback')).not.toBeInTheDocument()
  })

  it('hides the toggle on the web (no device haptics)', () => {
    mockOs = 'web'
    render(<SettingsView />)
    expandGeneral()
    expect(screen.queryByText('Haptic feedback')).not.toBeInTheDocument()
  })
})
