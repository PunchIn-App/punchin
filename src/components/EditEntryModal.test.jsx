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

const JOBS = [{ id: 1, name: 'Acme Corp', isActive: true, isDeleted: false, laborTypeId: null }]
const LABOR_TYPES = [{ id: 1, name: 'Design', isArchived: false }]

function setupMocks() {
  let n = 0
  useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? JOBS : LABOR_TYPES))
}

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

  it('renders both start and end date inputs', () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs).toHaveLength(2)
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

  it('pre-fills start date with "2025-06-01"', () => {
    render(<EditEntryModal entry={COMPLETED_ENTRY} onClose={vi.fn()} />)
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs[0]).toHaveValue('2025-06-01')
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

  it('renders only 1 date input (no end date)', () => {
    render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs).toHaveLength(1)
  })

  it('renders only 1 time input (no end time)', () => {
    render(<EditEntryModal entry={ACTIVE_ENTRY} onClose={vi.fn()} />)
    const timeInputs = document.querySelectorAll('input[type="time"]')
    expect(timeInputs).toHaveLength(1)
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
    const combos = screen.getAllByRole('combobox')
    fireEvent.change(combos[0], { target: { value: '1' } })
    fireEvent.change(combos[1], { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /add time entry/i }))
    await waitFor(() =>
      expect(screen.getByText('Please select a labor type')).toBeInTheDocument()
    )
  })

  it('shows "End must be after start." when end time is before start time', async () => {
    render(<EditEntryModal onClose={vi.fn()} />)
    const combos = screen.getAllByRole('combobox')
    fireEvent.change(combos[0], { target: { value: '1' } })
    fireEvent.change(combos[1], { target: { value: '1' } })

    const timeInputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '22:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '08:00' } })

    fireEvent.click(screen.getByRole('button', { name: /add time entry/i }))
    await waitFor(() =>
      expect(screen.getByText('End must be after start.')).toBeInTheDocument()
    )
  })
})

describe('EditEntryModal — save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('calls db.entries.add with {jobId:1,laborTypeId:1} on successful add', async () => {
    const onClose = vi.fn()
    render(<EditEntryModal onClose={onClose} />)
    const combos = screen.getAllByRole('combobox')
    fireEvent.change(combos[0], { target: { value: '1' } })
    fireEvent.change(combos[1], { target: { value: '1' } })
    // Set explicit times so the test is not flaky near midnight
    const timeInputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } })
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
