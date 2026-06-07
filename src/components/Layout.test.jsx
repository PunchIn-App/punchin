import { render, screen, fireEvent, within } from '@testing-library/react'
import Layout from './Layout'

vi.mock('../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ isStandalone: false, os: 'web' }),
}))

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { hapticFeedback: true }, updateSetting: vi.fn() }),
}))

// The sidebar shows a live "On the clock" status from the running entries; mock
// the query to return that array (and stub db, whose access is short-circuited
// by the mocked useLiveQuery).
const live = vi.hoisted(() => ({ activeEntries: [] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => live.activeEntries }))
vi.mock('../db', () => ({ db: {} }))

beforeEach(() => { live.activeEntries = [] })

// The phone header (banner) and the desktop sidebar (complementary) both carry a
// "go to Timer" logo + nav; jsdom doesn't apply Tailwind's responsive `hidden`,
// so both are in the tree. Scope brand/nav queries to their landmark.
describe('Layout — structure', () => {
  it('renders the PunchIn logo header button', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /punchin — go to timer/i })).toBeInTheDocument()
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
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /punchin — go to timer/i }))
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

describe('Layout — desktop sidebar', () => {
  it('renders a Primary navigation landmark with all 5 items', () => {
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    ;['Timer', 'Jobs', 'Timesheets', 'Analytics', 'Settings'].forEach(label => {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    })
  })

  it('routes from a sidebar nav button', () => {
    const onNavigate = vi.fn()
    render(<Layout activeView="timer" onNavigate={onNavigate}><div /></Layout>)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    fireEvent.click(within(nav).getByRole('button', { name: 'Analytics' }))
    expect(onNavigate).toHaveBeenCalledWith('analytics')
  })

  it('shows the privacy-first "On the clock" status + timer count when running', () => {
    live.activeEntries = [{ punchIn: new Date() }, { punchIn: new Date() }]
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    expect(screen.getAllByText(/on the clock/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/2 timers/i)).toBeInTheDocument()
    expect(screen.queryByText(/\bREC\b|recording/i)).toBeNull()
  })

  it('shows "Off the clock" when nothing is running', () => {
    live.activeEntries = []
    render(<Layout activeView="timer" onNavigate={vi.fn()}><div /></Layout>)
    expect(screen.getByText(/off the clock/i)).toBeInTheDocument()
  })
})
