import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import TimerCard from './TimerCard'

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

const mockEntriesUpdate = vi.fn().mockResolvedValue(1)

vi.mock('../db', () => ({
  db: {
    entries: {
      get update() { return mockEntriesUpdate },
    },
  },
}))

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { hapticFeedback: true }, updateSetting: vi.fn() }),
}))

vi.mock('./EditEntryModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="edit-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}))

const ENTRY = {
  id: 1,
  jobId: 1,
  laborTypeId: 1,
  punchIn: new Date(Date.now() - 3600000),
  punchOut: null,
  notes: null,
}
const JOB = { id: 1, name: 'Acme Corp' }
const LABOR_TYPE = { id: 1, name: 'Design', color: '#6366F1' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TimerCard — rendering', () => {
  it('renders the job name', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('renders the labor type name', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByText('Design')).toBeInTheDocument()
  })

  it('renders a Stop button', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByRole('button', { name: /stop timer for acme corp/i })).toBeInTheDocument()
  })

  it('renders elapsed time with role="timer"', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByRole('timer')).toBeInTheDocument()
  })

  it('shows "Unknown Job" when job prop is undefined', () => {
    render(<TimerCard entry={ENTRY} job={undefined} laborType={LABOR_TYPE} />)
    expect(screen.getByText('Unknown Job')).toBeInTheDocument()
  })

  it('renders entry notes when present', () => {
    const entryWithNotes = { ...ENTRY, notes: 'Quick fix session' }
    render(<TimerCard entry={entryWithNotes} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByText('Quick fix session')).toBeInTheDocument()
  })

  it('does not render notes section when notes is null', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.queryByText('Quick fix session')).not.toBeInTheDocument()
  })
})

describe('TimerCard — colour accent', () => {
  it("uses the job's colour for the accent, overriding the labor type", () => {
    render(<TimerCard entry={ENTRY} job={{ ...JOB, color: '#FF0000' }} laborType={LABOR_TYPE} />)
    expect(screen.getByRole('timer')).toHaveStyle({ color: 'rgb(255, 0, 0)' })
  })

  it('falls back to the labor type colour when the job has no colour', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByRole('timer')).toHaveStyle({ color: 'rgb(99, 102, 241)' })
  })
})

describe('TimerCard — long-running (overnight) motion', () => {
  // The design-system motion rule reserves the pulse for the live "On the clock"
  // status; a >12h timer must read as a calm, static note — never infinite/bouncy
  // decorative motion. Guards against re-adding the old animate-pulse border +
  // animate-bounce "Overnight Run?" badge.
  const overnightEntry = { ...ENTRY, punchIn: new Date(Date.now() - 13 * 3600000) } // 13h ago

  it('shows a calm "Still running · 12h+" note past 12 hours', () => {
    render(<TimerCard entry={overnightEntry} job={JOB} laborType={LABOR_TYPE} />)
    expect(screen.getByText('Still running · 12h+')).toBeInTheDocument()
  })

  it('uses no infinite/bouncy decorative animation when overnight', () => {
    const { container } = render(<TimerCard entry={overnightEntry} job={JOB} laborType={LABOR_TYPE} />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
    expect(container.querySelector('.animate-bounce')).toBeNull()
  })

  it('does not show the overnight note for a normal-length timer', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />) // 1h ago
    expect(screen.queryByText(/still running/i)).not.toBeInTheDocument()
  })
})

describe('TimerCard — background pause (#142)', () => {
  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible') // restore for other tests
  })

  it('stops the 1s tick while the tab is hidden and re-syncs when visible again', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    const entry = { ...ENTRY, punchIn: new Date('2024-01-15T09:00:00Z') } // 1h ago
    setVisibility('visible')
    render(<TimerCard entry={entry} job={JOB} laborType={LABOR_TYPE} />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('01:00:00')

    // Ticks while visible
    act(() => { vi.advanceTimersByTime(2000) })
    expect(timer).toHaveTextContent('01:00:02')

    // Hidden: interval is cleared, so background time does not update the clock
    setVisibility('hidden')
    act(() => { vi.advanceTimersByTime(10000) })
    expect(timer).toHaveTextContent('01:00:02')

    // Visible again: immediate re-sync to the true elapsed (12s total)
    setVisibility('visible')
    expect(timer).toHaveTextContent('01:00:12')
  })
})

describe('TimerCard — stop timer', () => {
  it('calls db.entries.update with a punchOut Date when Stop is clicked', async () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    fireEvent.click(screen.getByRole('button', { name: /stop timer for acme corp/i }))
    await waitFor(() =>
      expect(mockEntriesUpdate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ punchOut: expect.any(Date) })
      )
    )
  })
})

describe('TimerCard — frozen-ref rendering', () => {
  // TimerCard receives already-resolved job/laborType props (resolution happens in
  // TimerView via entryJob/entryLabor). These tests confirm the card renders any
  // {name,color,…}-shaped object — live or frozen snapshot — identically.
  it('renders a frozen job name passed as the job prop', () => {
    const frozenJob = { name: 'FrozenJob', color: '#f00' }
    render(<TimerCard entry={ENTRY} job={frozenJob} laborType={LABOR_TYPE} />)
    expect(screen.getByText('FrozenJob')).toBeInTheDocument()
  })

  it('renders a frozen labor type name passed as the laborType prop', () => {
    const frozenLabor = { name: 'OldDev', color: '#5FD08A', glyph: 'code' }
    render(<TimerCard entry={ENTRY} job={JOB} laborType={frozenLabor} />)
    expect(screen.getByText('OldDev')).toBeInTheDocument()
  })
})

describe('TimerCard — edit modal', () => {
  it('opens EditEntryModal when the edit start time button is clicked', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    fireEvent.click(screen.getByRole('button', { name: /edit start time/i }))
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument()
  })

  it('closes EditEntryModal when the modal requests close', () => {
    render(<TimerCard entry={ENTRY} job={JOB} laborType={LABOR_TYPE} />)
    fireEvent.click(screen.getByRole('button', { name: /edit start time/i }))
    fireEvent.click(screen.getByText('close-edit'))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })
})
