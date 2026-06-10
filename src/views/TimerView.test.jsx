import { render, screen, fireEvent } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimerView from './TimerView'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({ db: {} }))
vi.mock('../components/TimerCard', () => ({
  default: ({ job }) => <div data-testid="timer-card">{job?.name || 'card'}</div>,
}))
vi.mock('../components/StartTimerModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="start-modal">
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}))
// useSettings + TimerRail both call useLiveQuery internally; mock them so the
// 4-call queue below stays aligned with TimerView's own queries. TimerRail has
// its own test.
vi.mock('../hooks/useSettings', () => ({ useSettings: () => ({ settings: {} }) }))
// Capture the props TimerRail receives so we can assert the recent-jobs list.
const mockRailProps = { current: null }
vi.mock('../components/TimerRail', () => ({ default: (props) => { mockRailProps.current = props; return null } }))

const JOBS = [{ id: 1, name: 'Acme Corp' }]
const LABOR_TYPES = [{ id: 1, name: 'Design', color: '#6366F1' }]

// useLiveQuery is called 5 times per render: active, completed, jobs, laborTypes, lastEntry
function setupMocks({ active = [], completed = [], jobs = JOBS, laborTypes = LABOR_TYPES, lastEntry = null } = {}) {
  const queue = [active, completed, jobs, laborTypes, lastEntry]
  let n = 0
  useLiveQuery.mockImplementation(() => queue[n++ % 5])
}

const now = new Date()
const hoursAgo = h => new Date(now.getTime() - h * 3600000)

beforeEach(() => {
  vi.clearAllMocks()
  mockRailProps.current = null
})

describe('TimerView — quick-punch recent jobs', () => {
  it('feeds the rail the 3 most recently used active jobs (deduped, recency order)', () => {
    const jobs = [
      { id: 1, name: 'Alpha', isActive: true },
      { id: 2, name: 'Bravo', isActive: true },
      { id: 3, name: 'Charlie', isActive: true },
      { id: 4, name: 'Delta', isActive: true },
      { id: 5, name: 'Archived', isActive: false },
    ]
    const completed = [
      { id: 10, jobId: 1, punchIn: hoursAgo(5), punchOut: now },
      { id: 11, jobId: 2, punchIn: hoursAgo(4), punchOut: now },
      { id: 12, jobId: 1, punchIn: hoursAgo(3), punchOut: now }, // Alpha again → dedup, newer wins
      { id: 13, jobId: 3, punchIn: hoursAgo(2), punchOut: now },
      { id: 14, jobId: 5, punchIn: hoursAgo(1), punchOut: now }, // most recent, but archived → excluded
    ]
    setupMocks({ completed, jobs })
    render(<TimerView />)
    // By punchIn desc, distinct active jobs: Charlie(2h), Alpha(3h), Bravo(4h).
    expect(mockRailProps.current.recentJobs.map(j => j.name)).toEqual(['Charlie', 'Alpha', 'Bravo'])
  })

  it('falls back to active jobs when there are no punches yet', () => {
    const jobs = [
      { id: 1, name: 'Alpha', isActive: true },
      { id: 2, name: 'Bravo', isActive: true },
      { id: 3, name: 'Archived', isActive: false },
    ]
    setupMocks({ active: [], completed: [], jobs })
    render(<TimerView />)
    expect(mockRailProps.current.recentJobs.map(j => j.name)).toEqual(['Alpha', 'Bravo'])
  })
})

describe('TimerView — empty state', () => {
  it('shows "No active timers" subtitle when no entries are active', () => {
    setupMocks()
    render(<TimerView />)
    expect(screen.getByText(/no active timers/i)).toBeInTheDocument()
  })

  it('shows "Nothing running" illustration text', () => {
    setupMocks()
    render(<TimerView />)
    expect(screen.getByText('Nothing running')).toBeInTheDocument()
  })
})

describe('TimerView — loading state (issue #135)', () => {
  it('does not flash "No active timers" or the empty state while live queries are still undefined', () => {
    useLiveQuery.mockImplementation(() => undefined) // active/jobs/laborTypes/lastEntry all loading
    render(<TimerView />)
    expect(screen.queryByText(/no active timers/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing running')).not.toBeInTheDocument()
  })
})

describe('TimerView — active timers', () => {
  it('shows "1 timer running" for a single active entry', () => {
    const active = [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }]
    setupMocks({ active })
    render(<TimerView />)
    expect(screen.getByText(/1 timer running/i)).toBeInTheDocument()
  })

  it('shows "2 timers running" for multiple active entries', () => {
    const active = [
      { id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
      { id: 2, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
    ]
    setupMocks({ active })
    render(<TimerView />)
    expect(screen.getByText(/2 timers running/i)).toBeInTheDocument()
  })

  it('renders a TimerCard for each active entry', () => {
    const active = [
      { id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
      { id: 2, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
    ]
    setupMocks({ active })
    render(<TimerView />)
    expect(screen.getAllByTestId('timer-card')).toHaveLength(2)
  })
})

describe('TimerView — status live region (WCAG 4.1.3)', () => {
  it('announces the running-timer count via an aria-live="polite" subtitle', () => {
    const active = [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }]
    setupMocks({ active })
    render(<TimerView />)
    // The subtitle <p> hosts the "N timer(s) running" / "No active timers" text;
    // its text swaps in place on punch in/out, so it must be a persistent polite
    // region rather than a mounting/unmounting role="status" node.
    const subtitle = screen.getByText(/timer running/i).closest('p')
    expect(subtitle).toHaveAttribute('aria-live', 'polite')
  })

  it('keeps the same polite region in the idle state', () => {
    setupMocks()
    render(<TimerView />)
    const subtitle = screen.getByText(/no active timers/i).closest('p')
    expect(subtitle).toHaveAttribute('aria-live', 'polite')
  })
})

describe('TimerView — last session', () => {
  it('shows Last Session block when idle and lastEntry exists', () => {
    const lastEntry = {
      id: 1, jobId: 1, laborTypeId: 1,
      punchIn: new Date('2025-06-01T09:00:00'),
      punchOut: new Date('2025-06-01T10:00:00'),
    }
    setupMocks({ lastEntry })
    render(<TimerView />)
    expect(screen.getByText(/last session/i)).toBeInTheDocument()
  })

  it('shows Last Session even when timers are active (phone tier; rail covers desktop)', () => {
    const active = [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }]
    const lastEntry = {
      id: 2, jobId: 1, laborTypeId: 1,
      punchIn: new Date('2025-06-01T09:00:00'),
      punchOut: new Date('2025-06-01T10:00:00'),
    }
    setupMocks({ active, lastEntry })
    render(<TimerView />)
    expect(screen.getByText(/last session/i)).toBeInTheDocument()
  })
})

describe('TimerView — punch in button', () => {
  it('renders a "Punch In" button', () => {
    setupMocks()
    render(<TimerView />)
    expect(screen.getByRole('button', { name: /punchin/i })).toBeInTheDocument()
  })

  it('opens StartTimerModal when Punch In is clicked', () => {
    setupMocks()
    render(<TimerView />)
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))
    expect(screen.getByTestId('start-modal')).toBeInTheDocument()
  })

  it('closes StartTimerModal when the modal requests close', () => {
    setupMocks()
    render(<TimerView />)
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))
    fireEvent.click(screen.getByText('close-modal'))
    expect(screen.queryByTestId('start-modal')).not.toBeInTheDocument()
  })
})
