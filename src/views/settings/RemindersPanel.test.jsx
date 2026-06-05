import { render, screen } from '@testing-library/react'
import RemindersPanel from './RemindersPanel'

// Focused test for the Reminders panel's honest local-delivery messaging
// (issue #112). Renders the panel directly — deliberately NOT through the full
// SettingsView graph (recharts + sync providers), which is too heavy for one
// local test worker.

const mockUpdateSetting = vi.fn()
let mockSettings = {}
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting }),
}))

const notif = vi.hoisted(() => ({ supported: true }))
vi.mock('../../utils/notifications', () => ({
  notificationsSupported: () => notif.supported,
  requestNotificationPermission: vi.fn(),
}))

const renderPanel = (notifPerm = 'granted') =>
  render(<RemindersPanel onBack={() => {}} notifPerm={notifPerm} setNotifPerm={() => {}} />)

beforeEach(() => {
  vi.clearAllMocks()
  notif.supported = true
  mockSettings = {}
})

describe('RemindersPanel — local-only delivery messaging (#112)', () => {
  it('explains reminders are local and a fully closed app cannot alert at an exact time', () => {
    mockSettings = { remindersEnabled: true }
    renderPanel('granted')
    expect(screen.getByText(/no server/i)).toBeInTheDocument()
    expect(screen.getByText(/fully closed app/i)).toBeInTheDocument()
  })

  it('no longer implies an installed-but-closed app keeps alerting', () => {
    mockSettings = {}
    renderPanel('default')
    // The old subtitle ("open or installed") set the wrong expectation that led
    // to the bug report; it must be gone.
    expect(screen.queryByText(/open or installed/i)).not.toBeInTheDocument()
  })

  it('hides the explanation until reminders are actually enabled', () => {
    mockSettings = { remindersEnabled: false }
    renderPanel('default')
    expect(screen.queryByText(/no server/i)).not.toBeInTheDocument()
  })
})
