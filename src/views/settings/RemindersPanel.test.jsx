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

describe('RemindersPanel — blocked-permission live region (WCAG 4.1.3)', () => {
  it('announces the blocked message via a polite status region when permission is denied', () => {
    mockSettings = {}
    renderPanel('denied')
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/notifications are blocked/i)
  })

  it('keeps the persistent region OUTSIDE the divided row list (no stray divider when empty)', () => {
    // The region is always mounted (for reliable announcement) but must not sit
    // inside the divide-y container, or an empty (not-denied) region adds an
    // extra divider hairline between the rows.
    mockSettings = { remindersEnabled: true }
    renderPanel('granted')
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()              // persistent even when not denied
    expect(status.closest('.divide-y')).toBeNull()  // and outside the divided list
  })
})
