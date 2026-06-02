import { render, screen } from '@testing-library/react'
import App from './App'

const mockUseSettings = vi.fn()

vi.mock('./hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}))
vi.mock('./components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}))
vi.mock('./components/ErrorBoundary', () => ({
  default: ({ children }) => <>{children}</>,
}))
vi.mock('./views/TimerView',      () => ({ default: () => <div>TimerView</div>      }))
vi.mock('./views/JobsView',       () => ({ default: () => <div>JobsView</div>       }))
vi.mock('./views/TimesheetsView', () => ({ default: () => <div>TimesheetsView</div> }))
vi.mock('./views/AnalyticsView',  () => ({ default: () => <div>AnalyticsView</div>  }))
vi.mock('./views/SettingsView',   () => ({ default: () => <div>SettingsView</div>   }))

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.classList.remove('light')
  document.documentElement.style.removeProperty('--accent-rgb')
  mockUseSettings.mockReturnValue({
    settings: { theme: 'dark', accentColor: '#F59E0B' },
    updateSetting: vi.fn(),
  })
})

describe('App — accent color CSS variable', () => {
  it('sets --accent-rgb on the root element from accentColor', () => {
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('245 158 11')
  })

  it('converts a custom hex accent color to space-separated RGB', () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: 'dark', accentColor: '#FF0000' },
      updateSetting: vi.fn(),
    })
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('255 0 0')
  })

  it('falls back to #1f6feb when accentColor is missing', () => {
    mockUseSettings.mockReturnValue({ settings: {}, updateSetting: vi.fn() })
    render(<App />)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('31 111 235')
  })
})

describe('App — theme class', () => {
  it('does not add "light" class when theme is dark', () => {
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('adds "light" class to documentElement when theme is light', () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: 'light', accentColor: '#F59E0B' },
      updateSetting: vi.fn(),
    })
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('removes "light" class when switching back to dark theme', () => {
    document.documentElement.classList.add('light')
    render(<App />)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})

describe('App — default view', () => {
  it('renders the Timer view by default', () => {
    render(<App />)
    expect(screen.getByText('TimerView')).toBeInTheDocument()
  })
})
