import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimesheetsView from './TimesheetsView'
import { openPrintWindow } from '../utils/printDocument'

// Printing goes through openPrintWindow (a hidden iframe, not a popup). Mock just
// that fn so these tests assert the html the view builds; the iframe mechanics are
// covered in printDocument.test.js (PRINT_FONT_HEAD/laborBadgeHTML stay real).
vi.mock('../utils/printDocument', async (importOriginal) => ({
  ...(await importOriginal()),
  openPrintWindow: vi.fn(() => true),
}))

const mockEntriesDelete = vi.fn().mockResolvedValue(undefined)
const mockDeleteEntry   = vi.fn().mockResolvedValue(undefined)
// Controls what db.entries.where(...).between(...).toArray() resolves with.
// Default is []; tests that exercise the print path (which queries db directly)
// can push entries into this before firing the print button.
let mockDbEntries = []

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({
  db: {
    entries: {
      where: vi.fn(() => ({ between: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(mockDbEntries)) })) })),
      get delete() { return mockEntriesDelete },
    },
  },
  get deleteEntry() { return mockDeleteEntry },
}))
vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { weekStartsMonday: true }, updateSetting: vi.fn() }),
}))
vi.mock('../components/EditEntryModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="edit-entry-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}))
vi.mock('../components/InvoiceModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="invoice-modal">
      <button onClick={onClose}>close-invoice</button>
    </div>
  ),
}))

// Fixture data
const JOBS = [{ id: 1, name: 'Acme Corp', clientName: null, isActive: true }]
const LABOR_TYPES = [{ id: 1, name: 'Design', color: '#6366F1', isArchived: false }]

const TODAY = new Date()
TODAY.setHours(12, 0, 0, 0) // noon today — safely inside any day range
const AN_ENTRY = {
  id: 1,
  jobId: 1,
  laborTypeId: 1,
  punchIn:  new Date(TODAY.getTime() - 3600000), // 11:00
  punchOut: new Date(TODAY),                      // 12:00
  notes: null,
}
const AN_ENTRY_WITH_NOTES = { ...AN_ENTRY, id: 2, notes: 'Design review' }

// Routes useLiveQuery: [] deps → JOBS then LABOR_TYPES (interleaved); [number] → entries
function setupWithEntries(entries = [AN_ENTRY]) {
  let n = 0
  useLiveQuery.mockImplementation((_fn, deps) => {
    if (!deps || deps.length === 0) return (n++ % 2 === 0) ? JOBS : LABOR_TYPES
    return entries
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbEntries = []
  useLiveQuery.mockReturnValue([])
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  global.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── existing structural tests ────────────────────────────────────────────────

describe('TimesheetsView — tab switching', () => {
  it('renders daily and weekly tab buttons', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('tab', { name: 'daily' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'weekly' })).toBeInTheDocument()
  })

  it('daily tab is selected by default', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('tab', { name: 'daily' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'weekly' })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches to weekly tab on click', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    expect(screen.getByRole('tab', { name: 'weekly' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'daily' })).toHaveAttribute('aria-selected', 'false')
  })
})

describe('TimesheetsView — period navigation', () => {
  it('renders previous and next navigation buttons', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: /previous day/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next day/i })).toBeInTheDocument()
  })

  it('shows previous/next week buttons after switching to weekly tab', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument()
  })
})

describe('TimesheetsView — search and filter', () => {
  it('renders the search input', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('searchbox', { name: /search time entries/i })).toBeInTheDocument()
  })

  it('renders the job filter picker', () => {
    render(<TimesheetsView />)
    // The native <select> filters are now bespoke EntitySelect (compact) pickers,
    // whose trigger is a button (aria-haspopup="listbox"), not a combobox.
    expect(screen.getByRole('button', { name: /filter by job/i })).toBeInTheDocument()
  })

  it('renders the labor type filter picker', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: /filter by labor type/i })).toBeInTheDocument()
  })
})

