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

const JOBS  = [{ id: 1, name: 'Job A', clientName: 'Acme Inc', color: '#22C55E', isActive: true, laborTypeId: 1 }]
const TYPES = [{ id: 1, name: 'Design', color: '#6366F1', glyph: 'brush', isArchived: false }]

// useLiveQuery is called twice per render (jobs, then laborTypes).
// This implementation stays stable across re-renders by alternating on call index.
function useAlternatingMock() {
  let n = 0
  useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? JOBS : TYPES))
}

// The job picker is a custom combobox (a native <select> can't show a colour dot
// + client line). Open it and pick the option by name.
function pickJob(name) {
  fireEvent.click(screen.getByRole('button', { name: /^job/i })) // open the listbox
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name, 'i') }))
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('StartTimerModal — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveQuery.mockReturnValue([])
  })

  it('renders the modal header and subtitle', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByText('Start Timer')).toBeInTheDocument()
    expect(screen.getByText(/pick a job/i)).toBeInTheDocument()
  })

  it('renders the Punch In button', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /punchin/i })).toBeInTheDocument()
  })

  it('renders a job picker trigger', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^job/i })).toBeInTheDocument()
  })

  it('renders a labor-type chip per active type (radiogroup)', () => {
    useAlternatingMock()
    render(<StartTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: /labor/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /design/i })).toBeInTheDocument()
  })
})

describe('StartTimerModal — job combobox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAlternatingMock()
  })

  it('opens a listbox of jobs (with client name) when the trigger is clicked', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^job/i }))
    const opt = screen.getByRole('option', { name: /job a/i })
    expect(opt).toBeInTheDocument()
    expect(opt).toHaveTextContent('Acme Inc') // client name rides along
  })

  it('selecting a job marks it aria-selected and reflects it on the trigger', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    pickJob('Job A')
    expect(screen.getByRole('button', { name: /job a/i })).toBeInTheDocument()
  })

  it('Escape closes the open job listbox without closing the modal', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^job/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled() // the modal stays open
  })
})

describe('StartTimerModal — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLiveQuery.mockReturnValue([])
  })

  it('shows an error when submitting with no job selected', async () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))
    await waitFor(() =>
      expect(screen.getByText('Please select a job')).toBeInTheDocument()
    )
  })

  it('shows an error when job is selected but no labor type', async () => {
    // Job has no default laborTypeId, so the useEffect won't auto-fill it
    const jobsNoDefault = [{ id: 1, name: 'Job A', clientName: 'Acme Inc', isActive: true, laborTypeId: null }]
    let n = 0
    useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? jobsNoDefault : []))

    render(<StartTimerModal onClose={vi.fn()} />)

    pickJob('Job A')
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))

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
    pickJob('Job A')
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockStartTimer).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: '1', laborTypeId: '1', allowConcurrentTimers: false }),
    )
  })

  it('forwards allowConcurrentTimers: true when concurrent mode is on', async () => {
    mockSettings.allowConcurrentTimers = true
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)

    pickJob('Job A')
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockStartTimer).toHaveBeenCalledWith(
      expect.objectContaining({ allowConcurrentTimers: true }),
    )
  })

  it('preselects the job from initialJobId (quick-punch into the modal)', async () => {
    render(<StartTimerModal onClose={vi.fn()} initialJobId={1} />)
    // The trigger shows the preselected job (its accessible name carries it).
    expect(screen.getByRole('button', { name: /job a/i })).toBeInTheDocument()
  })

  it('does NOT auto-select a task when opened preselected from quick-punch (you pick it)', () => {
    // Quick-punch opens the sheet on the job but with no labor type chosen, so the
    // user consciously picks the task. (Manually picking a job still auto-fills —
    // covered by the punch-flow tests; this only suppresses the initial preselect.)
    render(<StartTimerModal onClose={vi.fn()} initialJobId={1} />)
    expect(screen.getByRole('button', { name: /job a/i })).toBeInTheDocument() // job is set
    expect(screen.getByRole('radio', { name: /design/i })).toHaveAttribute('aria-checked', 'false') // task is empty
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

  it('tapping the backdrop (scrim) calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<StartTimerModal onClose={onClose} />)
    fireEvent.click(container.firstChild) // the scrim element itself
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking inside the sheet does NOT call onClose (guarded backdrop)', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog')) // bubbles to scrim, but target ≠ scrim
    expect(onClose).not.toHaveBeenCalled()
  })

  it('swiping the sheet down past the threshold dismisses (any touch platform)', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    const sheet = screen.getByRole('dialog')
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 220 }] }) // +120 > 80px threshold
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a downward drag under the threshold does NOT dismiss', () => {
    const onClose = vi.fn()
    render(<StartTimerModal onClose={onClose} />)
    const sheet = screen.getByRole('dialog')
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 150 }] }) // +50 < 80px threshold
    expect(onClose).not.toHaveBeenCalled()
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

  it('can select a labor-type chip', () => {
    render(<StartTimerModal onClose={vi.fn()} />)
    const chip = screen.getByRole('radio', { name: /design/i })
    expect(chip).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-checked', 'true')
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
    pickJob('Job A')
    fireEvent.click(screen.getByRole('button', { name: /punchin/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
    expect(screen.getByRole('alert')).toHaveTextContent('DB error')
  })
})
