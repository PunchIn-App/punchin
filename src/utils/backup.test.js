import { exportBackup, exportCsv } from './backup'

const mockJobs       = vi.fn()
const mockEntries    = vi.fn()
const mockLaborTypes = vi.fn()

vi.mock('../db', () => ({
  db: {
    jobs:       { toArray: () => mockJobs() },
    entries:    { toArray: () => mockEntries() },
    laborTypes: { toArray: () => mockLaborTypes() },
  },
}))

let lastBlob
beforeEach(() => {
  vi.clearAllMocks()
  mockJobs.mockResolvedValue([])
  mockEntries.mockResolvedValue([])
  mockLaborTypes.mockResolvedValue([])
  lastBlob = null
  global.URL.createObjectURL = vi.fn((blob) => { lastBlob = blob; return 'blob:mock' })
  global.URL.revokeObjectURL = vi.fn()
  vi.spyOn(document, 'createElement').mockReturnValue({ click: vi.fn() })
})

afterEach(() => { vi.restoreAllMocks() })

describe('exportBackup', () => {
  it('writes a JSON blob with version + all three tables', async () => {
    mockJobs.mockResolvedValue([{ id: 1, name: 'Acme' }])
    mockEntries.mockResolvedValue([{ id: 1, jobId: 1 }])
    mockLaborTypes.mockResolvedValue([{ id: 1, name: 'Design' }])
    await exportBackup()
    expect(lastBlob.type).toBe('application/json')
    const data = JSON.parse(await lastBlob.text())
    expect(data.version).toBe(1)
    expect(data.jobs).toHaveLength(1)
    expect(data.entries).toHaveLength(1)
    expect(data.laborTypes).toHaveLength(1)
  })
})

describe('exportCsv', () => {
  it('emits a header row and skips still-running entries', async () => {
    mockJobs.mockResolvedValue([{ id: 1, name: 'Acme', clientName: 'Big Co' }])
    mockLaborTypes.mockResolvedValue([{ id: 1, name: 'Design' }])
    mockEntries.mockResolvedValue([
      { id: 1, jobId: 1, laborTypeId: 1, punchIn: '2025-06-01T09:00:00.000Z', punchOut: '2025-06-01T10:00:00.000Z' },
      { id: 2, jobId: 1, laborTypeId: 1, punchIn: '2025-06-01T11:00:00.000Z', punchOut: null }, // running → skipped
    ])
    await exportCsv()
    expect(lastBlob.type).toBe('text/csv')
    const text = await lastBlob.text()
    const lines = text.split('\n')
    expect(lines[0]).toContain('Duration (h)')
    expect(lines).toHaveLength(2) // header + the one completed entry
    expect(text).toContain('Acme')
    expect(text).toContain('1.00')
  })
})