describe('TimesheetsView — action buttons', () => {
  it('renders CSV, Print, Invoice, and Log Manual buttons', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: /export current view as csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print timesheet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate invoice/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log manual/i })).toBeInTheDocument()
  })

  it('opens EditEntryModal when "Log Manual" is clicked', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /log manual/i }))
    expect(screen.getByTestId('edit-entry-modal')).toBeInTheDocument()
  })

  it('closes EditEntryModal when it requests close', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /log manual/i }))
    fireEvent.click(screen.getByText('close-edit'))
    expect(screen.queryByTestId('edit-entry-modal')).not.toBeInTheDocument()
  })

  it('opens InvoiceModal when "Invoice" is clicked', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /generate invoice/i }))
    expect(screen.getByTestId('invoice-modal')).toBeInTheDocument()
  })

  it('closes InvoiceModal when it requests close', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /generate invoice/i }))
    fireEvent.click(screen.getByText('close-invoice'))
    expect(screen.queryByTestId('invoice-modal')).not.toBeInTheDocument()
  })
})

// ─── DailySheet content ───────────────────────────────────────────────────────

describe('TimesheetsView — DailySheet empty state', () => {
  it('shows "No entries this day" when there are no entries', () => {
    setupWithEntries([])
    render(<TimesheetsView />)
    expect(screen.getByText('No entries this day')).toBeInTheDocument()
  })

  it('shows a total summary bar even with no entries', () => {
    setupWithEntries([])
    render(<TimesheetsView />)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })
})

describe('TimesheetsView — DailySheet with entries', () => {
  it('renders the entry job name', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // The job filter is now a collapsed EntitySelect picker (its options only
    // render when the menu is open), so "Acme Corp" appears once — in the card.
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the entry labor type badge', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // Likewise the labor filter is collapsed, so "Design" appears in the badge.
    expect(screen.getAllByText('Design').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a non-zero formatted duration', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // formatDurationHM omits minutes when they are 0 (e.g. "1h", not "1h 0m")
    expect(screen.getAllByText(/\d+h(\s+\d+m)?/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders entry notes when present', () => {
    setupWithEntries([AN_ENTRY_WITH_NOTES])
    render(<TimesheetsView />)
    expect(screen.getByText('Design review')).toBeInTheDocument()
  })

  it('does not render notes section when notes is null', () => {
    setupWithEntries([AN_ENTRY])
    render(<TimesheetsView />)
    expect(screen.queryByText('Design review')).not.toBeInTheDocument()
  })

  it('renders edit and delete buttons for the entry', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete entry for acme corp/i })).toBeInTheDocument()
  })

  it('clicking the edit button opens EditEntryModal', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /edit entry for acme corp/i }))
    expect(screen.getByTestId('edit-entry-modal')).toBeInTheDocument()
  })

  it('closing EditEntryModal returns to sheet view', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /edit entry for acme corp/i }))
    fireEvent.click(screen.getByText('close-edit'))
    expect(screen.queryByTestId('edit-entry-modal')).not.toBeInTheDocument()
  })
})

// ─── Totals correctness: running timers + cross-day clipping (#136, #137) ──────

describe('TimesheetsView — daily Total correctness', () => {
  it('excludes a still-running timer from the daily Total (#137)', () => {
    const completed = { ...AN_ENTRY } // 11:00 → 12:00, a completed hour
    const running   = {
      id: 9, jobId: 1, laborTypeId: 1,
      punchIn: new Date(TODAY.getTime() - 5 * 3600000), // running for hours
      punchOut: null, notes: null,
    }
    setupWithEntries([completed, running])
    render(<TimesheetsView />)
    // Total counts only the completed hour, not the running timer's elapsed time
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/^1h$/)
  })

  it('counts the in-day portion of an entry that began the night before (#136)', () => {
    // Yesterday 23:00 → today 01:00: only the 00:00–01:00 hour belongs to today.
    // The old punchIn-only filter dropped this entry from today entirely.
    const yStart = new Date(TODAY); yStart.setDate(yStart.getDate() - 1); yStart.setHours(23, 0, 0, 0)
    const tEnd   = new Date(TODAY); tEnd.setHours(1, 0, 0, 0)
    const overnight = { id: 10, jobId: 1, laborTypeId: 1, punchIn: yStart, punchOut: tEnd, notes: null }
    setupWithEntries([overnight])
    render(<TimesheetsView />)
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/^1h$/)
  })
})

// ─── Search filtering ─────────────────────────────────────────────────────────

describe('TimesheetsView — search filters entries', () => {
  it('hides entry when search does not match — shows empty state', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'xyzzy' },
    })
    // No matching entries → empty state appears
    expect(screen.getByText('No entries this day')).toBeInTheDocument()
  })

  it('keeps entry visible when search matches job name', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'acme' },
    })
    // Edit button still present confirms entry card is still rendered
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })
})

