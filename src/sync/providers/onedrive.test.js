import { buildOneDriveOAuthUrl, pushToOneDrive, pullFromOneDrive } from './onedrive'

// ---------------------------------------------------------------------------
// buildOneDriveOAuthUrl
// ---------------------------------------------------------------------------

describe('buildOneDriveOAuthUrl', () => {
  it('points to the Microsoft OAuth v2 authorize endpoint', () => {
    const url = buildOneDriveOAuthUrl('od-client-id')
    expect(url).toMatch(/^https:\/\/login\.microsoftonline\.com/)
  })

  it('includes the client_id param', () => {
    const url = buildOneDriveOAuthUrl('od-client-id')
    expect(url).toContain('client_id=od-client-id')
  })

  it('uses response_type=token (implicit flow)', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('response_type=token')
  })

  it('requests the AppFolder scope', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('AppFolder')
  })

  it('sets state=onedrive', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('state=onedrive')
  })

  it('includes a redirect_uri', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('redirect_uri=')
  })
})

// ---------------------------------------------------------------------------
// pushToOneDrive
// ---------------------------------------------------------------------------

describe('pushToOneDrive', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs to the correct Graph API approot path', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'od-file-id' }) })
    await pushToOneDrive('token', { version: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('punchin-data.json'),
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('sends Authorization: Bearer <token> header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id' }) })
    await pushToOneDrive('my-token', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('returns the file id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'od-file-id' }) })
    const id = await pushToOneDrive('token', { version: 1 })
    expect(id).toBe('od-file-id')
  })

  it('JSON-stringifies the snapshot in the request body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id' }) })
    const snapshot = { version: 1, jobs: [], entries: [], laborTypes: [] }
    await pushToOneDrive('token', snapshot)
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual(snapshot)
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(pushToOneDrive('token', {})).rejects.toThrow('OneDrive 403')
  })
})

// ---------------------------------------------------------------------------
// pullFromOneDrive
// ---------------------------------------------------------------------------

describe('pullFromOneDrive', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when the file is not found (404 = first sync)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await pullFromOneDrive('token')
    expect(result).toBeNull()
  })

  it('returns parsed JSON when the file exists', async () => {
    const data = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => data })
    const result = await pullFromOneDrive('token')
    expect(result).toEqual(data)
  })

  it('sends Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await pullFromOneDrive('my-token')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('throws with status code on non-404 errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(pullFromOneDrive('token')).rejects.toThrow('OneDrive 500')
  })

  it('does not throw on 401 (not treated as "no file")', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pullFromOneDrive('token')).rejects.toThrow('OneDrive 401')
  })
})
