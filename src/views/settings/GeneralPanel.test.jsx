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

  // The dropdown's accessible name is "Round billed time, <selection>"; the
  // leading comma distinguishes it from the row's "About Round billed time" ⓘ
  // disclosure button. One control encodes both the increment and the mode, so
  // picking a "Nearest"/"Round up" option writes roundingMinutes AND roundingMode.
  it('sets a nearest rounding increment from the dropdown', () => {
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^round billed time,/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Nearest ¼ hour' }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMinutes', 15)
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMode', 'nearest')
  })

  it('sets a round-up increment from the dropdown', () => {
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^round billed time,/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Round up ½ hour' }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMinutes', 30)
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMode', 'up')
  })

  it('turning rounding off only clears the increment', () => {
    mockSettings = { roundingMinutes: 15, roundingMode: 'up' }
    render(<GeneralPanel onBack={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^round billed time,/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Off' }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('roundingMinutes', 0)
    expect(mockUpdateSetting).not.toHaveBeenCalledWith('roundingMode', expect.anything())
  })

  it('shows the current rounding selection', () => {
    mockSettings = { roundingMinutes: 30, roundingMode: 'nearest' }
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /^round billed time,/i })).toHaveTextContent('Nearest ½ hour')
  })

  it('defaults the rounding dropdown to Off when unset', () => {
    render(<GeneralPanel onBack={() => {}} />)
    expect(screen.getByRole('button', { name: /^round billed time,/i })).toHaveTextContent('Off')
  })
})