// ─── Delete flow ──────────────────────────────────────────────────────────────

describe('TimesheetsView — delete entry flow', () => {
  it('shows ConfirmModal when the delete button is clicked', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete this time entry?')).toBeInTheDocument()
  })

  it('calls deleteEntry when deletion is confirmed', async () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDeleteEntry).toHaveBeenCalledWith(1))
  })

  it('closes the ConfirmModal after deletion is confirmed', async () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('dismisses the ConfirmModal without deleting when Cancel is clicked', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockEntriesDelete).not.toHaveBeenCalled()
  })
})

// ─── CSV export ───────────────────────────────────────────────────────────────

describe('TimesheetsView — CSV export', () => {
  it('calls URL.createObjectURL when CSV button is clicked (daily)', async () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /export current view as csv/i }))
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
  })

  it('calls URL.createObjectURL when CSV button is clicked (weekly)', async () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /export current view as csv/i }))
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled())
  })
})

// ─── Print timesheet ─────────────────────────────────────────────────────────

describe('TimesheetsView — print timesheet', () => {
  it('hands the print document to openPrintWindow (daily)', async () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /print timesheet/i }))
    await waitFor(() => expect(openPrintWindow).toHaveBeenCalled())
  })

  it('hands the print document to openPrintWindow (weekly)', async () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /print timesheet/i }))
    await waitFor(() => expect(openPrintWindow).toHaveBeenCalled())
  })

  it('prints the timesheet in the Noto brand font, loading the webfont (not the system-UI fallback)', async () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /print timesheet/i }))
    await waitFor(() => expect(openPrintWindow).toHaveBeenCalled())
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain("font-family: 'Noto Sans', sans-serif")
    expect(html).toContain("'Noto Sans Mono', monospace")
    expect(html).toContain("'Noto Sans Display'")
    expect(html).toContain('/fonts/noto-sans-latin-wght-normal.woff2')
    expect(html).not.toContain('-apple-system')
    expect(html).not.toContain('SF Mono')
  })

  it('printed timesheet badge shows the labor glyph (svg) and labor name, not colour-only', async () => {
    // The print function queries db directly (not via useLiveQuery), so populate
    // both: useLiveQuery for the on-screen sheet, mockDbEntries for the print path.
    setupWithEntries()
    mockDbEntries = [AN_ENTRY]
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /print timesheet/i }))
    await waitFor(() => expect(openPrintWindow).toHaveBeenCalled())
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Design')
  })
})

// ─── WeeklySheet content ──────────────────────────────────────────────────────

describe('TimesheetsView — WeeklySheet with entries', () => {
  it('renders "Week total" label', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    expect(screen.getByText('Week total')).toBeInTheDocument()
  })

  it('shows job name in the job breakdown section', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    // "Acme Corp" appears in dropdown, breakdown, and day-by-day rows
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1)
  })

  it('keeps a populated day collapsed by default and reveals its entries on expand', () => {
    // The weekly view is a clean day-totals list (design-system fidelity); each
    // populated day discloses its entries on tap rather than rendering them inline.
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    // Collapsed: the entry's edit button is not in the DOM yet.
    expect(screen.queryByRole('button', { name: /edit entry for acme corp/i })).not.toBeInTheDocument()
    // Expand the only populated day.
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })

  it('renders edit and delete buttons in the day-by-day view (once expanded)', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete entry for acme corp/i })).toBeInTheDocument()
  })

  it('clicking the edit button in weekly view opens EditEntryModal', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit entry for acme corp/i }))
    expect(screen.getByTestId('edit-entry-modal')).toBeInTheDocument()
  })

  it('clicking the delete button in weekly view shows ConfirmModal', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ─── Job filter dropdown ──────────────────────────────────────────────────────

// Extra job fixture used for filter-mismatch tests (id=2 so it can be added as
// a real <option> while AN_ENTRY has jobId=1).
const JOBS_TWO = [
  { id: 1, name: 'Acme Corp', clientName: null, isActive: true },
  { id: 2, name: 'Beta LLC',  clientName: null, isActive: true },
]
const LABOR_TYPES_TWO = [
  { id: 1, name: 'Design',   color: '#6366F1', isArchived: false },
  { id: 2, name: 'Dev',      color: '#3B82F6', isArchived: false },
]

/** Like setupWithEntries but populates both JOBS_TWO and LABOR_TYPES_TWO so
 *  selects have two real options each. */
function setupWithTwoOptions(entries = [AN_ENTRY]) {
  let n = 0
  useLiveQuery.mockImplementation((_fn, deps) => {
    if (!deps || deps.length === 0) return (n++ % 2 === 0) ? JOBS_TWO : LABOR_TYPES_TWO
    return entries
  })
}

// The filters are bespoke EntitySelect (compact) pickers, not native <select>:
// open the picker by its accessible name, then click an option by role.
function pickFilter(filterName, optionName) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(filterName, 'i') }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(optionName, 'i') }))
}

