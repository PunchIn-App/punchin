import { buildGoogleOAuthUrl, pushToDrive, pullFromDrive } from './google'

// ---------------------------------------------------------------------------
// buildGoogleOAuthUrl
// ---------------------------------------------------------------------------

describe('buildGoogleOAuthUrl', () => {
  it('points to the Google OAuth v2 authorize endpoint', () => {
    const url = buildGoogleOAuthUrl('google-client-id')
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/)
  })

  it('includes the client_id param', () => {
    const url = buildGoogleOAuthUrl('google-client-id')
    expect(url).toContain('client_id=google-client-id')
  })

  it('uses response_type=token (implicit flow)', () => {
    const url = buildGoogleOAuthUrl('id')
    expect(url).toContain('response_type=token')
  })

  it('requests the drive.appdata scope', () => {
    const url = buildGoogleOAuthUrl('id')
    expect(url).toContain('drive.appdata')
  })

  it('sets state=google', () => {
    const url = buildGoogleOAuthUrl('id')
    expect(url).toContain('state=google')
  })

  it('includes a redirect_uri', () => {
    const url = buildGoogleOAuthUrl('id')
    expect(url).toContain('redirect_uri=')
  })
})

// ---------------------------------------------------------------------------
// pushToDrive
// ---------------------------------------------------------------------------

describe('pushToDrive', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a new file with a multipart POST when none exists', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) }) // findFileId
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-file-id' }) }) // upload
    const id = await pushToDrive('token', { version: 1 })
    expect(id).toBe('new-file-id')
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
  })

  it('updates the existing file with PATCH when one is found', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'existing-id' }] }) })
      .mockResolvedValueOnce({ ok: true })
    const id = await pushToDrive('token', { version: 1 })
    expect(id).toBe('existing-id')
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
  })

  it('sends Authorization header on every request', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'f' }) })
    await pushToDrive('my-token', {})
    for (const [, opts] of fetchMock.mock.calls) {
      expect(opts.headers['Authorization']).toBe('Bearer my-token')
    }
  })

  it('throws on upload error', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(pushToDrive('token', {})).rejects.toThrow('Drive 403')
  })

  it('throws when findFileId itself fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pushToDrive('token', {})).rejects.toThrow('Drive 401')
  })
})

// ---------------------------------------------------------------------------
// pullFromDrive
// ---------------------------------------------------------------------------

describe('pullFromDrive', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when no file exists in Drive', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
    const result = await pullFromDrive('token')
    expect(result).toBeNull()
  })

  it('returns parsed JSON when the file exists', async () => {
    const data = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'file-id' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => data })
    const result = await pullFromDrive('token')
    expect(result).toEqual(data)
  })

  it('fetches the file content with ?alt=media', async () => {
    const data = { version: 1 }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'file-id' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => data })
    await pullFromDrive('token')
    expect(fetchMock.mock.calls[1][0]).toContain('alt=media')
  })

  it('throws when the file content fetch fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'file-id' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(pullFromDrive('token')).rejects.toThrow('Drive 500')
  })
})
