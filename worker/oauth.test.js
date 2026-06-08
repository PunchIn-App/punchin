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
