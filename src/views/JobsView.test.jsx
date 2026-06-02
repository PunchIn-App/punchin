import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import JobsView from './JobsView'

const mockJobsUpdate = vi.fn().mockResolvedValue(1)
const mockJobsAdd    = vi.fn().mockResolvedValue(1)
const mockLaborTypesUpdate = vi.fn().mockResolvedValue(1)
const mockLaborTypesAdd    = vi.fn().mockResolvedValue(1)

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../db', () => ({
  db: {
    jobs: {
      get update() { return mockJobsUpdate },
      get add()    { return mockJobsAdd },
    },
    laborTypes: {
      get update() { return mockLaborTypesUpdate },
      get add()    { return mockLaborTypesAdd },
    },
  },
}))
vi.mock('../components/ColorPicker', () => ({
  default: ({ value, onChange }) => (
    <button data-testid="color-picker" onClick={() => onChange('#FF0000')}>{value}</button>
  ),
}))

const JOBS = [
  { id: 1, name: 'Acme Corp',  isActive: true,  isDeleted: false, laborTypeId: null, laborRates: {} },
  { id: 2, name: 'Old Client', isActive: false, isDeleted: false, laborTypeId: null, laborRates: {} },
]
const LABOR_TYPES = [
  { id: 1, name: 'Design', color: '#6366F1', isArchived: false },
  { id: 2, name: 'Dev',    color: '#3B82F6', isArchived: true  },
]

// useLiveQuery is called twice per render: odd calls → jobs, even calls → laborTypes
function setupMocks(jobs = JOBS, laborTypes = LABOR_TYPES) {
  let n = 0
  useLiveQuery.mockImplementation(() => (++n % 2 === 1 ? jobs : laborTypes))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('JobsView — Jobs tab', () => {
  it('renders Jobs and Labor Types tab buttons', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('tab', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Labor Types' })).toBeInTheDocument()
  })

  it('Jobs tab is selected by default', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('tab', { name: 'Jobs' })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders active job names', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('does not render archived job names by default', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.queryByText('Old Client')).not.toBeInTheDocument()
  })

  it('renders "Add Job" button', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('button', { name: /add job/i })).toBeInTheDocument()
  })

  it('shows the job form when "Add Job" is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    expect(screen.getByPlaceholderText('Job name *')).toBeInTheDocument()
  })

  it('shows archived section toggle with count', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByText(/archived \(1\)/i)).toBeInTheDocument()
  })

  it('reveals archived jobs after expanding the archived section', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByText('Old Client')).toBeInTheDocument()
  })

  it('shows Edit and Archive buttons for active jobs', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('button', { name: /edit acme corp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /archive acme corp/i })).toBeInTheDocument()
  })
})

describe('JobsView — Labor Types tab', () => {
  it('switches to the Labor Types tab', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    expect(screen.getByRole('tab', { name: 'Labor Types' })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders active labor type names', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    expect(screen.getByText('Design')).toBeInTheDocument()
  })

  it('shows "Add Labor Type" button', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    expect(screen.getByRole('button', { name: /add labor type/i })).toBeInTheDocument()
  })

  it('shows archived labor type section toggle with count', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    expect(screen.getByText(/archived \(1\)/i)).toBeInTheDocument()
  })
})

describe('JobsView — archive', () => {
  it('calls db.jobs.update with isActive=false when archive is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /archive acme corp/i }))
    await waitFor(() =>
      expect(mockJobsUpdate).toHaveBeenCalledWith(1, { isActive: false })
    )
  })
})

describe('JobsView — restore archived job', () => {
  it('reveals Restore button for archived jobs after expanding the archived section', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByRole('button', { name: /restore old client/i })).toBeInTheDocument()
  })

  it('calls db.jobs.update with isActive=true when Restore is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /restore old client/i }))
    await waitFor(() =>
      expect(mockJobsUpdate).toHaveBeenCalledWith(2, { isActive: true })
    )
  })
})

describe('JobsView — edit job', () => {
  it('shows JobForm when Edit button is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /edit acme corp/i }))
    expect(screen.getByPlaceholderText('Job name *')).toBeInTheDocument()
  })

  it('calls db.jobs.update when the edit form is saved', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /edit acme corp/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(mockJobsUpdate).toHaveBeenCalledWith(
        1, expect.objectContaining({ name: 'Acme Corp' })
      )
    )
  })

  it('hides the edit form when Cancel is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /edit acme corp/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByPlaceholderText('Job name *')).not.toBeInTheDocument()
  })
})

describe('JobsView — add job', () => {
  it('calls db.jobs.add when the add form is saved with a name', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    fireEvent.change(screen.getByPlaceholderText('Job name *'), { target: { value: 'New Client' } })
    fireEvent.click(screen.getByRole('button', { name: /^add job$/i }))
    await waitFor(() =>
      expect(mockJobsAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Client', isActive: true })
      )
    )
  })
})

describe('JobsView — Labor Types tab: add and edit', () => {
  it('shows LaborTypeForm when "Add Labor Type" is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /add labor type/i }))
    expect(screen.getByPlaceholderText('Labor type name *')).toBeInTheDocument()
  })

  it('calls db.laborTypes.add when a new labor type is saved', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /add labor type/i }))
    fireEvent.change(screen.getByPlaceholderText('Labor type name *'), { target: { value: 'Marketing' } })
    fireEvent.click(screen.getByRole('button', { name: /^add type$/i }))
    await waitFor(() =>
      expect(mockLaborTypesAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Marketing' })
      )
    )
  })

  it('shows LaborTypeForm when Edit button is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /edit design/i }))
    expect(screen.getByPlaceholderText('Labor type name *')).toBeInTheDocument()
  })

  it('calls db.laborTypes.update when a labor type is edited and saved', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /edit design/i }))
    const input = screen.getByPlaceholderText('Labor type name *')
    fireEvent.change(input, { target: { value: 'Design v2' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(mockLaborTypesUpdate).toHaveBeenCalledWith(
        1, expect.objectContaining({ name: 'Design v2' })
      )
    )
  })
})

describe('JobsView — Labor Types tab: archive and restore', () => {
  it('calls db.laborTypes.update with isArchived=true when Archive is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /archive design/i }))
    await waitFor(() =>
      expect(mockLaborTypesUpdate).toHaveBeenCalledWith(1, { isArchived: true })
    )
  })

  it('calls db.laborTypes.update with isArchived=false when Restore is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('tab', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /restore dev/i }))
    await waitFor(() =>
      expect(mockLaborTypesUpdate).toHaveBeenCalledWith(2, { isArchived: false })
    )
  })
})
