import { render, screen, fireEvent, within } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import AnalyticsView from './AnalyticsView'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({ db: {} }))
// useSettings calls useLiveQuery internally; mock it so the 3-call queue below
// stays aligned with AnalyticsView's own entries/jobs/laborTypes queries.
vi.mock('../hooks/useSettings', () => ({ useSettings: () => ({ settings: {} }) }))
vi.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }) => <div>{children}</div>,
  Cell: () => null,
  LabelList: () => null,
}))

const JOBS = [{ id: 1, name: 'Acme Corp' }]
const LABOR_TYPES = [{ id: 1, name: 'Design', color: '#6366F1' }]
const ENTRIES = [
  {
    id: 1, jobId: 1, laborTypeId: 1,
    punchIn: new Date(Date.now() - 2 * 3600000),
    punchOut: new Date(),
  },
]

// 3 useLiveQuery calls per render: entries, jobs, laborTypes
function setupMocks({ entries = ENTRIES, jobs = JOBS, laborTypes = LABOR_TYPES } = {}) {
  const queue = [entries, jobs, laborTypes]
  let n = 0
  useLiveQuery.mockImplementation(() => queue[n++ % 3])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AnalyticsView — loading state', () => {
  it('shows "Loading…" when entries query returns undefined', () => {
    const queue = [undefined, JOBS, LABOR_TYPES]
    let n = 0
    useLiveQuery.mockImplementation(() => queue[n++ % 3])
    render(<AnalyticsView />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('has aria-busy="true" on the loading container', () => {
    const queue = [undefined, JOBS, LABOR_TYPES]
    let n = 0
    useLiveQuery.mockImplementation(() => queue[n++ % 3])
    render(<AnalyticsView />)
    expect(screen.getByText('Loading…').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
  })
})

describe('AnalyticsView — period toggle', () => {
  it('renders "Last 7 days" and "Last 30 days" buttons', () => {
    setupMocks()
    render(<AnalyticsView />)
    expect(screen.getByRole('button', { name: '7 days' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 days' })).toBeInTheDocument()
  })

  it('"Last 7 days" is active (aria-pressed=true) by default', () => {
    setupMocks()
    render(<AnalyticsView />)
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to 30d when that button is clicked', () => {
    setupMocks()
    render(<AnalyticsView />)
    fireEvent.click(screen.getByRole('button', { name: '30 days' }))
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('AnalyticsView — summary cards', () => {
  it('shows "Total logged" summary card', () => {
    setupMocks()
    render(<AnalyticsView />)
    expect(screen.getByText(/total logged/i)).toBeInTheDocument()
  })

  it('shows "Avg / day" summary card', () => {
    setupMocks()
    render(<AnalyticsView />)
    expect(screen.getByText(/avg \/ day/i)).toBeInTheDocument()
  })

  it('shows "Hours per day" chart heading', () => {
    setupMocks()
    render(<AnalyticsView />)
    expect(screen.getByText(/hours per day/i)).toBeInTheDocument()
  })
})

describe('AnalyticsView — empty state', () => {
  it('shows empty-state message when no entries exist', () => {
    setupMocks({ entries: [] })
    render(<AnalyticsView />)
    expect(screen.getByText(/no entries in this period/i)).toBeInTheDocument()
  })

  it('shows "Punch in to see analytics." when entries are empty', () => {
    setupMocks({ entries: [] })
    render(<AnalyticsView />)
    expect(screen.getByText('Punch in to see analytics.')).toBeInTheDocument()
  })
})

describe('AnalyticsView — daily chart bucketing (#140)', () => {
  it('splits a cross-midnight entry across both local days instead of dumping it on one', () => {
    // Yesterday 23:00 → today 01:00 = 2h total, one hour on each calendar day.
    const y23 = new Date(); y23.setDate(y23.getDate() - 1); y23.setHours(23, 0, 0, 0)
    const t01 = new Date(); t01.setHours(1, 0, 0, 0)
    setupMocks({ entries: [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: y23, punchOut: t01 }] })
    render(<AnalyticsView />)
    // The sr-only daily table is the deterministic view of the bucket data
    // (recharts is mocked out). Old behaviour put the whole 2h on the start day;
    // per-day clipping yields ~1h on each of the two days.
    const table = within(screen.getByText(/daily hours for the last/i).closest('table'))
    expect(table.queryByText('2h')).not.toBeInTheDocument()
    expect(table.getAllByText('1h').length).toBeGreaterThanOrEqual(2)
  })
})

// --------------------------------------------------------------------------
// Additional fixtures for multi-job / multi-labor-type tests
// --------------------------------------------------------------------------

const NOW = Date.now()

const JOBS_MULTI = [
  { id: 1, name: 'Acme Corp', isActive: true },
  { id: 2, name: 'Beta Inc', isActive: true },
]

const LABOR_TYPES_MULTI = [
  { id: 1, name: 'Design', color: '#6366F1' },
  { id: 2, name: 'Dev', color: '#3B82F6' },
]

const ENTRIES_MULTI = [
  {
    id: 1,
    jobId: 1,
    laborTypeId: 1,
    punchIn:  new Date(NOW - 3600000 * 25),
    punchOut: new Date(NOW - 3600000 * 24),
  },
  {
    id: 2,
    jobId: 2,
    laborTypeId: 2,
    punchIn:  new Date(NOW - 3600000 * 49),
    punchOut: new Date(NOW - 3600000 * 47),
  },
]

// Routing-strategy mock: entries call identified by deps.length > 0 (period string);
// the two deps=[] calls alternate via counter.
function setupMocksByDeps({ entries = [], jobs = [], laborTypes = [] } = {}) {
  let n = 0
  useLiveQuery.mockImplementation((_fn, deps) => {
    if (deps && deps.length > 0) return entries
    return ++n % 2 === 1 ? jobs : laborTypes
  })
}

describe('AnalyticsView — with entries', () => {
  beforeEach(() => {
    setupMocksByDeps({ entries: ENTRIES_MULTI, jobs: JOBS_MULTI, laborTypes: LABOR_TYPES_MULTI })
  })

  it('renders the sr-only "Daily hours for…" caption', () => {
    render(<AnalyticsView />)
    expect(screen.getByText(/daily hours for the last/i)).toBeInTheDocument()
  })

  it('renders the "Hours by job" caption in the sr-only jobs table', () => {
    render(<AnalyticsView />)
    // Two elements carry this text: the visible heading <p> and the sr-only <caption>
    const matches = screen.getAllByText('Hours by job')
    expect(matches.length).toBeGreaterThanOrEqual(1)
    // At least one is a <caption> element (the sr-only accessible table)
    expect(matches.some(el => el.tagName.toLowerCase() === 'caption')).toBe(true)
  })

  it('renders job name "Acme Corp" in the sr-only jobs table', () => {
    render(<AnalyticsView />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('renders job name "Beta Inc" in the sr-only jobs table', () => {
    render(<AnalyticsView />)
    expect(screen.getByText('Beta Inc')).toBeInTheDocument()
  })

  it('renders labor type name "Design" in the legend', () => {
    render(<AnalyticsView />)
    // Appears in the (aria-hidden) legend AND the sr-only labor-type table.
    expect(screen.getAllByText('Design').length).toBeGreaterThanOrEqual(1)
  })

  it('renders labor type name "Dev" in the legend', () => {
    render(<AnalyticsView />)
    expect(screen.getAllByText('Dev').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the "By labor type" section label', () => {
    render(<AnalyticsView />)
    expect(screen.getByText('By labor type')).toBeInTheDocument()
  })
})

describe('AnalyticsView — billable earnings', () => {
  const now = new Date()
  const hoursAgo = h => new Date(now.getTime() - h * 3600000)

  it('shows total earnings when the job has a rate for the entry', () => {
    setupMocks({
      entries: [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: hoursAgo(2), punchOut: now }],
      jobs: [{ id: 1, name: 'Acme', laborRates: { 1: 50 } }],
      laborTypes: [{ id: 1, name: 'Design', color: '#5FD08A' }],
    })
    render(<AnalyticsView />)
    expect(screen.getByText('Billable earnings')).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument() // 2h × 50
  })

  it('hides the earnings card when no rate is set', () => {
    setupMocks({
      entries: [{ id: 1, jobId: 1, laborTypeId: 1, punchIn: hoursAgo(1), punchOut: now }],
      jobs: [{ id: 1, name: 'Acme', laborRates: {} }],
      laborTypes: [{ id: 1, name: 'Design', color: '#5FD08A' }],
    })
    render(<AnalyticsView />)
    expect(screen.queryByText('Billable earnings')).toBeNull()
  })
})

// --------------------------------------------------------------------------
// Chart ARIA semantics for AT (WCAG 1.1.1)
// --------------------------------------------------------------------------
describe('AnalyticsView — chart ARIA semantics (#1.1.1)', () => {
  beforeEach(() => {
    setupMocksByDeps({ entries: ENTRIES_MULTI, jobs: JOBS_MULTI, laborTypes: LABOR_TYPES_MULTI })
  })

  it('no role="img" figure carries aria-labelledby (the rich aria-label is the accessible name)', () => {
    const { container } = render(<AnalyticsView />)
    const figures = container.querySelectorAll('[role="img"]')
    // Daily + job bars + labor-type donut.
    expect(figures.length).toBe(3)
    figures.forEach(fig => {
      expect(fig).not.toHaveAttribute('aria-labelledby')
      // The rich aria-label is preserved.
      expect(fig.getAttribute('aria-label')).toBeTruthy()
    })
  })

  it('keeps the rich (not the short-heading) aria-label on each chart figure', () => {
    const { container } = render(<AnalyticsView />)
    const labels = Array.from(container.querySelectorAll('[role="img"]')).map(f => f.getAttribute('aria-label'))
    expect(labels.some(l => /daily hours for the last/i.test(l))).toBe(true)
    expect(labels.some(l => /hours by job\. top job:/i.test(l))).toBe(true)
    expect(labels.some(l => /donut chart: hours by labor type/i.test(l))).toBe(true)
  })

  it('no sr-only data table is a descendant of a role="img" element (VoiceOver prunes them)', () => {
    const { container } = render(<AnalyticsView />)
    const tables = container.querySelectorAll('table.sr-only')
    // Daily + job + labor-type fallbacks.
    expect(tables.length).toBe(3)
    tables.forEach(t => {
      expect(t.closest('[role="img"]')).toBeNull()
    })
  })

  it('gives the donut chart its own sr-only data table (its legend is aria-hidden)', () => {
    render(<AnalyticsView />)
    const caption = screen.getByText('Hours by labor type')
    expect(caption.tagName.toLowerCase()).toBe('caption')
    const table = within(caption.closest('table'))
    // Per-labor-type rows: name + duration, matching the bar tables' shape.
    expect(table.getByText('Design')).toBeInTheDocument()
    expect(table.getByText('Dev')).toBeInTheDocument()
    expect(caption.closest('table').closest('[role="img"]')).toBeNull()
  })
})

// --------------------------------------------------------------------------
// Frozen-ref rendering — permanently-deleted jobs / labor types still show
// --------------------------------------------------------------------------
describe('AnalyticsView — frozen job / labor-type breakdown (#permanent-delete)', () => {
  const NOW = Date.now()
  const hoursAgo = h => new Date(NOW - h * 3600000)

  it('includes a frozen-job entry in the Hours-by-job sr-only table', () => {
    // The live jobs list has no job with id 99; the entry carries a frozenRefs.job
    // snapshot. The deleted job's name must appear in the breakdown.
    const entries = [{
      id: 10, jobId: 99, laborTypeId: 1,
      punchIn: hoursAgo(2), punchOut: hoursAgo(1),
      frozenRefs: { job: { name: 'Ghost Job', color: '#aabbcc' } },
    }]
    setupMocksByDeps({ entries, jobs: [], laborTypes: [{ id: 1, name: 'Design', color: '#6366F1' }] })
    render(<AnalyticsView />)
    // The sr-only jobs table should contain the frozen job name.
    // "Hours by job" appears in both the visible <p> heading and the sr-only <caption>.
    const captions = screen.getAllByText('Hours by job')
    const caption = captions.find(el => el.tagName.toLowerCase() === 'caption')
    const table = within(caption.closest('table'))
    expect(table.getByText('Ghost Job')).toBeInTheDocument()
    expect(table.getByText('1h')).toBeInTheDocument() // ~1 h
  })

  it('includes a frozen-labor-type entry in the By-labor-type sr-only table', () => {
    // The live labor types list has no lt with id 77; the entry has frozenRefs.laborType.
    const entries = [{
      id: 11, jobId: 1, laborTypeId: 77,
      punchIn: hoursAgo(3), punchOut: hoursAgo(1),
      frozenRefs: { laborType: { name: 'Old Design', color: '#ff9900', glyph: 'pen-line' } },
    }]
    setupMocksByDeps({ entries, jobs: [{ id: 1, name: 'Acme' }], laborTypes: [] })
    render(<AnalyticsView />)
    // "By labor type" is the visible heading; "Hours by labor type" is the sr-only caption.
    const captions = screen.getAllByText('Hours by labor type')
    const caption = captions.find(el => el.tagName.toLowerCase() === 'caption')
    const table = within(caption.closest('table'))
    expect(table.getByText('Old Design')).toBeInTheDocument()
    expect(table.getByText('2h')).toBeInTheDocument() // ~2 h
  })

  it('does NOT double-count an entry whose job is still live', () => {
    // A live job entry should only appear once (in the live jobData), not also via frozen.
    const entries = [{
      id: 12, jobId: 1, laborTypeId: 1,
      punchIn: hoursAgo(2), punchOut: hoursAgo(1),
      frozenRefs: { job: { name: 'Acme Corp', color: '#aabbcc' } }, // ignored — job is live
    }]
    setupMocksByDeps({
      entries,
      jobs: [{ id: 1, name: 'Acme Corp', color: '#aabbcc' }],
      laborTypes: [{ id: 1, name: 'Design', color: '#6366F1' }],
    })
    render(<AnalyticsView />)
    // "Hours by job" appears in both the visible <p> heading and the sr-only <caption>.
    const captions = screen.getAllByText('Hours by job')
    const caption = captions.find(el => el.tagName.toLowerCase() === 'caption')
    const table = within(caption.closest('table'))
    // Only one "Acme Corp" row, not two
    expect(table.getAllByText('Acme Corp').length).toBe(1)
  })
})
