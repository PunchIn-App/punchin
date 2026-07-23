import worker, { withSecurityHeaders, nearestSwatchPath } from './oauth.js'
import { renderIconPng } from './iconRender.js'

// Mock the WASM renderer so the worker tests never load resvg's wasm under vitest.
vi.mock('./iconRender.js', () => ({ renderIconPng: vi.fn() }))

describe('worker security headers (issue #129)', () => {
  it('withSecurityHeaders adds CSP + hardening headers and preserves status/body/headers', async () => {
    const original = new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    const res = withSecurityHeaders(original)

    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toMatch(/default-src 'self'/)
    expect(csp).toMatch(/script-src 'self'/)
    expect(csp).toMatch(/frame-ancestors 'none'/)
    expect(csp).toContain('https://api.github.com')
    expect(csp).toContain('https://www.googleapis.com')
    expect(csp).toContain('https://api.dropboxapi.com')
    expect(csp).toContain('https://content.dropboxapi.com')
    expect(csp).toContain('https://graph.microsoft.com')
    // Fonts are self-hosted (no Google Fonts CDN) — they load from same origin.
    expect(csp).toMatch(/font-src 'self'/)
    expect(csp).not.toContain('fonts.gstatic.com')
    expect(csp).not.toContain('fonts.googleapis.com')

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/)
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')

    // original headers / status / body are preserved
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<!doctype html>')
  })

  it('applies the headers to asset (non-callback) responses', async () => {
    const env = { ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('app', { status: 200 })) } }
    const res = await worker.fetch({ url: 'https://app.example/timer' }, env)
    expect(env.ASSETS.fetch).toHaveBeenCalled()
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(res.status).toBe(200)
  })
})

describe('worker GitHub OAuth callback — CSRF state passthrough (issue #125)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('echoes the GitHub state back in the success redirect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'tok123' }) }))
    const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', APP_URL: 'https://app.example' }
    const res = await worker.fetch(
      { url: 'https://app.example/oauth/github/callback?code=abc&state=NONCE123' }, env,
    )
    const loc = res.headers.get('location')
    expect(loc).toContain('sync_token=tok123')
    expect(loc).toContain('sync_provider=github')
    expect(loc).toContain('state=NONCE123')
  })

  it('does not append a state param when GitHub returned none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'tok123' }) }))
    const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', APP_URL: 'https://app.example' }
    const res = await worker.fetch({ url: 'https://app.example/oauth/github/callback?code=abc' }, env)
    expect(res.headers.get('location')).not.toContain('state=')
  })
})

describe('worker GitHub OAuth callback — edge cases (issue #165)', () => {
  const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', APP_URL: 'https://app.example' }
  afterEach(() => vi.unstubAllGlobals())

  it('redirects with missing_code when the callback has no code', async () => {
    const res = await worker.fetch({ url: 'https://app.example/oauth/github/callback?state=x' }, env)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://app.example/#sync_error=missing_code')
  })

  it("passes GitHub's error_description through when no access_token comes back", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ error_description: 'bad_verification_code' }) }))
    const res = await worker.fetch({ url: 'https://app.example/oauth/github/callback?code=abc' }, env)
    expect(res.headers.get('location')).toBe('https://app.example/#sync_error=bad_verification_code')
  })

  it('falls back to auth_failed when GitHub returns neither token nor error_description', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }))
    const res = await worker.fetch({ url: 'https://app.example/oauth/github/callback?code=abc' }, env)
    expect(res.headers.get('location')).toBe('https://app.example/#sync_error=auth_failed')
  })

  it('redirects with server_error when the token exchange throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const res = await worker.fetch({ url: 'https://app.example/oauth/github/callback?code=abc' }, env)
    expect(res.headers.get('location')).toBe('https://app.example/#sync_error=server_error')
  })

  it('uses the request origin as the redirect base when APP_URL is unset', async () => {
    const res = await worker.fetch(
      { url: 'https://fallback.example/oauth/github/callback' },
      { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' },
    )
    expect(res.headers.get('location')).toBe('https://fallback.example/#sync_error=missing_code')
  })
})

