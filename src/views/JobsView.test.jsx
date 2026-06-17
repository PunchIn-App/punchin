import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '../db'
import JobsView from './JobsView'

// ColorPicker and GlyphPicker are not exercised by the delete-flow tests and
// bring in complex DOM interactions that add no value here.
vi.mock('../components/ColorPicker', () => ({
  default: ({ value, onChange }) => (
    <button data-testid="color-picker" onClick={() => onChange('#FF0000')}>{value}</button>
  ),
}))
vi.mock('../components/GlyphPicker', () => ({
  default: ({ value, onChange }) => (
    <button data-testid="glyph-picker" onClick={() => onChange('code')}>{value}</button>
  ),
}))

beforeEach(async () => {
  await db.jobs.clear()
  await db.laborTypes.clear()
  await db.entries.clear()
  await db.deletions.clear()
})

it('permanently deletes an archived job and freezes its entries (real db)', async () => {
  const jobId = await db.jobs.add({ name: 'ArchivedJob', isActive: false, laborRates: {}, color: '#FF8FA3' })
  await db.entries.add({ jobId, laborTypeId: null, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: new Date('2025-01-01T10:00:00Z') })

  render(<JobsView />)
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  fireEvent.click(await screen.findByLabelText('Delete ArchivedJob permanently'))
  fireEvent.click(await screen.findByRole('button', { name: /delete permanently/i }))

  await waitFor(async () => expect(await db.jobs.get(jobId)).toBeUndefined())
  const [e] = await db.entries.toArray()
  expect(e.frozenRefs.job.name).toBe('ArchivedJob')   // entry kept + frozen, not deleted
  expect(await db.deletions.count()).toBe(1)           // tombstone written
})

it('cancelling the confirm does NOT delete the job', async () => {
  const jobId = await db.jobs.add({ name: 'KeepMe', isActive: false, laborRates: {} })
  render(<JobsView />)
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  fireEvent.click(await screen.findByLabelText('Delete KeepMe permanently'))
  fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

  await waitFor(() => expect(screen.queryByRole('button', { name: /delete permanently/i })).toBeNull())
  expect(await db.jobs.get(jobId)).toBeTruthy()        // still there
})

it('blocks deleting a labor type used by a live job (real db, not deleted)', async () => {
  const ltId = await db.laborTypes.add({ name: 'Dev', color: '#111', isArchived: true })
  await db.jobs.add({ name: 'LiveJob', isActive: true, laborRates: { [ltId]: 90 } })

  render(<JobsView />)
  fireEvent.click(await screen.findByRole('button', { name: /labor types/i }))
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  fireEvent.click(await screen.findByLabelText('Delete Dev permanently'))

  expect(await screen.findByText(/LiveJob/)).toBeInTheDocument()   // block message names the live job
  expect(await db.laborTypes.get(ltId)).toBeTruthy()               // not deleted
})

it('deletes an archived labor type with no live references and freezes its entries (real db)', async () => {
  const ltId = await db.laborTypes.add({ name: 'OldDev', color: '#5FD08A', glyph: 'code', isArchived: true })
  const jobId = await db.jobs.add({ name: 'ArchivedClient', isActive: false, laborRates: { [ltId]: 50 } })
  await db.entries.add({ jobId, laborTypeId: ltId, punchIn: new Date('2025-01-01T09:00:00Z'), punchOut: null })

  render(<JobsView />)
  fireEvent.click(await screen.findByRole('button', { name: /labor types/i }))
  fireEvent.click(await screen.findByText(/Archived \(1\)/))
  fireEvent.click(await screen.findByLabelText('Delete OldDev permanently'))
  fireEvent.click(await screen.findByRole('button', { name: /delete permanently/i }))

  await waitFor(async () => expect(await db.laborTypes.get(ltId)).toBeUndefined())
  const [e] = await db.entries.toArray()
  expect(e.frozenRefs.laborType.name).toBe('OldDev')
})
