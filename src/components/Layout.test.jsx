import { render, screen, fireEvent, within } from '@testing-library/react'
import Layout from './Layout'

vi.mock('../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ isStandalone: false, os: 'web' }),
}))

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { hapticFeedback: true }, updateSetting: vi.fn() }),
}))

describe('Layout — structure', () => {
  it('renders the PunchIn logo header button', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    expect(screen.getByRole('button', { name: /punchin — go to timer/i })).toBeInTheDocument()
  })

  it('renders children in the main content area', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div>hello world</div></Layout>)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders the main navigation landmark', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})

describe('Layout — nav items', () => {
  it('renders all 5 nav labels', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    ;['Timer', 'Jobs', 'Timesheets', 'Analytics', 'Settings'].forEach(label => {
      expect(within(nav).getByText(label)).toBeInTheDocument()
    })
  })

  it('marks the active view with aria-current="page"', () => {
    render(<Layout activeView="jobs" onNavigate={vi.fn()}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    const navButtons = within(nav).getAllByRole('button')
    const active = navButtons.find(b => b.getAttribute('aria-current') === 'page')
    expect(active).toBeDefined()
    expect(active.textContent).toContain('Jobs')
  })

  it('does not set aria-current on inactive nav items', () => {
    render(<Layout activeView="jobs" onNavigate={vi.fn()}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    const navButtons = within(nav).getAllByRole('button')
    const inactive = navButtons.filter(b => b.getAttribute('aria-current') !== 'page')
    expect(inactive).toHaveLength(4)
  })
})

describe('Layout — navigation callbacks', () => {
  it('calls onNavigate("timer") when the logo is clicked', () => {
    const onNavigate = vi.fn()
    render(<Layout activeView="jobs" onNavigate={onNavigate}><div /></Layout>)
    fireEvent.click(screen.getByRole('button', { name: /punchin — go to timer/i }))
    expect(onNavigate).toHaveBeenCalledWith('timer')
  })

  it('calls onNavigate with the correct view id when a nav button is clicked', () => {
    const onNavigate = vi.fn()
    render(<Layout activeView="timer" onNavigate={onNavigate}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    fireEvent.click(within(nav).getByText('Settings').closest('button'))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })
})
