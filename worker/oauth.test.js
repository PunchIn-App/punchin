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
