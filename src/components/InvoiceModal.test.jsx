import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import InvoiceModal from './InvoiceModal'
import { openPrintWindow } from '../utils/printDocument'

// Printing goes through openPrintWindow (a hidden iframe, not a popup). Mock just
// that fn so these tests assert WHAT html the modal builds and hands off — the
// iframe mechanics are covered in printDocument.test.js. PRINT_FONT_HEAD and
// laborBadgeHTML stay real so the built html is faithful.
vi.mock('../utils/printDocument', async (importOriginal) => ({
  ...(await importOriginal()),
  openPrintWindow: vi.fn(() => true),
}))

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))

vi.mock('../db', () => ({
  db: { entries: { filter: vi.fn(() => ({ toArray: vi.fn() })) } },
}))

vi.mock('../hooks/usePlatformContext', () => ({
  usePlatformContext: () => ({ isStandalone: false, os: 'web' }),
}))

let mockSettings = { weekStartsMonday: true }
const mockUpdateSetting = vi.fn()
vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: mockSettings, updateSetting: mockUpdateSetting }),
}))

// A job with a rate of $100/hr for labor type 1
const JOBS = [{ id: 1, name: 'Acme Corp', clientName: 'Acme', isActive: true, laborRates: { 1: 100 } }]
const LABOR_TYPES = [{ id: 1, name: 'Design', color: '#6366F1', isArchived: false }]
// One completed entry: 1 hour
const ENTRIES = [{
  id: 1, jobId: 1, laborTypeId: 1,
  punchIn:  new Date('2025-06-01T09:00:00'),
  punchOut: new Date('2025-06-01T10:00:00'),
}]

function renderModal(props = {}) {
  return render(
    <InvoiceModal
      jobs={JOBS}
      laborTypes={LABOR_TYPES}
      currentDate={new Date('2025-06-01')}
      currentTab="weekly"
      onClose={vi.fn()}
      {...props}
    />
  )
}

// The job select is now a bespoke EntitySelect (colour dot + label/sublabel),
// not a native <select>. Open the picker by its label and click the job option.
function pickJob(name = 'Acme Corp') {
  fireEvent.click(screen.getByRole('button', { name: /^job/i }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name, 'i') }))
}

beforeEach(() => {
  vi.clearAllMocks()
  openPrintWindow.mockReturnValue(true) // clearAllMocks keeps return overrides — reset to the success default
  mockSettings = { weekStartsMonday: true }
  // Return [] when no job selected, ENTRIES when selectedJobId is non-empty (deps[2])
  useLiveQuery.mockImplementation((_fn, deps) => {
    if (deps?.[2]) return ENTRIES
    return []
  })
})

