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

  it('sets the rounding increment from the select', () => {
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.change(screen.getByRole('combobox', { name: /round billed time/i }), { target: { value: '15' } })
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMinutes', 15)
  })

  it('shows the current rounding selection', () => {
    mockSettings = { roundingMinutes: 30 }
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('combobox', { name: /round billed time/i })).toHaveValue('30')
  })

  it('defaults the rounding select to Off when unset', () => {
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('combobox', { name: /round billed time/i })).toHaveValue('0')
  })
})
