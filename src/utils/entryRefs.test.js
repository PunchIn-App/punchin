import { entryJob, entryLabor } from './entryRefs'

describe('entryJob', () => {
  it('returns the live job when present (not frozen)', () => {
    const job = { id: 1, name: 'Live', color: '#fff' }
    expect(entryJob({ jobId: 1 }, job)).toEqual({ job, frozen: false })
  })
  it('falls back to frozenRefs.job when the live job is gone', () => {
    const entry = { jobId: 1, frozenRefs: { job: { name: 'Gone', color: '#abc' } } }
    expect(entryJob(entry, undefined)).toEqual({ job: { name: 'Gone', color: '#abc' }, frozen: true })
  })
  it('returns null job when neither live nor frozen', () => {
    expect(entryJob({ jobId: 1 }, undefined)).toEqual({ job: null, frozen: false })
  })
})

describe('entryLabor', () => {
  it('returns the live labor type when present', () => {
    const lt = { id: 2, name: 'Dev', color: '#111', glyph: 'code' }
    expect(entryLabor({ laborTypeId: 2 }, lt)).toEqual({ laborType: lt, frozen: false })
  })
  it('falls back to frozenRefs.laborType when gone', () => {
    const entry = { laborTypeId: 2, frozenRefs: { laborType: { name: 'Dev', color: '#111', glyph: 'code' } } }
    expect(entryLabor(entry, null)).toEqual({ laborType: { name: 'Dev', color: '#111', glyph: 'code' }, frozen: true })
  })
  it('returns null laborType when neither', () => {
    expect(entryLabor({ laborTypeId: 2 }, undefined)).toEqual({ laborType: null, frozen: false })
  })
})
