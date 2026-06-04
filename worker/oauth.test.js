import worker, { withSecurityHeaders } from './oauth.js'

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
    expect(csp).toContain('https://fonts.gstatic.com')
    expect(csp).toContain('https://fonts.googleapis.com')

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
