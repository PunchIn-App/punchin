import { buildDropboxOAuthUrl, pushToDropbox, pullFromDropbox, fetchDropboxUser } from './dropbox'

// ---------------------------------------------------------------------------
// buildDropboxOAuthUrl (Auth Code via worker, confidential client, issue #295)
// ---------------------------------------------------------------------------

describe('buildDropboxOAuthUrl (Auth Code via worker, confidential client)', () => {
  const BASE = 'https://app.example'

  it('points to the Dropbox authorize endpoint', () => {
    expect(buildDropboxOAuthUrl('db-key', BASE)).toMatch(/^https:\/\/www\.dropbox\.com\/oauth2\/authorize/)
  })

  it('includes the client_id (app key)', () => {
    expect(buildDropboxOAuthUrl('db-key', BASE)).toContain('client_id=db-key')
  })

  it('uses response_type=code with NO PKCE challenge (the worker holds the secret)', () => {
    const url = buildDropboxOAuthUrl('id', BASE, 'nonce')
    expect(new URL(url).searchParams.get('response_type')).toBe('code')
    expect(url).not.toContain('code_challenge')
  })

  it('requests token_access_type=offline (required for a refresh token)', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('token_access_type')).toBe('offline')
  })

  it('requests the app-folder file scopes', () => {
    const scope = new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('scope')
    expect(scope).toContain('files.content.write')
    expect(scope).toContain('files.content.read')
    expect(scope).toContain('files.metadata.read')
  })

  it('points redirect_uri at the worker callback under the callbackBase', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('redirect_uri')).toBe('https://app.example/oauth/dropbox/callback')
  })

  it('carries the raw CSRF nonce in state (provider identified by callback path)', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE, 'nonce123')).searchParams.get('state')).toBe('nonce123')
  })

  it('omits state entirely when no nonce is given', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.has('state')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// pushToDropbox
// ---------------------------------------------------------------------------

describe('pushToDropbox', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('POSTs to the content upload endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id:abc' }) })
    await pushToDropbox('token', { version: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://content.dropboxapi.com/2/files/upload',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends the Bearer token and an overwrite Dropbox-API-Arg for /punchin-data.json', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x' }) })
    await pushToDropbox('my-token', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
    const arg = JSON.parse(opts.headers['Dropbox-API-Arg'])
    expect(arg).toEqual({ path: '/punchin-data.json', mode: 'overwrite', mute: true })
  })

  it('JSON-stringifies the snapshot in the request body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x' }) })
    const snapshot = { version: 1, jobs: [], entries: [], laborTypes: [] }
    await pushToDropbox('token', snapshot)
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual(snapshot)
  })

  it('returns the uploaded file id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id:abc' }) })
    expect(await pushToDropbox('token', {})).toBe('id:abc')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(pushToDropbox('token', {})).rejects.toThrow('Dropbox 403')
  })

  it('throws TOKEN_EXPIRED on a 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pushToDropbox('token', {})).rejects.toThrow('TOKEN_EXPIRED')
  })
})

// ---------------------------------------------------------------------------
// pullFromDropbox
// ---------------------------------------------------------------------------

describe('pullFromDropbox', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns null when the file is not found (409 path/not_found = first sync)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => '{"error_summary":"path/not_found/..","error":{".tag":"path"}}' })
    expect(await pullFromDropbox('token')).toBeNull()
  })

  it('throws on a 409 that is NOT a not_found', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => '{"error_summary":"path/conflict/.."}' })
    await expect(pullFromDropbox('token')).rejects.toThrow('Dropbox download 409')
  })

  it('returns parsed JSON when the file exists', async () => {
    const data = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => data })
    expect(await pullFromDropbox('token')).toEqual(data)
  })

  it('sends the Bearer token and a download Dropbox-API-Arg', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await pullFromDropbox('my-token')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://content.dropboxapi.com/2/files/download')
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
    expect(JSON.parse(opts.headers['Dropbox-API-Arg'])).toEqual({ path: '/punchin-data.json' })
  })

  it('throws with status code on other errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(pullFromDropbox('token')).rejects.toThrow('Dropbox download 500')
  })

  it('throws TOKEN_EXPIRED on a 401 (so the UI prompts re-auth)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pullFromDropbox('token')).rejects.toThrow('TOKEN_EXPIRED')
  })
})

// ---------------------------------------------------------------------------
// fetchDropboxUser — account identity for the connect-confirm dialog
// ---------------------------------------------------------------------------

describe('fetchDropboxUser', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('POSTs get_current_account with the bearer token and returns the email', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'rob@dropbox.com', name: { display_name: 'Rob' } }) })
    expect(await fetchDropboxUser('token123')).toBe('rob@dropbox.com')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.dropboxapi.com/2/users/get_current_account')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer token123')
  })

  it('falls back to the display name when there is no email', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: { display_name: 'Rob P' } }) })
    expect(await fetchDropboxUser('t')).toBe('Rob P')
  })

  it('returns null on a failed lookup rather than throwing (never blocks connecting)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    expect(await fetchDropboxUser('t')).toBeNull()
  })
})