describe('worker OAuth revoke route (deauth on disconnect)', () => {
  const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }
  const revoke = (body, method = 'POST') =>
    worker.fetch({ url: 'https://app.example/oauth/revoke', method, json: async () => body }, env)

  afterEach(() => vi.unstubAllGlobals())

  it('rejects a non-POST request with 405', async () => {
    const res = await worker.fetch({ url: 'https://app.example/oauth/revoke', method: 'GET' }, env)
    expect(res.status).toBe(405)
  })

  it('returns 400 when provider or token is missing', async () => {
    expect((await revoke({ provider: 'github' })).status).toBe(400) // no token
    expect((await revoke({ token: 'tok' })).status).toBe(400) // no provider
  })

  it('returns 400 on a malformed JSON body', async () => {
    const res = await worker.fetch(
      { url: 'https://app.example/oauth/revoke', method: 'POST', json: async () => { throw new Error('bad') } },
      env,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for an unsupported provider (e.g. onedrive)', async () => {
    const res = await revoke({ provider: 'onedrive', token: 'tok' })
    expect(res.status).toBe(400)
  })

  it("GitHub: DELETEs only this device's token (not the account-wide grant) with Basic auth + access_token body and returns 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await revoke({ provider: 'github', token: 'gh-tok' })
    expect(res.status).toBe(204)
    const [url, opts] = fetchMock.mock.calls[0]
    // /token is device-scoped (leaves other devices' tokens alive); /grant would be account-wide.
    expect(url).toBe('https://api.github.com/applications/id/token')
    expect(opts.method).toBe('DELETE')
    expect(opts.headers.Authorization).toMatch(/^Basic /)
    expect(opts.headers['User-Agent']).toBeTruthy() // api.github.com 403s without a UA
    expect(opts.body).toContain('gh-tok')
  })

  it('GitHub: treats 404 (token already invalid) as success (204)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404 }))
    expect((await revoke({ provider: 'github', token: 'gh-tok' })).status).toBe(204)
  })

  it('GitHub: surfaces an unexpected status as 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500 }))
    expect((await revoke({ provider: 'github', token: 'gh-tok' })).status).toBe(502)
  })

  it('Google: POSTs the token to the revoke endpoint and returns 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await revoke({ provider: 'google', token: 'g-tok' })
    expect(res.status).toBe(204)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/revoke')
    expect(opts.method).toBe('POST')
    expect(opts.body.toString()).toContain('token=g-tok')
  })

  it('Google: treats 400 (token already invalid) as success (204)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))
    expect((await revoke({ provider: 'google', token: 'g-tok' })).status).toBe(204)
  })

  it('Google: surfaces an unexpected status as 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect((await revoke({ provider: 'google', token: 'g-tok' })).status).toBe(502)
  })

  it('returns 502 when the upstream revoke fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect((await revoke({ provider: 'github', token: 'gh-tok' })).status).toBe(502)
  })
})

