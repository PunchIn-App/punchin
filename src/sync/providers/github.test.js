import {
  buildGitHubOAuthUrl,
  createGist,
  updateGist,
  fetchGist,
  fetchGitHubUser,
  findExistingPunchInGist,
  fetchAllDeviceData,
  pushDeviceData,
  deleteDeviceFile,
  getDeviceFilename,
} from './github'

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
// fetchGitHubUser
// ---------------------------------------------------------------------------

describe('fetchGitHubUser', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('returns the user object on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'octocat', id: 1 }) })
    const user = await fetchGitHubUser('token')
    expect(user.login).toBe('octocat')
  })

  it('sends Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'u' }) })
    await fetchGitHubUser('my-token')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('returns null on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    const result = await fetchGitHubUser('bad-token')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findExistingPunchInGist
// ---------------------------------------------------------------------------

describe('findExistingPunchInGist', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('returns the gist id when punchin-data.json is found on the first page', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'gist-other', files: { 'notes.md': {} } },
        { id: 'gist-punchin', files: { 'punchin-data.json': {} } },
      ],
    })
    const id = await findExistingPunchInGist('token')
    expect(id).toBe('gist-punchin')
  })

  it('returns the gist id when the marker file is present', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'gist-other', files: { 'notes.md': {} } },
        { id: 'gist-marker', files: { '- PunchIn Sync': {}, 'punchin-data-abc12345.json': {} } },
      ],
    })
    const id = await findExistingPunchInGist('token')
    expect(id).toBe('gist-marker')
  })

  it('returns the gist id when a device-prefixed file is present', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'gist-device', files: { 'punchin-data-a1b2c3d4.json': {} } },
      ],
    })
    const id = await findExistingPunchInGist('token')
    expect(id).toBe('gist-device')
  })

  it('returns null when no matching gist exists', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'g1', files: { 'notes.md': {} } }],
    })
    const id = await findExistingPunchInGist('token')
    expect(id).toBeNull()
  })

  it('returns null when the gist list is empty', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
    const id = await findExistingPunchInGist('token')
    expect(id).toBeNull()
  })

  it('paginates when the first page is full', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `g${i}`, files: { 'other.txt': {} } }))
    const page2 = [{ id: 'gist-punchin', files: { 'punchin-data.json': {} } }]
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 })
    const id = await findExistingPunchInGist('token')
    expect(id).toBe('gist-punchin')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(findExistingPunchInGist('token')).rejects.toThrow('GitHub 403')
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
    await createGist('token', 'dev1', { version: 1, jobs: [], entries: [], laborTypes: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends Authorization: Bearer <token> header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g' }) })
    await createGist('my-token', 'dev1', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('sets the gist as private and includes the marker file and device data file', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'g' }) })
    await createGist('token', 'abcd1234', { version: 1 })
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.public).toBe(false)
    expect(body.files).toHaveProperty('- PunchIn Sync')
    expect(body.files).toHaveProperty('punchin-data-abcd1234.json')
  })

  it('returns the new gist id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gist-abc' }) })
    const id = await createGist('token', 'dev1', {})
    expect(id).toBe('gist-abc')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(createGist('bad-token', 'dev1', {})).rejects.toThrow('GitHub 401')
  })
})

// ---------------------------------------------------------------------------
// updateGist (legacy — kept for backward compatibility)
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
// fetchGist (legacy — kept for backward compatibility)
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

// ---------------------------------------------------------------------------
// fetchAllDeviceData
// ---------------------------------------------------------------------------