describe('TimesheetsView — job filter', () => {
  it('hides entry when job filter does not match', () => {
    // AN_ENTRY.jobId = 1; filter to Beta LLC (id=2) → no match → empty state
    setupWithTwoOptions()
    render(<TimesheetsView />)
    pickFilter('filter by job', 'Beta LLC')
    expect(screen.getByText('No entries this day')).toBeInTheDocument()
  })

  it('keeps entry visible when job filter matches the entry job', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // Acme Corp (id=1) matches AN_ENTRY.jobId = 1
    pickFilter('filter by job', 'Acme Corp')
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })
})

// ─── Labor type filter dropdown ───────────────────────────────────────────────

describe('TimesheetsView — client filter (the job picker also selects a whole client)', () => {
  it('keeps every entry whose job belongs to the chosen client and drops the rest', () => {
    const jobs = [
      { id: 1, name: 'Acme Web', clientName: 'Acme', isActive: true },
      { id: 2, name: 'Acme App', clientName: 'Acme', isActive: true },
      { id: 3, name: 'Solo',     clientName: null,   isActive: true },
    ]
    const mk = (id, jobId) => ({ id, jobId, laborTypeId: 1, punchIn: new Date(TODAY.getTime() - 3600000), punchOut: new Date(TODAY), notes: null })
    const entries = [mk(1, 1), mk(2, 2), mk(3, 3)]
    let n = 0
    useLiveQuery.mockImplementation((_fn, deps) => {
      if (!deps || deps.length === 0) return (n++ % 2 === 0) ? jobs : LABOR_TYPES
      return entries
    })
    render(<TimesheetsView />)
    pickFilter('filter by job', 'whole client') // the only client option: "Acme · whole client"
    expect(screen.getByRole('button', { name: /edit entry for acme web/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit entry for acme app/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit entry for solo/i })).not.toBeInTheDocument()
  })
})

describe('TimesheetsView — labor type filter', () => {
  it('hides entry when labor type filter does not match', () => {
    // AN_ENTRY.laborTypeId = 1 (Design); filter to Dev (id=2) → no match → empty
    setupWithTwoOptions()
    render(<TimesheetsView />)
    pickFilter('filter by labor type', '^Dev$')
    expect(screen.getByText('No entries this day')).toBeInTheDocument()
  })

  it('keeps entry visible when labor type filter matches the entry', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // Design (id=1) matches AN_ENTRY.laborTypeId = 1
    pickFilter('filter by labor type', 'Design')
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })
})

// ─── Period navigation (functional) ──────────────────────────────────────────

describe('TimesheetsView — period navigation (functional)', () => {
  it('previous day button navigates without crashing', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }))
    expect(screen.getByRole('button', { name: /previous day/i })).toBeInTheDocument()
  })

  it('next day button navigates forward without crashing', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: /next day/i }))
    expect(screen.getByRole('button', { name: /next day/i })).toBeInTheDocument()
  })

  it('previous week button navigates back in weekly view without crashing', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /previous week/i }))
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()
  })

  it('next week button navigates forward in weekly view without crashing', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /next week/i }))
    expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument()
  })
})

// ─── clientName search match ──────────────────────────────────────────────────

describe('TimesheetsView — clientName search match', () => {
  it('keeps entry visible when search matches the client name', () => {
    // Use a job with a clientName so the matchesClient branch executes
    const jobsWithClient = [{ id: 1, name: 'Acme Corp', clientName: 'Big Client', isActive: true }]
    let n = 0
    useLiveQuery.mockImplementation((_fn, deps) => {
      if (!deps || deps.length === 0) return (n++ % 2 === 0) ? jobsWithClient : LABOR_TYPES
      return [AN_ENTRY]
    })
    render(<TimesheetsView />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'big client' },
    })
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })
})