describe('accent install icons (issue #228)', () => {
  beforeEach(() => vi.mocked(renderIconPng).mockReset())

  const fetchIcon = (path, env = {}) => worker.fetch({ url: `https://app.example${path}` }, env)

  it('serves a dynamic manifest without rendering', async () => {
    const res = await fetchIcon('/icons/i/7c3aed/manifest.webmanifest')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/manifest\+json/)
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    const body = JSON.parse(await res.text())
    expect(body.icons.map((i) => i.src)).toContain('icon-512.png')
    expect(renderIconPng).not.toHaveBeenCalled()
  })

  it('renders the exact-colour PNG for an icon request', async () => {
    vi.mocked(renderIconPng).mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    const res = await fetchIcon('/icons/i/7c3aed/icon-512.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toMatch(/immutable/)
    expect(renderIconPng).toHaveBeenCalledWith('7c3aed', 512, { maskable: false })
  })

  it('renders the maskable variant and the 192 size', async () => {
    vi.mocked(renderIconPng).mockResolvedValue(new Uint8Array([1]))
    await fetchIcon('/icons/i/7c3aed/icon-512-maskable.png')
    expect(renderIconPng).toHaveBeenCalledWith('7c3aed', 512, { maskable: true })
    await fetchIcon('/icons/i/7c3aed/icon-192.png')
    expect(renderIconPng).toHaveBeenCalledWith('7c3aed', 192, { maskable: false })
  })

  it('computes a nearest-static-swatch fallback path (used on render failure)', () => {
    // The catch in handleAccentIcon 302s to this path so a render failure can
    // never break the icon (or, since it's the same worker, asset serving).
    expect(nearestSwatchPath('7c3aed', 'icon-512.png')).toMatch(/^\/icons\/[0-9a-f]{6}\/icon-512\.png$/)
    expect(nearestSwatchPath('2d5bf5', 'icon-192.png')).toBe('/icons/2d5bf5/icon-192.png')
  })

  it('passes non-icon paths through to ASSETS', async () => {
    const env = { ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('app', { status: 200 })) } }
    await fetchIcon('/icons/i/zzz/icon-512.png', env) // invalid hex → not our route
    expect(env.ASSETS.fetch).toHaveBeenCalled()
  })
})

describe('worker Google/OneDrive OAuth callbacks — confidential-client code exchange (issue #243)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = {
    APP_URL: 'https://app.example',
    GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret',
    ONEDRIVE_CLIENT_ID: 'od-id', ONEDRIVE_CLIENT_SECRET: 'od-secret',
    DROPBOX_APP_KEY: 'db-key', DROPBOX_APP_SECRET: 'db-secret',
  }
  const callback = (provider, qs) =>
    worker.fetch({ url: `https://app.example/oauth/${provider}/callback?${qs}` }, env)

  it('Google: exchanges the code and redirects with token + refresh + expiry + provider + state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'gtok', refresh_token: 'grefresh', expires_in: 3600 }) })
    vi.stubGlobal('fetch', fetchMock)
    const loc = (await callback('google', 'code=AUTH&state=NONCE')).headers.get('location')
    expect(loc).toContain('sync_token=gtok')
    expect(loc).toContain('sync_provider=google')
    expect(loc).toContain('sync_refresh=grefresh')
    expect(loc).toContain('sync_expires=3600')
    expect(loc).toContain('state=NONCE')
    // Exchange used the secret + a redirect_uri byte-identical to the authorize one; Google gets NO scope.
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const body = new URLSearchParams(opts.body)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_id')).toBe('g-id')
    expect(body.get('client_secret')).toBe('g-secret')
    expect(body.get('redirect_uri')).toBe('https://app.example/oauth/google/callback')
    expect(body.has('scope')).toBe(false)
  })

  it('OneDrive: exchanges at the MS endpoint with scope (incl. offline_access) + matching redirect_uri', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'odtok', refresh_token: 'odrefresh', expires_in: 3600 }) })
    vi.stubGlobal('fetch', fetchMock)
    const loc = (await callback('onedrive', 'code=AUTH&state=NONCE')).headers.get('location')
    expect(loc).toContain('sync_token=odtok')
    expect(loc).toContain('sync_provider=onedrive')
    expect(loc).toContain('sync_refresh=odrefresh')
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(fetchMock.mock.calls[0][0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(body.get('redirect_uri')).toBe('https://app.example/oauth/onedrive/callback')
    expect(body.get('scope')).toContain('offline_access')
    expect(body.get('client_secret')).toBe('od-secret')
  })

  it('Dropbox: exchanges at the Dropbox token endpoint with a matching redirect_uri + secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'dbtok', refresh_token: 'dbrefresh', expires_in: 14400 }) })
    vi.stubGlobal('fetch', fetchMock)
    const loc = (await callback('dropbox', 'code=AUTH&state=NONCE')).headers.get('location')
    expect(loc).toContain('sync_token=dbtok')
    expect(loc).toContain('sync_provider=dropbox')
    expect(loc).toContain('sync_refresh=dbrefresh')
    expect(loc).toContain('state=NONCE')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.dropboxapi.com/oauth2/token')
    const body = new URLSearchParams(opts.body)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_id')).toBe('db-key')
    expect(body.get('client_secret')).toBe('db-secret')
    expect(body.get('redirect_uri')).toBe('https://app.example/oauth/dropbox/callback')
  })

  it('redirects with missing_code when no code is present', async () => {
    expect((await callback('google', 'state=x')).headers.get('location')).toBe('https://app.example/#sync_error=missing_code')
  })

  it("passes the provider's error_description through when no token comes back", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ error_description: 'bad_grant' }) }))
    expect((await callback('google', 'code=AUTH&state=N')).headers.get('location')).toBe('https://app.example/#sync_error=bad_grant')
  })

  it('redirects with server_error when the exchange throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect((await callback('onedrive', 'code=AUTH&state=N')).headers.get('location')).toBe('https://app.example/#sync_error=server_error')
  })

  it('omits sync_refresh / sync_expires when the provider returns none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'tokonly' }) }))
    const loc = (await callback('google', 'code=AUTH&state=N')).headers.get('location')
    expect(loc).toContain('sync_token=tokonly')
    expect(loc).not.toContain('sync_refresh')
    expect(loc).not.toContain('sync_expires')
  })
})

