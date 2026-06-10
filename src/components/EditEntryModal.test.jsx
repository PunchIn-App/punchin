import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import EditEntryModal from './EditEntryModal'

const mockEntriesUpdate = vi.fn().mockResolvedValue(1)
const mockEntriesAdd    = vi.fn().mockResolvedValue(1)
const mockEntriesDelete = vi.fn().mockResolvedValue(undefined)
const mockDeleteEntry   = vi.fn().mockResolvedValue(undefined)

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({
  db: {
    jobs:       { filter: vi.fn(() => ({ toArray: vi.fn() })) },
    laborTypes: { orderBy: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn() })) })) },
    entries: {
      get update() { return mockEntriesUpdate },
      get add()    { return mockEntriesAdd },
      get delete() { return mockEntriesDelete },
    },
  },
  get deleteEntry() { return mockDeleteEntry },
}))

const COMPLETED_ENTRY = {
  id: 10,
  jobId: 1,
  laborTypeId: 1,
  punchIn: new Date('2025-06-01T09:00:00'),
  punchOut: new Date('2025-06-01T10:00:00'),
  notes: 'Design review',
}

const ACTIVE_ENTRY = {
  id: 11,
  jobId: 1,
  laborTypeId: 1,
  punchIn: new Date('2025-06-01T09:00:00'),
  punchOut: null,
  notes: null,
}

const JOBS = [{ id: 1, name: 'Acme Corp', isActive: true, laborTypeId: null }]
const LABOR_TYPES = [{ id: 1, name: 'Design', isArchived: false }]

function setupMocks() {
  let n = 0
  useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? JOBS : LABOR_TYPES))
}

// Job & labor are now bespoke EntitySelect comboboxes (colour dot / glyph +
// label), not native <select>. Open the picker by its label and click an option.
function pick(label, optionName) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + label, 'i') }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(optionName, 'i') }))
}
const pickJob   = () => pick('Job', 'Acme Corp')
const pickLabor = () => pick('Labor', 'Design')

describe('EditEntryModal — manual add mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders "Add Manual Entry" header', () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    expect(screen.getByText('Add Manual Entry')).toBeInTheDocument()
  })

  it('does not render a delete button', () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /delete entry/i })).not.toBeInTheDocument()
  })

  it('renders "Add Time Entry" save button', () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add time entry/i })).toBeInTheDocument()
  })

  it('renders both start and end date pickers', () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start date/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end date/i })).toBeInTheDocument()
  })
})

describe('EditEntryModal — edit mode (completed entry)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders "Edit Entry" header', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByText('Edit Entry')).toBeInTheDocument()
  })

  it('renders "Save Changes" button', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('renders delete button', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /delete entry/i })).toBeInTheDocument()
  })

  it('pre-fills notes with "Design review"', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('What did you work on?')).toHaveValue('Design review')
  })

  it('pre-fills the start date picker with Jun 1, 2025', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start date: jun 1, 2025/i })).toBeInTheDocument()
  })
})

describe('EditEntryModal — active timer mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders "Edit Active Timer" header', () => {
    render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByText('Edit Active Timer')).toBeInTheDocument()
  })

  it('renders only a start date picker (no end date) for an active timer', () => {
    render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start date/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /end date/i })).not.toBeInTheDocument()
  })

  it('renders only a start time picker (no end time) for an active timer', () => {
    render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /start time/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /end time/i })).not.toBeInTheDocument()
  })
})

describe('EditEntryModal — close behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<EditEntryModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<EditEntryModal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('tapping the backdrop (scrim) calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<EditEntryModal onClose={onClose} />)
    fireEvent.click(container.firstChild) // the scrim element itself
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking inside the dialog does NOT call onClose (guarded backdrop)', () => {
    const onClose = vi.fn()
    render(<EditEntryModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog')) // bubbles to scrim, but target ≠ scrim
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('EditEntryModal — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('shows "Please select a job" when no job is selected', async () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /add time entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Please select a job')).toBeInTheDocument()
    )
  })

  it('shows "Please select a labor type" when job is selected but no labor type', async () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    pickJob() // Acme Corp has no default labor type, so labor stays empty
    fireEvent.click(screen.getByRole('button', { name: /add time entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Please select a labor type')).toBeInTheDocument()
    )
  })

  it('shows "End must be after start." when end is before start', async () => {
    // Edit a known 09:00–10:00 entry (deterministic, unlike add-mode's now-based
    // defaults), then step the End hour wheel back to 08:00 — before the start.
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /end time/i })) // open the picker
    const endHours = screen.getByRole('spinbutton', { name: /hours \(end time\)/i })
    fireEvent.keyDown(endHours, { key: 'ArrowUp' }) // 10 → 09
    fireEvent.keyDown(endHours, { key: 'ArrowUp' }) // 09 → 08
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(screen.getByText('End must be after start.')).toBeInTheDocument()
    )
  })

  it('rejects a future start on an active timer (#153)', () => {
    // Pin "now" to the entry's start so the next calendar day is unambiguously
    // the future, then drive the start-date picker forward a day.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T09:00:00'))
    try {
      render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /start date/i })) // open the calendar
      fireEvent.click(screen.getByRole('button', { name: 'June 2, 2025' })) // tomorrow
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
      expect(screen.getByText(/start can.t be in the future/i)).toBeInTheDocument()
      expect(mockEntriesUpdate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('EditEntryModal — save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('calls db.entries.add with {jobId:1,laborTypeId:1} on successful add', async () => {
    // Pin "now" so the add-mode default times (start = now, end = now + 1h) are a
    // deterministic, valid 09:00–10:00 and the test can't go flaky near midnight.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T09:00:00'))
    const onClose = vi.fn()
    render(<EditEntryModal onClose={onClose} />)
    vi.useRealTimers()
    pickJob()
    pickLabor()
    fireEvent.click(screen.getByRole('button', { name: /add time entry/i }))
    await waitFor(() => expect(mockEntriesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 1, laborTypeId: 1 })
    ))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls db.entries.update with (10, {jobId:1,laborTypeId:1}) on successful edit', async () => {
    const onClose = vi.fn()
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(mockEntriesUpdate).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ jobId: 1, laborTypeId: 1 })
    ))
    expect(onClose).toHaveBeenCalled()
  })

  it('Enter key in notes triggers save (shows job error when no job selected)', async () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByPlaceholderText('What did you work on?'), { key: 'Enter' })
    await waitFor(() =>
      expect(screen.getByText('Please select a job')).toBeInTheDocument()
    )
  })
})

describe('EditEntryModal — delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('delete button shows ConfirmModal with "Delete this time entry?"', async () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Delete this time entry?')).toBeInTheDocument()
    )
  })

  it('confirming delete calls deleteEntry(10) and onClose', async () => {
    const onClose = vi.fn()
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Delete this time entry?')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDeleteEntry).toHaveBeenCalledWith(10))
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelling delete closes the dialog without deleting', async () => {
    const onClose = vi.fn()
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Delete this time entry?')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() =>
      expect(screen.queryByText('Delete this time entry?')).not.toBeInTheDocument()
    )
    expect(mockEntriesDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
