import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import StartTimerModal from './StartTimerModal'

// --------------------------------------------------------------------------
// Hoist-safe variables (names must start with "mock" for Vitest hoisting)
// --------------------------------------------------------------------------

const mockEntriesToArray = vi.fn().mockResolvedValue([])
const mockEntriesFilter  = vi.fn(() => ({ toArray: mockEntriesToArray }))
const mockEntriesUpdate  = vi.fn().mockResolvedValue(1)
const mockEntriesAdd     = vi.fn().mockResolvedValue(1)
const mockTransaction    = vi.fn(async (_mode, _tables, fn) => fn())
// The punch logic lives in db.startTimer (tested in db.test.js); the modal just
// delegates to it, so here we assert the delegation.
const mockStartTimer     = vi.fn().mockResolvedValue(undefined)

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
      get update() { return mockEntriesUpdate },
      get add()    { return mockEntriesAdd },
    },
    get transaction() { return mockTransaction },
  },
  startTimer: (...args) => mockStartTimer(...args),
}))

const mockSettings = { allowConcurrentTimers: false }

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: vi.fn() }),
}))

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const JOBS  = [{ id: 1, name: 'Job A', isActive: true, laborTypeId: 1 }]
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
    const jobsNoDefault = [{ id: 1, name: 'Job A', isActive: true, laborTypeId: null }]
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

describe('StartTimerModal — punch flow (delegates to db.startTimer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettings.allowConcurrentTimers = false
    mockStartTimer.mockResolvedValue(undefined)
    useAlternatingMock()
  })

  it('calls startTimer with the selected job/labor + concurrent setting, then closes', async () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)

    // Selecting a job auto-fills laborTypeId via useEffect (job.laborTypeId = 1)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockStartTimer).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: '1', laborTypeId: '1', allowConcurrentTimers: false }),
    )
  })

  it('forwards allowConcurrentTimers: true when concurrent mode is on', async () => {
    mockSettings.allowConcurrentTimers = true
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockStartTimer).toHaveBeenCalledWith(
      expect.objectContaining({ allowConcurrentTimers: true }),
    )
  })

  it('preselects the job from initialJobId (quick-punch into the modal)', async () => {
    render(<StartTimerModal onClose={vi.fn()} initialJobId={1} />)
    expect(screen.getAllByRole('combobox')[0].value).toBe('1')
  })
})

// --------------------------------------------------------------------------
// Close behaviour
// --------------------------------------------------------------------------

describe('StartTimerModal — close behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveQuery.mockReturnValue([])
  })

  it('close button (×) calls onClose', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pressing Escape calls onClose', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// --------------------------------------------------------------------------
// Form field interactions
// --------------------------------------------------------------------------

describe('StartTimerModal — form field interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAlternatingMock()
  })

  it('can type in the notes field', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    const notesInput = screen.getByPlaceholderText('What are you working on?')
    fireEvent.change(notesInput, { target: { value: 'Fixing the login bug' } })
    expect(notesInput.value).toBe('Fixing the login bug')
  })

  it('can change the labor type select', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    const ltSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(ltSelect, { target: { value: '1' } })
    expect(ltSelect.value).toBe('1')
  })

  it('pressing Enter in the notes field with no job selected shows the job validation error', async () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    const notesInput = screen.getByPlaceholderText('What are you working on?')
    fireEvent.keyDown(notesInput, { key: 'Enter' })
    await waitFor(() =>
      expect(screen.getByText('Please select a job')).toBeInTheDocument()
    )
  })
})

// --------------------------------------------------------------------------
// Error handling (transaction rejection)
// --------------------------------------------------------------------------

describe('StartTimerModal — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettings.allowConcurrentTimers = false
    mockStartTimer.mockRejectedValue(new Error('DB error'))
    useAlternatingMock()
  })

  it('shows the error message in role="alert" when the punch fails', async () => {
    render(<StartTimerModal onClose={vi.fn()} />)

    // Select a job — auto-fills laborTypeId via useEffect (job.laborTypeId = 1)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /punch in/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
    expect(screen.getByRole('alert')).toHaveTextContent('DB error')
  })
})