describe('InvoiceModal — rendering', () => {
  it('renders the "Create invoice" header', () => {
    renderModal()
    expect(screen.getByText('Create invoice')).toBeInTheDocument()
  })

  it('renders the job select', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /^job/i })).toBeInTheDocument()
  })

  it('renders date-range preset buttons', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument()
  })

  it('Export CSV button is initially disabled (no job selected)', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled()
  })

  it('Print button is initially disabled (no job selected)', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /print/i })).toBeDisabled()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('InvoiceModal — line items calculation', () => {
  it('displays correct hours, rate, and amount after selecting a job', async () => {
    renderModal()
    pickJob()
    // 1 hr × $100/hr = $100.00
    await waitFor(() => expect(screen.getAllByText('1.00').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1)
  })

  it('bills nearest-rounded hours when rounding is on (#208/#274)', async () => {
    mockSettings = { weekStartsMonday: true, roundingMinutes: 30, roundingMode: 'nearest' }
    useLiveQuery.mockImplementation((_fn, deps) => deps?.[2]
      ? [{ id: 9, jobId: 1, laborTypeId: 1,
           punchIn:  new Date('2025-06-01T09:05:00'),
           punchOut: new Date('2025-06-01T09:50:00') }]
      : [])
    renderModal()
    pickJob()
    // 9:05–9:50 is 45 min = 0.75 h raw. The task's DURATION rounds to the nearest
    // half hour → 1.00 h, billed at $100/hr → $100.00 (not the raw $75.00).
    await waitFor(() => expect(screen.getAllByText('1.00').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('0.75')).not.toBeInTheDocument()
  })

  it('round-up mode never rounds a short task down (#274)', async () => {
    mockSettings = { weekStartsMonday: true, roundingMinutes: 30, roundingMode: 'up' }
    useLiveQuery.mockImplementation((_fn, deps) => deps?.[2]
      ? [{ id: 9, jobId: 1, laborTypeId: 1,
           punchIn:  new Date('2025-06-01T09:00:00'),
           punchOut: new Date('2025-06-01T09:20:00') }]
      : [])
    renderModal()
    pickJob()
    // 9:00–9:20 is 20 min = 0.33 h raw. 'Nearest' would round it DOWN to 0 and
    // lose the time; 'up' rounds the duration up to the half hour → 0.50 h =
    // $50.00. This is the #274 "my real-world minutes shouldn't vanish" case.
    await waitFor(() => expect(screen.getAllByText('0.50').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1)
  })

  it('shows "—" for amount when job has no rate set for that labor type', async () => {
    const jobNoRates = [{ id: 1, name: 'No Rates Job', isActive: true, laborRates: {} }]
    renderModal({ jobs: jobNoRates })
    pickJob('No Rates Job')
    // "1.00" appears twice (line-item hours + total hours); "—" for rate and amount
    await waitFor(() => expect(screen.getAllByText('1.00').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('enables Export CSV once line items are present', async () => {
    renderModal()
    pickJob()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /export csv/i })).not.toBeDisabled()
    )
  })

  it('shows "No completed entries" when entries list is empty', async () => {
    useLiveQuery.mockImplementation(() => [])
    renderModal()
    pickJob()
    await waitFor(() =>
      expect(screen.getByText(/no completed entries/i)).toBeInTheDocument()
    )
  })

  it('shows "no rates set" hint when job has no labor rates', async () => {
    const jobNoRates = [{ id: 1, name: 'Plain Job', isActive: true, laborRates: {} }]
    useLiveQuery.mockImplementation(() => [])
    renderModal({ jobs: jobNoRates })
    pickJob('Plain Job')
    await waitFor(() =>
      expect(screen.getByText(/no hourly rates set/i)).toBeInTheDocument()
    )
  })
})

describe('InvoiceModal — period presets', () => {
  it('selects "Last week" preset', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /last week/i }))
    expect(screen.getByRole('button', { name: /last week/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects "This month" preset', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /this month/i }))
    expect(screen.getByRole('button', { name: /this month/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects "Last month" preset', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /last month/i }))
    expect(screen.getByRole('button', { name: /last month/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows custom date pickers when "Custom" preset is selected', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
    expect(screen.getByRole('button', { name: /custom start/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom end/i })).toBeInTheDocument()
  })

  it('custom date pickers accept values', () => {
    // Pin "now" so the empty pickers open on a known month and the day cells exist.
    vi.useFakeTimers(); vi.setSystemTime(new Date('2025-06-15T12:00:00'))
    try {
      renderModal()
      fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
      fireEvent.click(screen.getByRole('button', { name: /custom start/i }))
      fireEvent.click(screen.getByRole('button', { name: 'June 1, 2025' }))
      fireEvent.click(screen.getByRole('button', { name: /custom end/i }))
      fireEvent.click(screen.getByRole('button', { name: 'June 30, 2025' }))
      expect(screen.getByRole('button', { name: /custom start: jun 1, 2025/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom end: jun 30, 2025/i })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clips the custom end to an inclusive end-of-day (23:59:59.999) (#157)', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2025-06-15T12:00:00'))
    try {
      let capturedDeps
      useLiveQuery.mockImplementation((_fn, deps) => { capturedDeps = deps; return [] })
      renderModal()
      fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
      fireEvent.click(screen.getByRole('button', { name: /custom start/i }))
      fireEvent.click(screen.getByRole('button', { name: 'June 1, 2025' }))
      fireEvent.click(screen.getByRole('button', { name: /custom end/i }))
      fireEvent.click(screen.getByRole('button', { name: 'June 30, 2025' }))
      // deps = [start.getTime(), end.getTime(), selectedJobId]; end must be 23:59:59.999
      const end = new Date(capturedDeps[1])
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
      expect(end.getMilliseconds()).toBe(999)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('InvoiceModal — export and print', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls URL.createObjectURL when Export CSV is clicked with line items', async () => {
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /export csv/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('hands the print document to openPrintWindow when Print is clicked with line items', async () => {
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(openPrintWindow).toHaveBeenCalled()
  })

  it('alerts instead of throwing when printing fails (openPrintWindow → false) (#150)', async () => {
    openPrintWindow.mockReturnValue(false)
    global.alert = vi.fn()
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    expect(() => fireEvent.click(screen.getByRole('button', { name: /print/i }))).not.toThrow()
    expect(global.alert).toHaveBeenCalled()
  })

  it('prints the invoice in the Noto brand font, loading the webfont (not the system-UI fallback)', async () => {
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain("font-family: 'Noto Sans', sans-serif")
    expect(html).toContain("'Noto Sans Mono', monospace")
    expect(html).toContain("'Noto Sans Display'")
    expect(html).toContain('/fonts/noto-sans-latin-wght-normal.woff2')
    expect(html).not.toContain('-apple-system')
    expect(html).not.toContain('SF Mono')
  })

  it('renders the Billed-from band + invoice number in the print HTML when configured', async () => {
    mockSettings = { weekStartsMonday: true, billingName: 'Jane Doe', billingEmail: 'jane@example.com', numberInvoices: true, invoicePrefix: 'PI-', nextInvoiceNumber: 7 }
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('Billed from')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('Billed to')
    expect(html).toContain('PI-007') // prefix + zero-padded nextInvoiceNumber
    expect(html).toContain('<svg')   // line items carry a labor glyph badge
    expect(html).toContain('Amount due') // paperfoot total band
  })

  it('renders the business logo in the print band when set', async () => {
    mockSettings = { weekStartsMonday: true, billingName: 'Jane Doe', billingLogo: 'data:image/png;base64,LOGO123' }
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('data:image/png;base64,LOGO123')
  })

  it('lets the user override the invoice number; the printout + counter follow it', async () => {
    mockSettings = { weekStartsMonday: true, numberInvoices: true, invoicePrefix: 'PI-', nextInvoiceNumber: 7 }
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.change(screen.getByLabelText('Invoice number'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('PI-050')                                    // printed number follows the edit
    expect(mockUpdateSetting).toHaveBeenCalledWith('nextInvoiceNumber', 51) // counter advances to edited + 1
  })

  it('accepts a custom alphanumeric invoice number; prints it verbatim and leaves the counter untouched', async () => {
    // The number field allows letters/symbols (e.g. a per-client code) on top of
    // plain numbers. A non-numeric value is used as-is (no zero-padding) and the
    // auto-increment counter must NOT advance (you can't "+1" a string).
    mockSettings = { weekStartsMonday: true, numberInvoices: true, invoicePrefix: 'PI-', nextInvoiceNumber: 7 }
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    const field = screen.getByLabelText('Invoice number')
    fireEvent.change(field, { target: { value: 'INV-2024-A' } })
    expect(field).toHaveValue('INV-2024-A')                 // letters kept, not coerced to a number
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('PI-INV-2024-A')                 // prefix + verbatim value, no zero-padding
    expect(mockUpdateSetting).not.toHaveBeenCalledWith('nextInvoiceNumber', expect.anything())
  })

  it('advances nextInvoiceNumber when a numbered invoice is generated', async () => {
    mockSettings = { weekStartsMonday: true, numberInvoices: true, invoicePrefix: 'PI-', nextInvoiceNumber: 7 }
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('nextInvoiceNumber', 8)
  })

  it('printed invoice badge shows the labor glyph (svg) and labor name, not colour-only', async () => {
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Design')
  })

  it('invoices a whole client — aggregates entries across the client’s jobs with per-job rates', async () => {
    // Two jobs for the same client at different rates; selecting the client bills
    // them together, each entry priced at ITS OWN job's rate (not one shared rate).
    const jobsTwo = [
      { id: 1, name: 'Acme Web', clientName: 'Acme', isActive: true, laborRates: { 1: 100 } },
      { id: 2, name: 'Acme App', clientName: 'Acme', isActive: true, laborRates: { 1: 150 } },
    ]
    const entriesTwo = [
      { id: 1, jobId: 1, laborTypeId: 1, punchIn: new Date('2025-06-01T09:00:00'), punchOut: new Date('2025-06-01T10:00:00') }, // 1h @ $100 = 100
      { id: 2, jobId: 2, laborTypeId: 1, punchIn: new Date('2025-06-02T09:00:00'), punchOut: new Date('2025-06-02T11:00:00') }, // 2h @ $150 = 300
    ]
    useLiveQuery.mockImplementation((_fn, deps) => (deps?.[2] ? entriesTwo : []))
    render(<InvoiceModal jobs={jobsTwo} laborTypes={LABOR_TYPES} currentDate={new Date('2025-06-01')} currentTab="weekly" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^job/i }))
    fireEvent.click(screen.getByRole('option', { name: /whole client/i })) // the "Acme · whole client" option
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    const html = openPrintWindow.mock.calls[0][0]
    expect(html).toContain('Acme')        // billed to the client
    expect(html).toContain('Acme Web')    // each job shown (per-job column)
    expect(html).toContain('Acme App')
    expect(html).toContain('3.00')        // total hours 1 + 2
    expect(html).toContain('400')         // total amount 100 + 300
  })

  it('does not advance the number when printing fails to open', async () => {
    mockSettings = { weekStartsMonday: true, numberInvoices: true, invoicePrefix: 'PI-', nextInvoiceNumber: 7 }
    openPrintWindow.mockReturnValue(false)
    global.alert = vi.fn()
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(mockUpdateSetting).not.toHaveBeenCalledWith('nextInvoiceNumber', expect.anything())
  })
})

describe('InvoiceModal — backdrop and label', () => {
  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn()
    const { container } = renderModal({ onClose })
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows job name and client name in the invoice header once a job is selected', async () => {
    renderModal()
    pickJob()
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1))
  })

  it('initialises to "Custom" preset when currentTab is "daily"', () => {
    renderModal({ currentTab: 'daily' })
    expect(screen.getByRole('button', { name: /^custom$/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
