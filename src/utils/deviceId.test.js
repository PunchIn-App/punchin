import { getDeviceId } from './deviceId'

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns the same ID on repeated calls', () => {
    const id1 = getDeviceId()
    const id2 = getDeviceId()
    expect(id1).toBe(id2)
  })

  it('generates an 8-character lowercase hex string on first call', () => {
    const id = getDeviceId()
    expect(id).toMatch(/^[0-9a-f]{8}$/)
  })

  it('persists the ID to localStorage', () => {
    const id = getDeviceId()
    expect(localStorage.getItem('pi.deviceId')).toBe(id)
  })

  it('reuses an existing ID from localStorage', () => {
    localStorage.setItem('pi.deviceId', 'abcd1234')
    const id = getDeviceId()
    expect(id).toBe('abcd1234')
  })

  it("falls back to 'default' when localStorage throws", () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    const id = getDeviceId()
    expect(id).toBe('default')
  })
})
