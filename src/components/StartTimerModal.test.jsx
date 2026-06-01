import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import StartTimerModal from './StartTimerModal'

// --------------------------------------------------------------------------
// Hoist-safe variables (names must start with "mock" for Vitest hoisting)
// --------------------------------------------------------------------------

const mockEntriesCount  = vi.fn().mockResolvedValue(0)
const mockEntriesFilter = vi.fn(() => ({ count: mockEntriesCount }))
const mockEntriesAdd    = vi.fn().mockResolvedValue(1)
const mockTransaction   = vi.fn(async (_mode, _tables, fn) => fn())

// --------------------------------------------------------------------------
// Module mocks
// --------------------------------------------------------------------------

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../db', () => ({
  db: {
    entries: {
      get filter() { return mockEntriesFilter },
      get add()    { return mockEntriesAdd },
    },
    get transaction() { return mockTransaction },
  },
}))

const mockSettings = { allowConcurrentTimers: false }

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: vi.fn() }),
}))

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const JOBS  = [{ id: 1, name: 'Job A', isActive: true, isDeleted: false, laborTypeId: 1 }]
const TYPES = [{ id: 1, name: 'Design', isArchived: false }]

// useLiveQuery is called twice per render (jobs, then laborTypes).
// This implementation stays stable across re-renders by alternating on call index.
function useAlternatingMock() {
  let n = 0
  useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? JOBS : TYPES))
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('StartTimerModal — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveQuery.mockReturnValue([])
  })

  it('renders the modal header', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByText('Start Timer')).toBeInTheDocument()
  })

  it('renders the Punch In button', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /punch in/i })).toBeInTheDocument()
  })

  it('renders job and labor type selects', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })
})

describe('StartTimerModal — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveQuery.mockReturnValue([])
  })

  it('shows an error when submitting with no job selected', async () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))
    await waitFor(() =>
      expect(screen.getByText('Please select a job')).toBeInTheDocument()
    )
  })

  it('shows an error when job is selected but no labor type', async () => {
    // Job has no default laborTypeId, so the useEffect won't auto-fill it
    const jobsNoDefault = [{ id: 1, name: 'Job A', isActive: true, isDeleted: false, laborTypeId: null }]
    let n = 0
    useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? jobsNoDefault : []))

    render(<StartTimerModal onClose={vi.fn()} />)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() =>
      expect(screen.getByText('Please select a labor type')).toBeInTheDocument()
    )
  })
})

describe('StartTimerModal — concurrent timer guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettings.allowConcurrentTimers = false
    mockEntriesCount.mockResolvedValue(0)
    mockTransaction.mockImplementation(async (_mode, _tables, fn) => fn())
    useAlternatingMock()
  })

  it('blocks start when a timer is already running and concurrent mode is off', async () => {
    mockEntriesCount.mockResolvedValue(1) // 1 running timer

    render(<StartTimerModal onClose={vi.fn()} />)

    // Selecting a job auto-fills laborTypeId via useEffect (job.laborTypeId = 1)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() =>
      expect(screen.getByText(/concurrent timers are off/i)).toBeInTheDocument()
    )
    expect(mockEntriesAdd).not.toHaveBeenCalled()
  })

  it('allows start when concurrent mode is on, even with a running timer', async () => {
    mockSettings.allowConcurrentTimers = true
    mockEntriesCount.mockResolvedValue(1)
    mockEntriesAdd.mockResolvedValue(2)

    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
