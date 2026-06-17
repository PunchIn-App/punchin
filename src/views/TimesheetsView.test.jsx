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

// Route useLiveQuery by what each query reads (robust to call order/count — the
// view has several `[]`-deps queries: jobs, laborTypes, and the running-timer
// probe — so parity-based routing would swap them on re-render).
function routeQuery(fn, entries, JOBSET, LTSET) {
  const src = String(fn)
  if (src.includes('laborTypes')) return LTSET
  if (src.includes('db.jobs')) return JOBSET
  if (src.includes('punchOut')) return entries.filter(e => !e.punchOut) // running-timer probe
  return entries // the dated window query
}
function setupWithEntries(entries = [AN_ENTRY]) {
  useLiveQuery.mockImplementation((fn) => routeQuery(fn, entries, JOBS, LABOR_TYPES))
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
    expect(screen.getByRole('button', { name: 'daily' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'weekly' })).toBeInTheDocument()
  })

  it('daily tab is selected by default', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: 'daily' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'weekly' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to weekly tab on click', () => {
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    expect(screen.getByRole('button', { name: 'weekly' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'daily' })).toHaveAttribute('aria-pressed', 'false')
  })
})

// ─── Period switcher is a toggle-button group, not a tablist (WCAG 4.1.2) ──────

describe('TimesheetsView — period switcher ARIA (WCAG 4.1.2)', () => {
  it('wraps the daily/weekly buttons in a labelled group, with no tab/tablist roles', () => {
    render(<TimesheetsView />)
    // The switcher is a labelled toggle-button group (aria-pressed), not an
    // incomplete ARIA tablist (which would also need tabpanels + arrow keys).
    const group = screen.getByRole('group', { name: 'Timesheet view' })
    expect(group).toBeInTheDocument()
    expect(group).toContainElement(screen.getByRole('button', { name: 'daily' }))
    expect(group).toContainElement(screen.getByRole('button', { name: 'weekly' }))
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('marks the active period button aria-pressed="true" and the other "false"', () => {
    render(<TimesheetsView />)
    expect(screen.getByRole('button', { name: 'daily' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'weekly' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    expect(screen.getByRole('button', { name: 'daily' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'weekly' })).toHaveAttribute('aria-pressed', 'true')
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
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
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
  it('INCLUDES a still-running timer in the daily Total, valued live (#265)', () => {
    // Pin "now" to noon so the running timer's elapsed time is deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    try {
      const completed = { ...AN_ENTRY } // 11:00 → 12:00, a completed hour
      const running   = {
        id: 9, jobId: 1, laborTypeId: 1,
        punchIn: new Date(TODAY.getTime() - 5 * 3600000), // started 07:00 → 5h so far
        punchOut: null, notes: null,
      }
      setupWithEntries([completed, running])
      render(<TimesheetsView />)
      // 1h completed + 5h running so far = 6h (running is now counted live)
      expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/^6h$/)
      // ...and the running timer in view is flagged for exports
      expect(screen.getByText(/exports bill completed time only|total less until you punch out/i)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('bills a cross-midnight entry wholly on its punch-in day (#274)', () => {
    // Punch-in today 22:30 → out tomorrow 00:30 = 2h. The whole entry bills on the
    // day it started — never split across days — so the on-screen total matches what
    // the CSV/print/invoice exports bill for it (they key on punchIn the same way).
    const tStart = new Date(TODAY); tStart.setHours(22, 30, 0, 0)
    const tEnd   = new Date(TODAY); tEnd.setDate(tEnd.getDate() + 1); tEnd.setHours(0, 30, 0, 0)
    const overnight = { id: 10, jobId: 1, laborTypeId: 1, punchIn: tStart, punchOut: tEnd, notes: null }
    setupWithEntries([overnight])
    render(<TimesheetsView />)
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/^2h$/)
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
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    expect(screen.getByText('Week total')).toBeInTheDocument()
  })

  it('shows job name in the job breakdown section', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    // "Acme Corp" appears in dropdown, breakdown, and day-by-day rows
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1)
  })

  it('keeps a populated day collapsed by default and reveals its entries on expand', () => {
    // The weekly view is a clean day-totals list (design-system fidelity); each
    // populated day discloses its entries on tap rather than rendering them inline.
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    // Collapsed: the entry's edit button is not in the DOM yet.
    expect(screen.queryByRole('button', { name: /edit entry for acme corp/i })).not.toBeInTheDocument()
    // Expand the only populated day.
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })

  it('renders edit and delete buttons in the day-by-day view (once expanded)', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete entry for acme corp/i })).toBeInTheDocument()
  })

  it('clicking the edit button in weekly view opens EditEntryModal', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit entry for acme corp/i }))
    expect(screen.getByTestId('edit-entry-modal')).toBeInTheDocument()
  })

  it('clicking the delete button in weekly view shows ConfirmModal', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /show entries/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete entry for acme corp/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ─── Heading structure (WCAG 1.3.1) ───────────────────────────────────────────

describe('TimesheetsView — heading structure (WCAG 1.3.1)', () => {
  it('renders a per-view <h1> (visually hidden) for the Timesheets view', () => {
    render(<TimesheetsView />)
    // The toolbar has no visible title, so the h1 is sr-only — but it must exist
    // in the DOM so the view has a top-level heading like its sibling views.
    expect(screen.getByRole('heading', { level: 1, name: 'Timesheet' })).toBeInTheDocument()
  })

  it('renders the weekly "Week total" and "By job" section titles as headings', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    // The styled section titles are headings, not bare <p>s, so they appear in
    // the screen-reader heading outline.
    expect(screen.getByRole('heading', { name: 'Week total' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By job' })).toBeInTheDocument()
  })
})

// ─── Live-region status announcements (WCAG 4.1.3) ─────────────────────────────

describe('TimesheetsView — search/filter result is announced (live region)', () => {
  it('DailySheet summary bar is a polite live region reflecting the entry count', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    // The Total summary bar carries role="status" + aria-live="polite" and an
    // sr-only entry count, so a search/filter change is announced without focus.
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Total')
    expect(status).toHaveTextContent(/1 entry this day/i)
  })

  it('DailySheet live region updates to the empty result when search excludes all', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'xyzzy' },
    })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/0 entries this day/i)
  })

  it('WeeklySheet hero total is a polite live region reflecting the entry count', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Week total')
    expect(status).toHaveTextContent(/1 entry this week/i)
  })

  it('WeeklySheet live region updates to the empty result when search excludes all', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'xyzzy' },
    })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/0 entries this week/i)
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
  useLiveQuery.mockImplementation((fn) => routeQuery(fn, entries, JOBS_TWO, LABOR_TYPES_TWO))
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
    useLiveQuery.mockImplementation((fn) => routeQuery(fn, entries, jobs, LABOR_TYPES))
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
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /previous week/i }))
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()
  })

  it('next week button navigates forward in weekly view without crashing', () => {
    setupWithEntries()
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    fireEvent.click(screen.getByRole('button', { name: /next week/i }))
    expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument()
  })
})

