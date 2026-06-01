import { isEntryDuplicate } from './SettingsView'

const punchIn  = new Date('2024-01-15T09:00:00.000Z')
const punchOut = new Date('2024-01-15T10:00:00.000Z')

describe('isEntryDuplicate', () => {
  const baseExisting = {
    jobId: 10,
    laborTypeId: 20,
    punchIn,
    punchOut,
  }

  it('returns true when all fields match exactly', () => {
    const backupEntry = { punchIn, punchOut }
    expect(isEntryDuplicate(backupEntry, [baseExisting], 10, 20)).toBe(true)
  })

  it('returns false when jobId differs', () => {
    const backupEntry = { punchIn, punchOut }
    expect(isEntryDuplicate(backupEntry, [baseExisting], 99, 20)).toBe(false)
  })

  it('returns false when laborTypeId differs', () => {
    const backupEntry = { punchIn, punchOut }
    expect(isEntryDuplicate(backupEntry, [baseExisting], 10, 99)).toBe(false)
  })

  it('returns false when punchIn differs by 1 millisecond', () => {
    const backupEntry = { punchIn: new Date(punchIn.getTime() + 1), punchOut }
    expect(isEntryDuplicate(backupEntry, [baseExisting], 10, 20)).toBe(false)
  })

  it('returns false when punchOut differs', () => {
    const backupEntry = { punchIn, punchOut: new Date(punchOut.getTime() + 1000) }
    expect(isEntryDuplicate(backupEntry, [baseExisting], 10, 20)).toBe(false)
  })

  it('matches when punchOut is a string (serialised JSON round-trip)', () => {
    const backupEntry = {
      punchIn: punchIn.toISOString(),
      punchOut: punchOut.toISOString(),
    }
    const existingWithStringDates = {
      ...baseExisting,
      punchIn: punchIn.toISOString(),
      punchOut: punchOut.toISOString(),
    }
    expect(isEntryDuplicate(backupEntry, [existingWithStringDates], 10, 20)).toBe(true)
  })

  it('returns false when existingEntries is empty', () => {
    const backupEntry = { punchIn, punchOut }
    expect(isEntryDuplicate(backupEntry, [], 10, 20)).toBe(false)
  })

  it('detects duplicate among multiple existing entries', () => {
    const other = { jobId: 5, laborTypeId: 6, punchIn: new Date('2024-01-14T08:00:00.000Z'), punchOut: new Date('2024-01-14T09:00:00.000Z') }
    const backupEntry = { punchIn, punchOut }
    expect(isEntryDuplicate(backupEntry, [other, baseExisting], 10, 20)).toBe(true)
  })

  it('treats both-null punchOut as a match (active timer dedup)', () => {
    const existingActive = { jobId: 10, laborTypeId: 20, punchIn, punchOut: null }
    const backupActive   = { punchIn, punchOut: null }
    expect(isEntryDuplicate(backupActive, [existingActive], 10, 20)).toBe(true)
  })

  it('does not match when one punchOut is null and the other is not', () => {
    const existingActive = { jobId: 10, laborTypeId: 20, punchIn, punchOut: null }
    const backupCompleted = { punchIn, punchOut }
    expect(isEntryDuplicate(backupCompleted, [existingActive], 10, 20)).toBe(false)
  })
})
