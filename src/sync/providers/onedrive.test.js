import { buildOneDriveOAuthUrl, exchangeOneDriveCode, pushToOneDrive, pullFromOneDrive } from './onedrive'

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

  it('uses response_type=code with PKCE (Auth Code flow, issue #128)', () => {
    const url = buildOneDriveOAuthUrl('id', 'nonce', 'challenge123')
    expect(url).toContain('response_type=code')
    expect(url).toContain('code_challenge=challenge123')
    expect(url).toContain('code_challenge_method=S256')
  })

  it('requests the AppFolder scope', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('AppFolder')
  })

  it('sets state=onedrive', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('state=onedrive')
  })

  it('embeds the provider label and CSRF nonce in state when provided (issue #125)', () => {
    expect(new URL(buildOneDriveOAuthUrl('id', 'nonce123')).searchParams.get('state')).toBe('onedrive:nonce123')
  })

  it('includes a redirect_uri', () => {
    const url = buildOneDriveOAuthUrl('id')
    expect(url).toContain('redirect_uri=')
  })

  it('forces the account chooser with prompt=select_account (no silent reconnect)', () => {
    expect(new URL(buildOneDriveOAuthUrl('id')).searchParams.get('prompt')).toBe('select_account')
  })
})

// ---------------------------------------------------------------------------
// exchangeOneDriveCode (Auth Code + PKCE, issue #128)
// ---------------------------------------------------------------------------

describe('exchangeOneDriveCode', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs code + verifier to the token endpoint and returns the token JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'odtoken', expires_in: 3600 }) })
    const data = await exchangeOneDriveCode('client-id', 'authcode', 'verifier-xyz')
    expect(data.access_token).toBe('odtoken')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(opts.method).toBe('POST')
    const body = new URLSearchParams(opts.body)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('authcode')
    expect(body.get('code_verifier')).toBe('verifier-xyz')
    expect(body.get('client_id')).toBe('client-id')
  })

  it('throws TOKEN_EXPIRED on a 401 and a status error otherwise', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(exchangeOneDriveCode('id', 'c', 'v')).rejects.toThrow('TOKEN_EXPIRED')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
    await expect(exchangeOneDriveCode('id', 'c', 'v')).rejects.toThrow('OneDrive 400')
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

  it('throws TOKEN_EXPIRED on a 401 (not treated as "no file"), so the UI prompts re-auth', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pullFromOneDrive('token')).rejects.toThrow('TOKEN_EXPIRED')
  })
})
