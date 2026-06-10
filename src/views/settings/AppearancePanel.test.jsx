import { render, screen, within } from '@testing-library/react'
import AppearancePanel from './AppearancePanel'

// Focused test for the Appearance panel's theme segmented control. Rendered
// directly (not through the full SettingsView graph).

const h = vi.hoisted(() => ({ settings: {}, updateSetting: vi.fn() }))
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: h.settings, updateSetting: h.updateSetting }),
}))
// ColorPicker pulls in react-colorful; the accent picker is out of scope here.
vi.mock('../../components/ColorPicker', () => ({
  default: () => <div data-testid="color-picker" />,
}))

beforeEach(() => { h.updateSetting.mockClear(); h.settings = {} })

describe('AppearancePanel — theme segmented control', () => {
  it('wraps the theme buttons in a group labelled "Theme"', () => {
    render(<AppearancePanel onBack={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
  })

  it('marks exactly the active theme with aria-pressed=true (defaults to Auto)', () => {
    render(<AppearancePanel onBack={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Theme' })
    const pressed = within(group).getAllByRole('button').filter(
      b => b.getAttribute('aria-pressed') === 'true'
    )
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAttribute('aria-pressed', 'true')
    expect(pressed[0]).toHaveTextContent('Auto')
  })

  it('moves aria-pressed=true to the explicitly selected theme', () => {
    h.settings = { theme: 'dark' }
    render(<AppearancePanel onBack={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Theme' })
    const pressed = within(group).getAllByRole('button').filter(
      b => b.getAttribute('aria-pressed') === 'true'
    )
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('Dark')
    expect(screen.getByRole('button', { name: /auto/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
