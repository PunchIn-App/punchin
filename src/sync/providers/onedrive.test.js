import { buildOneDriveOAuthUrl, pushToOneDrive, pullFromOneDrive } from './onedrive'

// ---------------------------------------------------------------------------
// buildOneDriveOAuthUrl (Auth Code via worker, confidential client, issue #243)
// ---------------------------------------------------------------------------

describe('buildOneDriveOAuthUrl (Auth Code via worker, issue #243)', () => {
  const BASE = 'https://app.example'

  it('points to the Microsoft OAuth v2 authorize endpoint', () => {
    expect(buildOneDriveOAuthUrl('od-client-id', BASE)).toMatch(/^https:\/\/login\.microsoftonline\.com/)
  })

  it('includes the client_id param', () => {
    expect(buildOneDriveOAuthUrl('od-client-id', BASE)).toContain('client_id=od-client-id')
  })

  it('uses response_type=code with NO PKCE challenge (the worker holds the secret)', () => {
    const url = buildOneDriveOAuthUrl('id', BASE, 'nonce')
    expect(new URL(url).searchParams.get('response_type')).toBe('code')
    expect(url).not.toContain('code_challenge')
  })

  it('requests the AppFolder scope plus offline_access (for a refresh token)', () => {
    const scope = new URL(buildOneDriveOAuthUrl('id', BASE)).searchParams.get('scope')
    expect(scope).toContain('Files.ReadWrite.AppFolder')
    expect(scope).toContain('offline_access')
  })

  it('points redirect_uri at the worker callback under the callbackBase', () => {
    expect(new URL(buildOneDriveOAuthUrl('id', BASE)).searchParams.get('redirect_uri')).toBe('https://app.example/oauth/onedrive/callback')
  })

  it('carries the raw CSRF nonce in state (provider identified by callback path, issue #125)', () => {
    expect(new URL(buildOneDriveOAuthUrl('id', BASE, 'nonce123')).searchParams.get('state')).toBe('nonce123')
  })

  it('omits state entirely when no nonce is given', () => {
    expect(new URL(buildOneDriveOAuthUrl('id', BASE)).searchParams.has('state')).toBe(false)
  })

  it('forces the account chooser with prompt=select_account (no silent reconnect)', () => {
    expect(new URL(buildOneDriveOAuthUrl('id', BASE)).searchParams.get('prompt')).toBe('select_account')
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
