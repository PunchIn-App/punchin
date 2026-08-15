import { render, screen, fireEvent } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimerRail from './TimerRail'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({ db: {} }))

// TimerRail reads the real clock (`getWeekRange(new Date(), …)`) to decide which
// entries belong to "This week", so the fixtures below must be positioned against
// a clock the test controls. With `new Date()` they were positioned against the
// wall clock, and every run starting on a Monday between 00:00 and 00:59 put the
// "2 hours ago" / "1 hour ago" entries in the PREVIOUS week — the rail then
// rendered "No time tracked yet." and the first test failed for calendar reasons
// alone. Pinned to a Wednesday midday so no fixture can straddle a week boundary
// under either weekStartsMonday setting.
const NOW = new Date('2026-03-11T12:00:00') // Wednesday, local time
const now = NOW
const jobMap = new Map([[1, { id: 1, name: 'Acme' }], [2, { id: 2, name: 'Beta' }]])
const ltMap = new Map([[1, { id: 1, name: 'Design', color: '#5FD08A' }]])
const jobs = [
  { id: 1, name: 'Acme', isActive: true },
  { id: 2, name: 'Beta', isActive: true },
  { id: 3, name: 'Archived', isActive: false },
]
const hoursAgo = h => new Date(now.getTime() - h * 3600000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers() })

it('shows the "This week" section once completed entries load', () => {
  useLiveQuery.mockReturnValue([
    { jobId: 1, laborTypeId: 1, punchIn: hoursAgo(2), punchOut: now },
    { jobId: 2, laborTypeId: 1, punchIn: hoursAgo(1), punchOut: now },
  ])
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={null} weekStartsMonday onPunch={vi.fn()} />)
  // The week total now sits in the section overline ("This week · 3h"); per-job
  // rows render with their hours.
  expect(screen.getByText(/this week/i)).toBeInTheDocument()
  expect(screen.queryByText('No time tracked yet.')).toBeNull()
})

it('renders the given recent jobs as quick-punch buttons and calls onPunch on click', () => {
  // The rail renders the recent-jobs list it's handed (the 3-most-recent + active
  // filtering is computed upstream in TimerView); clicking forwards the job.
  useLiveQuery.mockReturnValue([])
  const onPunch = vi.fn()
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} recentJobs={[jobs[0], jobs[1]]} lastEntry={null} weekStartsMonday onPunch={onPunch} />)
  expect(screen.getByRole('button', { name: /punch in: acme/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /punch in: beta/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /punch in: acme/i }))
  expect(onPunch).toHaveBeenCalledWith(jobs[0])
})

it('renders the last session when one is provided', () => {
  useLiveQuery.mockReturnValue([])
  const lastEntry = { jobId: 2, laborTypeId: 1, punchIn: hoursAgo(1), punchOut: now }
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={lastEntry} weekStartsMonday onPunch={vi.fn()} />)
  expect(screen.getByText('Last session')).toBeInTheDocument()
})

it('shows frozen job name instead of "Unknown Job" for a permanently-deleted last-session job', () => {
  useLiveQuery.mockReturnValue([])
  // jobId 99 is not in jobMap — simulates a permanently-deleted job
  const lastEntry = {
    jobId: 99,
    laborTypeId: 1,
    punchIn: hoursAgo(1),
    punchOut: now,
    frozenRefs: { job: { name: 'Deleted Client', color: '#ff0' } },
  }
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={lastEntry} weekStartsMonday onPunch={vi.fn()} />)
  expect(screen.getByText('Deleted Client')).toBeInTheDocument()
  expect(screen.queryByText('Unknown Job')).toBeNull()
})

// ─── Week boundary ────────────────────────────────────────────────────────────
// The case that used to break the suite by accident: a clock reading Monday
// 00:30, where "an hour ago" is last week. Asserted explicitly here — and only
// here — so the boundary is covered on purpose rather than by whichever day the
// suite happens to run.
it('counts only entries on the current side of the Monday week boundary', () => {
  vi.setSystemTime(new Date('2026-03-09T00:30:00')) // a Monday, 30 min into the week
  const t = Date.now()
  useLiveQuery.mockReturnValue([
    // Sunday 23:00–23:30 — last week, must not be counted.
    { jobId: 1, laborTypeId: 1, punchIn: new Date(t - 90 * 60000), punchOut: new Date(t - 60 * 60000) },
    // Monday 00:05–00:25 — this week, 20 minutes.
    { jobId: 2, laborTypeId: 1, punchIn: new Date(t - 25 * 60000), punchOut: new Date(t - 5 * 60000) },
  ])
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={null} weekStartsMonday onPunch={vi.fn()} />)
  // The overline carries the week total; its text is split across nodes, so match
  // on the element's own textContent.
  expect(
    screen.getByText((_, el) => el?.classList.contains('ds-overline') && el.textContent === 'This week · 20m')
  ).toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  expect(screen.queryByText('Acme')).toBeNull()
})
