import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLiveQuery } from 'dexie-react-hooks'
import JobsView from './JobsView'

const mockJobsUpdate = vi.fn().mockResolvedValue(1)
const mockJobsAdd    = vi.fn().mockResolvedValue(1)
const mockLaborTypesUpdate = vi.fn().mockResolvedValue(1)
const mockLaborTypesAdd    = vi.fn().mockResolvedValue(1)
const mockDeleteJob         = vi.fn().mockResolvedValue(undefined)
const mockDeleteLaborType   = vi.fn().mockResolvedValue(undefined)
const mockJobsUsingLaborType = vi.fn().mockResolvedValue([])

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
  get deleteJob()           { return mockDeleteJob },
  get deleteLaborType()     { return mockDeleteLaborType },
  get jobsUsingLaborType()  { return mockJobsUsingLaborType },
}))
vi.mock('../components/ColorPicker', () => ({
  default: ({ value, onChange }) => (
    <button data-testid="color-picker" onClick={() => onChange('#FF0000')}>{value}</button>
  ),
}))

const JOBS = [
  { id: 1, name: 'Acme Corp',  isActive: true,  laborTypeId: null, laborRates: {} },
  { id: 2, name: 'Old Client', isActive: false, laborTypeId: null, laborRates: {} },
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
    expect(screen.getByRole('button', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Labor Types' })).toBeInTheDocument()
  })

  it('Jobs tab is selected by default', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-pressed', 'true')
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
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    expect(screen.getByRole('button', { name: 'Labor Types' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders active labor type names', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    expect(screen.getByText('Design')).toBeInTheDocument()
  })

  it('shows "Add Labor Type" button', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    expect(screen.getByRole('button', { name: /add labor type/i })).toBeInTheDocument()
  })

  it('shows archived labor type section toggle with count', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
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

describe('JobsView — default labor type picker', () => {
  it('selects a default labor type via the EntitySelect picker', () => {
    setupMocks(
      JOBS,
      [
        { id: 1, name: 'Design', color: '#6366F1', isArchived: false },
        { id: 3, name: 'Dev',    color: '#3B82F6', isArchived: false },
      ],
    )
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))

    // The default-labor-type control is now a bespoke EntitySelect, not a
    // native <select>. Open it by its trigger, then click an option by role.
    fireEvent.click(screen.getByRole('button', { name: /default labor type/i }))
    fireEvent.click(screen.getByRole('option', { name: /design/i }))

    // The trigger's accessible name reflects the chosen labor type.
    expect(
      screen.getByRole('button', { name: /default labor type, design/i })
    ).toBeInTheDocument()
  })
})

describe('JobsView — job color', () => {
  it('renders a color picker in the job add form', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    expect(screen.getByTestId('color-picker')).toBeInTheDocument()
  })

  it('persists the chosen color when adding a job', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    fireEvent.change(screen.getByPlaceholderText('Job name *'), { target: { value: 'Tinted Co' } })
    fireEvent.click(screen.getByTestId('color-picker')) // mock → onChange('#FF0000')
    fireEvent.click(screen.getByRole('button', { name: /^add job$/i }))
    await waitFor(() =>
      expect(mockJobsAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tinted Co', color: '#FF0000' })
      )
    )
  })

  it("uses the job's own color for the card rail, overriding its labor type", () => {
    setupMocks(
      [{ id: 1, name: 'Acme Corp', isActive: true, laborTypeId: 1, laborRates: {}, color: '#FF0000' }],
      [{ id: 1, name: 'Design', color: '#6366F1', isArchived: false }],
    )
    const { container } = render(<JobsView />)
    const rail = container.querySelector('div.absolute.w-1')
    expect(rail).toBeTruthy()
    expect(rail.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('falls back to the labor type color when the job has no color', () => {
    setupMocks(
      [{ id: 1, name: 'Acme Corp', isActive: true, laborTypeId: 1, laborRates: {} }],
      [{ id: 1, name: 'Design', color: '#6366F1', isArchived: false }],
    )
    const { container } = render(<JobsView />)
    const rail = container.querySelector('div.absolute.w-1')
    expect(rail.style.backgroundColor).toBe('rgb(99, 102, 241)')
  })
})

describe('JobsView — Labor Types tab: add and edit', () => {
  it('shows LaborTypeForm when "Add Labor Type" is clicked', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /add labor type/i }))
    expect(screen.getByPlaceholderText('Labor type name *')).toBeInTheDocument()
  })

  it('calls db.laborTypes.add when a new labor type is saved', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /edit design/i }))
    expect(screen.getByPlaceholderText('Labor type name *')).toBeInTheDocument()
  })

  it('calls db.laborTypes.update when a labor type is edited and saved', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
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

describe('JobsView — accessible names (WCAG 4.1.2)', () => {
  it('exposes the job-name and client-name inputs by accessible name', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    expect(screen.getByRole('textbox', { name: 'Job name' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Client name' })).toBeInTheDocument()
  })

  it('exposes each hourly-rate input with a distinct, labor-type-specific accessible name', () => {
    setupMocks(
      JOBS,
      [
        { id: 1, name: 'Design', color: '#6366F1', isArchived: false },
        { id: 3, name: 'Dev',    color: '#3B82F6', isArchived: false },
      ],
    )
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    // Expand the optional hourly-rates section.
    fireEvent.click(screen.getByRole('button', { name: /hourly rates/i }))
    expect(
      screen.getByLabelText('Hourly rate for Design in dollars per hour')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Hourly rate for Dev in dollars per hour')
    ).toBeInTheDocument()
  })

  it('exposes the labor-type-name input by accessible name', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /add labor type/i }))
    expect(screen.getByRole('textbox', { name: 'Labor type name' })).toBeInTheDocument()
  })

  it('exposes the archived-jobs search input by accessible name', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByRole('textbox', { name: 'Search archived jobs' })).toBeInTheDocument()
  })

  it('exposes the archived-labor-types search input by accessible name', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByRole('textbox', { name: 'Search archived labor types' })).toBeInTheDocument()
  })
})

