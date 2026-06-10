import { render, screen, fireEvent } from '@testing-library/react'
import AboutPanel from './AboutPanel'

// Focused test for the About panel's update-check status line (WCAG 4.1.3).
// PWA update state is owned by SettingsView and passed in as props (issue
// #149), so we drive it directly rather than mocking usePwaUpdate. The two
// hooks the panel does pull in are stubbed; the reading modals are out of scope.
const h = vi.hoisted(() => ({ settings: {} }))
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: h.settings }),
}))
vi.mock('../../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ isStandalone: false, os: 'web' }),
}))
vi.mock('../../components/ChangelogModal', () => ({ default: () => null }))
vi.mock('../../components/LicenseModal', () => ({ default: () => null }))

beforeEach(() => { h.settings = {} })

describe('AboutPanel — update-check status live region (WCAG 4.1.3)', () => {
  it('renders the status line as a persistent polite live region', () => {
    render(<AboutPanel onBack={vi.fn()} updateAvailable={false} updateStatus={null} checkForUpdates={vi.fn()} />)
    const status = screen.getByText('Tap to check for a new version')
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('announces the result in the same live region after a check resolves', () => {
    const { rerender } = render(
      <AboutPanel onBack={vi.fn()} updateAvailable={false} updateStatus="checking" checkForUpdates={vi.fn()} />
    )
    const checking = screen.getByText('Checking…')
    expect(checking).toHaveAttribute('role', 'status')
    expect(checking).toHaveAttribute('aria-live', 'polite')

    rerender(<AboutPanel onBack={vi.fn()} updateAvailable={false} updateStatus="latest" checkForUpdates={vi.fn()} />)
    const latest = screen.getByText('Already up to date')
    expect(latest).toHaveAttribute('role', 'status')
    expect(latest).toHaveAttribute('aria-live', 'polite')
  })

  it('fires checkForUpdates when the row is tapped', () => {
    const checkForUpdates = vi.fn()
    render(<AboutPanel onBack={vi.fn()} updateAvailable={false} updateStatus={null} checkForUpdates={checkForUpdates} />)
    fireEvent.click(screen.getByRole('button', { name: /check for updates/i }))
    expect(checkForUpdates).toHaveBeenCalled()
  })
})
