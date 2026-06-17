import { render, screen, fireEvent } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimerRail from './TimerRail'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({ db: {} }))

const now = new Date()
const jobMap = new Map([[1, { id: 1, name: 'Acme' }], [2, { id: 2, name: 'Beta' }]])
const ltMap = new Map([[1, { id: 1, name: 'Design', color: '#5FD08A' }]])
const jobs = [
  { id: 1, name: 'Acme', isActive: true },
  { id: 2, name: 'Beta', isActive: true },
  { id: 3, name: 'Archived', isActive: false },
]
const hoursAgo = h => new Date(now.getTime() - h * 3600000)

beforeEach(() => { vi.clearAllMocks() })

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
