// Defense-in-depth response headers for the app shell (issue #129). The CSP in
// particular blunts XSS / a compromised dependency trying to exfiltrate the
// sync tokens that live in same-origin IndexedDB. Origins are the exact set the
// app uses: Google Fonts (style/font), and the sync APIs it fetches
// (api.github.com, gist raw content, Google Drive, Microsoft Graph). The built
// index.html has no inline scripts, so script-src can stay 'self'.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://www.googleapis.com https://graph.microsoft.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
}

// Re-emit an asset response with the security headers added (preserving the
// original status/body/headers). Responses from ASSETS are immutable, so a new
// Response is constructed.
export function withSecurityHeaders(res) {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname !== '/oauth/github/callback') {
      return withSecurityHeaders(await env.ASSETS.fetch(request))
    }

    const code = url.searchParams.get('code')
    const appUrl = env.APP_URL || url.origin

    if (!code) {
      return Response.redirect(`${appUrl}/#sync_error=missing_code`)
    }

    try {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      })
      const data = await res.json()
      if (!data.access_token) {
        return Response.redirect(`${appUrl}/#sync_error=${encodeURIComponent(data.error_description || 'auth_failed')}`)
      }
      return Response.redirect(
        `${appUrl}/#sync_token=${encodeURIComponent(data.access_token)}&sync_provider=github`
      )
    } catch {
      return Response.redirect(`${appUrl}/#sync_error=server_error`)
    }
  },
}