// ─── clientName search match ──────────────────────────────────────────────────

describe('TimesheetsView — clientName search match', () => {
  it('keeps entry visible when search matches the client name', () => {
    // Use a job with a clientName so the matchesClient branch executes
    const jobsWithClient = [{ id: 1, name: 'Acme Corp', clientName: 'Big Client', isActive: true }]
    useLiveQuery.mockImplementation((fn) => routeQuery(fn, [AN_ENTRY], jobsWithClient, LABOR_TYPES))
    render(<TimesheetsView />)
    fireEvent.change(screen.getByRole('searchbox', { name: /search time entries/i }), {
      target: { value: 'big client' },
    })
    expect(screen.getByRole('button', { name: /edit entry for acme corp/i })).toBeInTheDocument()
  })
})

// ─── WeeklySheet frozen-job breakdown (synced-device shape, Fix #1) ───────────
// On a synced device a permanently-deleted job's entry arrives with jobId=null
// and frozenRefs.job.{name,color}.  Two such entries from *different* deleted jobs
// must appear as two distinct rows (not merged under one null key), and each row
// must show the frozen job name rather than "—".

describe('TimesheetsView — WeeklySheet frozen-job breakdown', () => {
  // Two frozen entries with jobId=null but different frozenRefs job names.
  const frozenEntry1 = {
    id: 101,
    jobId: null,
    laborTypeId: 1,
    punchIn:  new Date(TODAY.getTime() - 3 * 3600000), // 3 h before noon
    punchOut: new Date(TODAY.getTime() - 2 * 3600000), // 2 h before noon → 1 h
    notes: null,
    frozenRefs: { job: { name: 'Ghost Job A', color: '#aabbcc' } },
  }
  const frozenEntry2 = {
    id: 102,
    jobId: null,
    laborTypeId: 1,
    punchIn:  new Date(TODAY.getTime() - 2 * 3600000), // 2 h before noon
    punchOut: new Date(TODAY.getTime() - 1 * 3600000), // 1 h before noon → 1 h
    notes: null,
    frozenRefs: { job: { name: 'Ghost Job B', color: '#336699' } },
  }

  function setupFrozen(entries) {
    // No live jobs — both entries are fully frozen (deleted job, synced-device shape)
    useLiveQuery.mockImplementation((fn) => routeQuery(fn, entries, [], LABOR_TYPES))
  }

  it('shows a frozen job name instead of "—" in the weekly by-job breakdown', () => {
    setupFrozen([frozenEntry1])
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    // The frozen job name must appear in the By-job section.
    expect(screen.getByText('Ghost Job A')).toBeInTheDocument()
    // "—" would appear if the frozen key was not resolved correctly.
    // We assert that no bare "—" label shows up in the breakdown
    // (the fallback for an unresolvable entry).
    const byJobSection = screen.getByRole('heading', { name: 'By job' }).closest('div')
    expect(byJobSection).not.toHaveTextContent('—')
  })

  it('shows two distinct rows for two different deleted jobs (no merging under null)', () => {
    setupFrozen([frozenEntry1, frozenEntry2])
    render(<TimesheetsView />)
    fireEvent.click(screen.getByRole('button', { name: 'weekly' }))
    // Both frozen job names must appear as separate rows.
    expect(screen.getByText('Ghost Job A')).toBeInTheDocument()
    expect(screen.getByText('Ghost Job B')).toBeInTheDocument()
  })
})
