import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataTransfer from './DataTransfer'

const mockExport = vi.fn()
const mockImport = vi.fn()
vi.mock('../sync/syncManager', () => ({
  exportSnapshot: (...a) => mockExport(...a),
  importSnapshot: (...a) => mockImport(...a),
}))

// qrcode-generator touches canvas-ish APIs; stub it to a predictable data URL.
vi.mock('qrcode-generator', () => ({
  default: () => ({
    addData: vi.fn(),
    make: vi.fn(),
    createDataURL: () => 'data:image/gif;base64,QR',
  }),
}))

const snapshot = {
  version: 1,
  jobs: [{ id: 1, name: 'Acme' }],
  entries: [{ id: 1, jobId: 1, punchIn: '2026-06-01T09:00:00.000Z', punchOut: '2026-06-01T10:00:00.000Z' }],
  laborTypes: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExport.mockResolvedValue(snapshot)
  mockImport.mockResolvedValue(1)
})

describe('DataTransfer — share', () => {
  it('renders the share and import sections', () => {
    render(<DataTransfer />)
    expect(screen.getByText('Share to another device')).toBeInTheDocument()
    expect(screen.getByText('Import from a link')).toBeInTheDocument()
  })

  it('generates a share link and QR code', async () => {
    render(<DataTransfer />)
    fireEvent.click(screen.getByRole('button', { name: /create share link/i }))
    const input = await screen.findByLabelText('Share link')
    expect(input.value).toContain('#import=')
    expect(mockExport).toHaveBeenCalled()
    expect(screen.getByAltText(/QR code/i)).toBeInTheDocument()
    expect(screen.getByText(/Includes 1 job and 1 entry/i)).toBeInTheDocument()
  })

  it('enlarges the QR in a lightbox and closes it on Escape', async () => {
    render(<DataTransfer />)
    fireEvent.click(screen.getByRole('button', { name: /create share link/i }))
    await screen.findByLabelText('Share link')
    fireEvent.click(screen.getByRole('button', { name: /enlarge qr code/i }))
    expect(screen.getByRole('dialog', { name: /share qr code/i })).toBeInTheDocument()
    expect(screen.getAllByAltText(/QR code/i)).toHaveLength(2) // thumbnail + lightbox
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /share qr code/i })).not.toBeInTheDocument()
  })

  it('closes the enlarged QR on a backdrop tap', async () => {
    render(<DataTransfer />)
    fireEvent.click(screen.getByRole('button', { name: /create share link/i }))
    await screen.findByLabelText('Share link')
    fireEvent.click(screen.getByRole('button', { name: /enlarge qr code/i }))
    fireEvent.click(screen.getByRole('dialog', { name: /share qr code/i })) // the scrim itself
    expect(screen.queryByRole('dialog', { name: /share qr code/i })).not.toBeInTheDocument()
  })
})

describe('DataTransfer — import', () => {
  it('rejects junk input without calling import', async () => {
    render(<DataTransfer />)
    fireEvent.change(screen.getByLabelText(/share link to import/i), { target: { value: 'not-a-link' } })
    fireEvent.click(screen.getByRole('button', { name: /^import data$/i }))
    await waitFor(() => expect(screen.getByText(/Paste a PunchIn share link or code first/i)).toBeInTheDocument())
    expect(mockImport).not.toHaveBeenCalled()
  })

  it('imports a valid pasted share link and reports the count', async () => {
    // Build a real code so decode works end-to-end through the component.
    const { encodeSnapshot, buildShareUrl } = await import('../utils/transfer')
    const code = await encodeSnapshot(snapshot)
    const url = buildShareUrl(code, 'https://app.test', '/')

    render(<DataTransfer />)
    fireEvent.change(screen.getByLabelText(/share link to import/i), { target: { value: url } })
    fireEvent.click(screen.getByRole('button', { name: /^import data$/i }))
    await waitFor(() => expect(mockImport).toHaveBeenCalled())
    expect(await screen.findByText(/Imported 1 new entry/i)).toBeInTheDocument()
  })
})
