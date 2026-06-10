import { buildGoogleOAuthUrl, pushToDrive, pullFromDrive, fetchGoogleUser } from './google'

// ---------------------------------------------------------------------------
// buildGoogleOAuthUrl
// ---------------------------------------------------------------------------

describe('buildGoogleOAuthUrl (Auth Code via worker, issue #243)', () => {
  const BASE = 'https://app.example'

  it('points to the Google OAuth v2 authorize endpoint', () => {
    expect(buildGoogleOAuthUrl('google-client-id', BASE)).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/)
  })

  it('includes the client_id param', () => {
    expect(buildGoogleOAuthUrl('google-client-id', BASE)).toContain('client_id=google-client-id')
  })

  it('uses response_type=code (Authorization Code flow, not implicit)', () => {
    expect(new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.get('response_type')).toBe('code')
  })

  it('requests the drive.appdata scope', () => {
    expect(buildGoogleOAuthUrl('id', BASE)).toContain('drive.appdata')
  })

  it('also requests openid + email scopes so the connect dialog can name the account', () => {
    const scope = new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.get('scope')
    expect(scope).toContain('openid')
    expect(scope).toContain('email')
  })

  it('requests offline access so a refresh token is issued', () => {
    expect(new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.get('access_type')).toBe('offline')
  })

  it('forces consent + account chooser so a refresh token is RE-issued on reconnect', () => {
    // prompt=consent is required for Google to re-issue the refresh token on a
    // silent re-grant; select_account keeps the chooser (issue #243).
    expect(new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.get('prompt')).toBe('consent select_account')
  })

  it('points redirect_uri at the worker callback under the callbackBase', () => {
    expect(new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.get('redirect_uri')).toBe('https://app.example/oauth/google/callback')
  })

  it('carries the raw CSRF nonce in state (provider identified by callback path, issue #125)', () => {
    expect(new URL(buildGoogleOAuthUrl('id', BASE, 'nonce123')).searchParams.get('state')).toBe('nonce123')
  })

  it('omits state entirely when no nonce is given', () => {
    expect(new URL(buildGoogleOAuthUrl('id', BASE)).searchParams.has('state')).toBe(false)
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

  it('throws TOKEN_EXPIRED on a 401 (expired/revoked token) so the UI prompts re-auth', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pushToDrive('token', {})).rejects.toThrow('TOKEN_EXPIRED')
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

// ---------------------------------------------------------------------------
// fetchGoogleUser — account identity for the connect-confirm dialog
// ---------------------------------------------------------------------------

describe('fetchGoogleUser', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the OpenID userinfo endpoint with the bearer token and returns the email', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'rob@gmail.com', name: 'Rob' }) })
    const email = await fetchGoogleUser('token123')
    expect(email).toBe('rob@gmail.com')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
    expect(opts.headers.Authorization).toBe('Bearer token123')
  })

  it('falls back to the name when no email is present', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Rob' }) })
    expect(await fetchGoogleUser('t')).toBe('Rob')
  })

  it('returns null on a failed lookup rather than throwing (never blocks connecting)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    expect(await fetchGoogleUser('t')).toBeNull()
  })
})
