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

const JOBS = [{ id: 1, name: 'Acme Corp' }]
const LABOR_TYPES = [{ id: 1, name: 'Design', color: '#6366F1' }]

// useLiveQuery is called 4 times per render: active, jobs, laborTypes, lastEntry
function setupMocks({ active = [], jobs = JOBS, laborTypes = LABOR_TYPES, lastEntry = null } = {}) {
  const queue = [active, jobs, laborTypes, lastEntry]
  let n = 0
  useLiveQuery.mockImplementation(() => queue[n++ % 4])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TimerView — empty state', () => {
  it('shows "No active timers" subtitle when no entries are active', () => {
    setupMocks()
    render(<TimerView />)
    expect(screen.getByText('No active timers')).toBeInTheDocument()
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
    expect(screen.queryByText('No active timers')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing running')).not.toBeInTheDocument()
  })
})

describe('TimerView — active timers', () => {
  it('shows "1 timer running" for a single active entry', () => {
    const active = [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }]
    setupMocks({ active })
    render(<TimerView />)
    expect(screen.getByText('1 timer running')).toBeInTheDocument()
  })

  it('shows "2 timers running" for multiple active entries', () => {
    const active = [
      { id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
      { id: 2, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null },
    ]
    setupMocks({ active })
    render(<TimerView />)
    expect(screen.getByText('2 timers running')).toBeInTheDocument()
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

  it('does not show Last Session when timers are active', () => {
    const active = [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date(), punchOut: null }]
    const lastEntry = {
      id: 2, jobId: 1, laborTypeId: 1,
      punchIn: new Date('2025-06-01T09:00:00'),
      punchOut: new Date('2025-06-01T10:00:00'),
    }
    setupMocks({ active, lastEntry })
    render(<TimerView />)
    expect(screen.queryByText(/last session/i)).not.toBeInTheDocument()
  })
})

describe('TimerView — punch in button', () => {
  it('renders a "Punch In" button', () => {
    setupMocks()
    render(<TimerView />)
    expect(screen.getByRole('button', { name: /punch in/i })).toBeInTheDocument()
  })

  it('opens StartTimerModal when Punch In is clicked', () => {
    setupMocks()
    render(<TimerView />)
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))
    expect(screen.getByTestId('start-modal')).toBeInTheDocument()
  })

  it('closes StartTimerModal when the modal requests close', () => {
    setupMocks()
    render(<TimerView />)
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))
    fireEvent.click(screen.getByText('close-modal'))
    expect(screen.queryByTestId('start-modal')).not.toBeInTheDocument()
  })
})