describe('JobsView — empty-name validation (WCAG 3.3.1)', () => {
  it('JobForm surfaces an alert and does not create a job when name is empty', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    fireEvent.click(screen.getByRole('button', { name: /^add job$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/enter a job name/i)
    expect(mockJobsAdd).not.toHaveBeenCalled()
    // The name field is marked invalid and points at the alert.
    expect(screen.getByRole('textbox', { name: 'Job name' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('JobForm clears the alert once the user edits the name', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: /add job/i }))
    fireEvent.click(screen.getByRole('button', { name: /^add job$/i }))
    await screen.findByRole('alert')
    fireEvent.change(screen.getByRole('textbox', { name: 'Job name' }), { target: { value: 'X' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('LaborTypeForm surfaces an alert and does not create a type when name is empty', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /add labor type/i }))
    fireEvent.click(screen.getByRole('button', { name: /^add type$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/enter a labor type name/i)
    expect(mockLaborTypesAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Labor type name' })).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('JobsView — Labor Types tab: archive and restore', () => {
  it('calls db.laborTypes.update with isArchived=true when Archive is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByRole('button', { name: /archive design/i }))
    await waitFor(() =>
      expect(mockLaborTypesUpdate).toHaveBeenCalledWith(1, { isArchived: true })
    )
  })

  it('calls db.laborTypes.update with isArchived=false when Restore is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /restore dev/i }))
    await waitFor(() =>
      expect(mockLaborTypesUpdate).toHaveBeenCalledWith(2, { isArchived: false })
    )
  })
})

// ─── Section switcher is a toggle-button group, not a tablist (WCAG 4.1.2) ─────

describe('JobsView — section switcher ARIA (WCAG 4.1.2)', () => {
  it('wraps the Jobs/Labor Types buttons in a labelled group, with no tab/tablist roles', () => {
    setupMocks()
    render(<JobsView />)
    // The switcher is a labelled toggle-button group (aria-pressed), not an
    // incomplete ARIA tablist (which would also need tabpanels + arrow keys).
    const group = screen.getByRole('group', { name: 'Manage' })
    expect(group).toBeInTheDocument()
    expect(group).toContainElement(screen.getByRole('button', { name: 'Jobs' }))
    expect(group).toContainElement(screen.getByRole('button', { name: 'Labor Types' }))
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('marks the active section button aria-pressed="true" and the other "false"', () => {
    setupMocks()
    render(<JobsView />)
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Labor Types' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Labor Types' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('JobsView — permanent delete: archived jobs', () => {
  it('shows a Delete button for archived jobs after expanding the archived section', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByRole('button', { name: /delete old client permanently/i })).toBeInTheDocument()
  })

  it('opens a confirm modal when the Delete button is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete old client permanently/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/permanently delete "old client"/i)).toBeInTheDocument()
  })

  it('calls deleteJob and closes the modal when Delete permanently is confirmed', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete old client permanently/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }))
    await waitFor(() => expect(mockDeleteJob).toHaveBeenCalledWith(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the modal without deleting when Cancel is clicked', async () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete old client permanently/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockDeleteJob).not.toHaveBeenCalled()
  })
})

describe('JobsView — permanent delete: archived labor types', () => {
  it('shows a Delete button for archived labor types after expanding the archived section', () => {
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    expect(screen.getByRole('button', { name: /delete dev permanently/i })).toBeInTheDocument()
  })

  it('opens a confirm modal when no live jobs use the labor type', async () => {
    mockJobsUsingLaborType.mockResolvedValueOnce([])
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete dev permanently/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/permanently delete "dev"/i)).toBeInTheDocument()
  })

  it('calls deleteLaborType and closes the modal when Delete permanently is confirmed', async () => {
    mockJobsUsingLaborType.mockResolvedValueOnce([])
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete dev permanently/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }))
    await waitFor(() => expect(mockDeleteLaborType).toHaveBeenCalledWith(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a block modal listing the live jobs when the labor type is still in use', async () => {
    mockJobsUsingLaborType.mockResolvedValueOnce([{ id: 1, name: 'BlockerJob' }])
    setupMocks()
    render(<JobsView />)
    fireEvent.click(screen.getByRole('button', { name: 'Labor Types' }))
    fireEvent.click(screen.getByText(/archived \(1\)/i))
    fireEvent.click(screen.getByRole('button', { name: /delete dev permanently/i }))
    expect(await screen.findByText(/BlockerJob/)).toBeInTheDocument()
    expect(mockDeleteLaborType).not.toHaveBeenCalled()
  })
})
