import { buildGitHubOAuthUrl, createGist, updateGist, fetchGist } from './github'

// ---------------------------------------------------------------------------
// buildGitHubOAuthUrl
// ---------------------------------------------------------------------------

describe('buildGitHubOAuthUrl', () => {
  it('points to the GitHub OAuth authorize endpoint', () => {
    const url = buildGitHubOAuthUrl('client-id', 'https://example.com')
    expect(url).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/)
  })

  it('includes the client_id param', () => {
    const url = buildGitHubOAuthUrl('my-client-id', 'https://example.com')
    expect(url).toContain('client_id=my-client-id')
  })

  it('requests only the gist scope', () => {
    const url = buildGitHubOAuthUrl('id', 'https://example.com')
    expect(url).toContain('scope=gist')
  })

  it('includes the redirect_uri derived from callbackBase', () => {
    const url = buildGitHubOAuthUrl('id', 'https://example.com')
    expect(url).toContain('redirect_uri=')
    expect(url).toContain('example.com')
  })
})

// ---------------------------------------------------------------------------
// createGist
// ---------------------------------------------------------------------------

describe('createGist', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to the GitHub gists endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gist-123' }) })
    await createGist('token', { version: 1, jobs: [], entries: [], laborTypes: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends Authorization: Bearer <token> header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g' }) })
    await createGist('my-token', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('sets the gist as private and includes punchin-data.json', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g' }) })
    await createGist('token', { version: 1 })
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.public).toBe(false)
    expect(body.files).toHaveProperty('punchin-data.json')
  })

  it('returns the new gist id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gist-abc' }) })
    const id = await createGist('token', {})
    expect(id).toBe('gist-abc')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(createGist('bad-token', {})).rejects.toThrow('GitHub 401')
  })
})

// ---------------------------------------------------------------------------
// updateGist
// ---------------------------------------------------------------------------

describe('updateGist', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the correct gist URL', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await updateGist('token', 'gist-999', { version: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist-999',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('sends Authorization: Bearer <token> header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await updateGist('my-token', 'id', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('encodes the snapshot as punchin-data.json in the body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const snapshot = { version: 1, jobs: [], entries: [], laborTypes: [] }
    await updateGist('token', 'id', snapshot)
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.files).toHaveProperty('punchin-data.json')
    expect(JSON.parse(body.files['punchin-data.json'].content)).toEqual(snapshot)
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(updateGist('token', 'id', {})).rejects.toThrow('GitHub 403')
  })
})

// ---------------------------------------------------------------------------
// fetchGist
// ---------------------------------------------------------------------------

describe('fetchGist', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs the gist and parses punchin-data.json content', async () => {
    const data = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: { 'punchin-data.json': { truncated: false, content: JSON.stringify(data) } },
      }),
    })
    const result = await fetchGist('token', 'gist-id')
    expect(result).toEqual(data)
  })

  it('fetches via raw_url when content is truncated', async () => {
    const data = { version: 1, jobs: [{ id: 1, name: 'Big Job' }], entries: [], laborTypes: [] }
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: {
            'punchin-data.json': {
              truncated: true,
              raw_url: 'https://gist.githubusercontent.com/raw/abc',
              content: '',
            },
          },
        }),
      })
      .mockResolvedValueOnce({ json: async () => data })

    const result = await fetchGist('token', 'gist-id')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://gist.githubusercontent.com/raw/abc')
    expect(result).toEqual(data)
  })

  it('sends Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: { 'punchin-data.json': { truncated: false, content: '{}' } },
      }),
    })
    await fetchGist('my-token', 'gist-id')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('throws when punchin-data.json is absent from the gist files', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ files: {} }) })
    await expect(fetchGist('token', 'gist-id')).rejects.toThrow('No PunchIn data found in Gist')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchGist('token', 'gist-id')).rejects.toThrow('GitHub 404')
  })
})
