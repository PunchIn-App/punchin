import { render, screen, fireEvent } from '@testing-library/react'
import GeneralPanel from './GeneralPanel'

// Focused test for the General panel's time-display & billing controls (issue
// #208). Rendered directly (not through the full SettingsView graph).

const mockUpdateSetting = vi.fn()
let mockSettings = {}
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting }),
}))
vi.mock('../../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ os: 'web', isIPad: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSettings = {}
})

describe('GeneralPanel — time display & billing (#208)', () => {
  it('toggles decimal hours on', () => {
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.click(screen.getByRole('switch', { name: /decimal hours/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('decimalHours', true)
  })

  it('reflects decimalHours already on', () => {
    mockSettings = { decimalHours: true }
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('switch', { name: /decimal hours/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('sets the rounding increment from the dropdown', () => {
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /round billed time/i }))
    fireEvent.click(screen.getByRole('option', { name: '¼ hour' }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMinutes', 15)
  })

  it('shows the current rounding selection', () => {
    mockSettings = { roundingMinutes: 30 }
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /round billed time/i })).toHaveTextContent('½ hour')
  })

  it('defaults the rounding dropdown to Off when unset', () => {
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /round billed time/i })).toHaveTextContent('Off')
  })
})
