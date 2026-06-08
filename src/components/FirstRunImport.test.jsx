import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FirstRunImport from './FirstRunImport'

const mockImportSnapshot = vi.fn().mockResolvedValue(0)
vi.mock('../sync/syncManager', () => ({ importSnapshot: (...a) => mockImportSnapshot(...a) }))

beforeEach(() => vi.clearAllMocks())

it('renders the carry-over prompt with import + sync + dismiss actions', () => {
  render(<FirstRunImport onDismiss={vi.fn()} onConnectSync={vi.fn()} />)
  expect(screen.getByRole('dialog', { name: /bring your data over/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /import a backup file/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /connect cloud sync/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /start fresh/i })).toBeInTheDocument()
})

it('"Start fresh" and the × both dismiss', () => {
  const onDismiss = vi.fn()
  render(<FirstRunImport onDismiss={onDismiss} onConnectSync={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
  fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
  expect(onDismiss).toHaveBeenCalledTimes(2)
})

it('"Connect cloud sync" calls onConnectSync', () => {
  const onConnectSync = vi.fn()
  render(<FirstRunImport onDismiss={vi.fn()} onConnectSync={onConnectSync} />)
  fireEvent.click(screen.getByRole('button', { name: /connect cloud sync/i }))
  expect(onConnectSync).toHaveBeenCalled()
})

it('imports a valid backup file then dismisses', async () => {
  const onDismiss = vi.fn()
  render(<FirstRunImport onDismiss={onDismiss} onConnectSync={vi.fn()} />)
  const input = screen.getByLabelText('Import backup JSON file')
  const file = new File(
    [JSON.stringify({ version: 1, jobs: [], entries: [], laborTypes: [], settings: { theme: 'light' } })],
    'backup.json', { type: 'application/json' },
  )
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(mockImportSnapshot).toHaveBeenCalled())
  await waitFor(() => expect(onDismiss).toHaveBeenCalled())
})

it('rejects a non-PunchIn file without importing or dismissing', async () => {
  const onDismiss = vi.fn()
  render(<FirstRunImport onDismiss={onDismiss} onConnectSync={vi.fn()} />)
  const input = screen.getByLabelText('Import backup JSON file')
  const file = new File([JSON.stringify({ foo: 'bar' })], 'nope.json', { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(mockImportSnapshot).not.toHaveBeenCalled()
  expect(onDismiss).not.toHaveBeenCalled()
})