describe('fetchAllDeviceData', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('returns snapshots from all device files', async () => {
    const snap1 = { version: 1, jobs: [], entries: [], laborTypes: [] }
    const snap2 = { version: 1, jobs: [{ id: 1 }], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: {
          '- PunchIn Sync': { truncated: false, content: '{"app":"PunchIn"}' },
          'punchin-data-aabbccdd.json': { truncated: false, content: JSON.stringify(snap1) },
          'punchin-data-11223344.json': { truncated: false, content: JSON.stringify(snap2) },
        },
      }),
    })
    const results = await fetchAllDeviceData('token', 'gist-id')
    expect(results).toHaveLength(2)
    expect(results).toContainEqual(snap1)
    expect(results).toContainEqual(snap2)
  })

  it('also reads the legacy punchin-data.json file when present', async () => {
    const legacy = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: {
          'punchin-data.json': { truncated: false, content: JSON.stringify(legacy) },
        },
      }),
    })
    const results = await fetchAllDeviceData('token', 'gist-id')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(legacy)
  })

  it('returns empty array when no device files are present', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: {
          '- PunchIn Sync': { truncated: false, content: '{"app":"PunchIn"}' },
        },
      }),
    })
    const results = await fetchAllDeviceData('token', 'gist-id')
    expect(results).toEqual([])
  })

  it('fetches truncated content via raw_url', async () => {
    const snap = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: {
            'punchin-data-aabbccdd.json': {
              truncated: true,
              raw_url: 'https://gist.githubusercontent.com/raw/xyz',
              content: '',
            },
          },
        }),
      })
      .mockResolvedValueOnce({ json: async () => snap })
    const results = await fetchAllDeviceData('token', 'gist-id')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(snap)
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://gist.githubusercontent.com/raw/xyz')
  })

  it('skips malformed files silently', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: {
          'punchin-data-good.json': { truncated: false, content: '{"version":1,"jobs":[],"entries":[],"laborTypes":[]}' },
          'punchin-data-bad.json': { truncated: false, content: 'not-json{{{' },
          'punchin-data-noversion.json': { truncated: false, content: '{"jobs":[]}' },
        },
      }),
    })
    const results = await fetchAllDeviceData('token', 'gist-id')
    expect(results).toHaveLength(1)
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchAllDeviceData('token', 'gist-id')).rejects.toThrow('GitHub 404')
  })
})

// ---------------------------------------------------------------------------
// pushDeviceData
// ---------------------------------------------------------------------------

describe('pushDeviceData', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('PATCHes the correct gist URL', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await pushDeviceData('token', 'gist-abc', 'dev1', { version: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist-abc',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('includes both the marker file and the device data file', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await pushDeviceData('token', 'gist-abc', 'abcd1234', { version: 1 })
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.files).toHaveProperty('- PunchIn Sync')
    expect(body.files).toHaveProperty('punchin-data-abcd1234.json')
  })

  it('encodes the snapshot as JSON in the device file', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const snap = { version: 1, jobs: [], entries: [], laborTypes: [] }
    await pushDeviceData('token', 'gist-id', 'dev1', snap)
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(JSON.parse(body.files['punchin-data-dev1.json'].content)).toEqual(snap)
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(pushDeviceData('token', 'gist-id', 'dev1', {})).rejects.toThrow('GitHub 403')
  })
})

// ---------------------------------------------------------------------------
// deleteDeviceFile
// ---------------------------------------------------------------------------

describe('deleteDeviceFile', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('PATCHes the gist with null for the device filename', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await deleteDeviceFile('token', 'gist-xyz', 'abcd1234')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist-xyz',
      expect.objectContaining({ method: 'PATCH' })
    )
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.files['punchin-data-abcd1234.json']).toBeNull()
  })

  it('sends Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    await deleteDeviceFile('my-token', 'gist-id', 'dev1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(deleteDeviceFile('token', 'gist-id', 'dev1')).rejects.toThrow('GitHub 404')
  })
})

// ---------------------------------------------------------------------------
// getDeviceFilename
// ---------------------------------------------------------------------------

describe('getDeviceFilename', () => {
  it('returns punchin-data-{deviceId}.json', () => {
    expect(getDeviceFilename('abcd1234')).toBe('punchin-data-abcd1234.json')
  })
})
