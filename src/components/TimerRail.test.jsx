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
  expect(screen.getByText('tracked this week')).toBeInTheDocument()
  expect(screen.queryByText('—')).toBeNull() // a total rendered, not the loading dash
})

it('lists only active jobs for quick punch and calls onPunch on click', () => {
  useLiveQuery.mockReturnValue([])
  const onPunch = vi.fn()
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={null} weekStartsMonday onPunch={onPunch} />)
  expect(screen.queryByRole('button', { name: /punch in: archived/i })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /punch in: acme/i }))
  expect(onPunch).toHaveBeenCalledWith(jobs[0])
})

it('renders the last session when one is provided', () => {
  useLiveQuery.mockReturnValue([])
  const lastEntry = { jobId: 2, laborTypeId: 1, punchIn: hoursAgo(1), punchOut: now }
  render(<TimerRail jobMap={jobMap} ltMap={ltMap} jobs={jobs} lastEntry={lastEntry} weekStartsMonday onPunch={vi.fn()} />)
  expect(screen.getByText('Last session')).toBeInTheDocument()
})