describe('worker /oauth/refresh — silent token refresh (issue #243)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = {
    GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret',
    ONEDRIVE_CLIENT_ID: 'od-id', ONEDRIVE_CLIENT_SECRET: 'od-secret',
  }
  const refresh = (body, method = 'POST') =>
    worker.fetch({ url: 'https://app.example/oauth/refresh', method, json: async () => body }, env)

  it('rejects a non-POST request with 405', async () => {
    expect((await worker.fetch({ url: 'https://app.example/oauth/refresh', method: 'GET' }, env)).status).toBe(405)
  })

  it('returns 400 for a missing/unknown provider or missing token', async () => {
    expect((await refresh({ provider: 'google' })).status).toBe(400)                      // no token
    expect((await refresh({ refresh_token: 'r' })).status).toBe(400)                      // no provider
    expect((await refresh({ provider: 'github', refresh_token: 'r' })).status).toBe(400)  // github isn't refreshable
  })

  it('returns 400 on a malformed JSON body', async () => {
    const res = await worker.fetch(
      { url: 'https://app.example/oauth/refresh', method: 'POST', json: async () => { throw new Error('bad') } }, env,
    )
    expect(res.status).toBe(400)
  })

  it('Google: POSTs grant_type=refresh_token (+secret, no scope) and returns the new access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: 'g-new', expires_in: 3600 }) })
    vi.stubGlobal('fetch', fetchMock)
    const res = await refresh({ provider: 'google', refresh_token: 'g-r' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.access_token).toBe('g-new')
    expect(json.expires_in).toBe(3600)
    expect(json.refresh_token).toBeUndefined() // Google doesn't rotate
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const body = new URLSearchParams(opts.body)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('g-r')
    expect(body.get('client_secret')).toBe('g-secret')
    expect(body.has('scope')).toBe(false)
  })

  it('OneDrive: includes scope and forwards the rotated refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: 'od-new', expires_in: 3600, refresh_token: 'od-rotated' }) })
    vi.stubGlobal('fetch', fetchMock)
    const res = await refresh({ provider: 'onedrive', refresh_token: 'od-r' })
    expect((await res.json()).refresh_token).toBe('od-rotated')
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('scope')).toContain('offline_access')
  })

  it('maps a dead refresh token (400 invalid_grant) to 401 so the app reconnects once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }))
    expect((await refresh({ provider: 'onedrive', refresh_token: 'dead' })).status).toBe(401)
  })

  it('returns 502 on a transient upstream failure (so the app retries)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    expect((await refresh({ provider: 'google', refresh_token: 'r' })).status).toBe(502)
  })

  it('returns 502 when the upstream fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect((await refresh({ provider: 'google', refresh_token: 'r' })).status).toBe(502)
  })
})
