import { renderIconPng } from './iconRender.js'
import { nearestPaletteKey } from '../src/iconPalette.js'
import { manifest } from '../config/manifest.base.js'

// Defense-in-depth response headers for the app shell (issue #129). The CSP in
// particular blunts XSS / a compromised dependency trying to exfiltrate the
// sync tokens that live in same-origin IndexedDB. Origins are the exact set the
// app uses: the sync APIs it fetches (api.github.com, gist raw content, Google
// Drive, Microsoft Graph). Fonts are self-hosted (no CDN), so font/style stay
// 'self'. The built index.html has no inline scripts, so script-src stays 'self'.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://www.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com",
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

// On-demand accent install icons (issue #228). For a custom accent the app points
// <link rel="manifest"> at /icons/i/<hex>/manifest.webmanifest, whose icon URLs are
// rendered here in the exact colour. A render failure falls back to the nearest
// pre-rendered static palette swatch, so the icon — and, since this is the same
// worker, asset serving — can never break.
const ACCENT_ICON_RE =
  /^\/icons\/i\/([0-9a-f]{6})\/(icon-192\.png|icon-512\.png|icon-512-maskable\.png|manifest\.webmanifest)$/i

// Static-swatch path a failed render falls back to (the nearest pre-rendered
// palette colour). Exported for testing.
export function nearestSwatchPath(hex, file) {
  return `/icons/${nearestPaletteKey('#' + hex)}/${file}`
}

async function handleAccentIcon(url) {
  const m = ACCENT_ICON_RE.exec(url.pathname)
  if (!m) return null
  const hex = m[1].toLowerCase()
  const file = m[2].toLowerCase()

  if (file === 'manifest.webmanifest') {
    // The manifest's relative icon srcs resolve to this folder's render routes.
    return new Response(JSON.stringify(manifest), {
      headers: {
        'content-type': 'application/manifest+json; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      },
    })
  }

  const size = file.startsWith('icon-192') ? 192 : 512
  const maskable = file.includes('maskable')
  try {
    const png = await renderIconPng(hex, size, { maskable })
    return new Response(png, {
      headers: {
        // hex + size fully determine the image — cache hard at the edge.
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    // Never let a render failure break the icon: 302 to the nearest static swatch.
    return new Response(null, {
      status: 302,
      headers: { location: `${url.origin}${nearestSwatchPath(hex, file)}` },
    })
  }
}

// Best-effort OAuth token revocation, called by the app's disconnect flow so a
// disconnect drops access provider-side instead of the provider silently
// re-issuing a token to the still-signed-in browser session. Routed through the worker for two
// reasons: GitHub's revoke needs the client *secret* (HTTP Basic), which must
// never reach the browser; and Google's, though secret-less, runs here too so
// the app gets a real status and `oauth2.googleapis.com` stays out of the
// browser CSP (the worker's own outbound fetch isn't subject to `connect-src`).
// OneDrive has no client-side per-app revoke, so the app never posts it here.
async function handleRevoke(request, env) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let provider, token
  try { ({ provider, token } = await request.json()) } catch { /* malformed body → 400 below */ }
  if (!provider || !token) return new Response('Bad Request', { status: 400 })

  try {
    if (provider === 'github') {
      // DELETE the token (device-scoped), NOT the whole grant: this kills only
      // this device's token at GitHub and leaves the user's OTHER devices'
      // tokens working (`/grant` would revoke every token for the account). The
      // app's "Connect as @you?" dialog already gates reconnect, so we don't
      // need the heavier account-wide revoke. Basic auth = the client creds.
      const basic = btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)
      const res = await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'PunchIn-Sync', // api.github.com 403s without a UA
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: token }),
      })
      // 204 = revoked; 404 = token already invalid. Both mean "nothing live left".
      return new Response(null, { status: res.status === 204 || res.status === 404 ? 204 : 502 })
    }

    if (provider === 'google') {
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      })
      // 200 = revoked; 400 = token already invalid/expired — nothing left to do.
      return new Response(null, { status: res.ok || res.status === 400 ? 204 : 502 })
    }

    return new Response('Unsupported provider', { status: 400 })
  } catch {
    return new Response(null, { status: 502 })
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const icon = await handleAccentIcon(url)
    if (icon) return withSecurityHeaders(icon)

    if (url.pathname === '/oauth/revoke') {
      return handleRevoke(request, env)
    }

    if (url.pathname !== '/oauth/github/callback') {
      return withSecurityHeaders(await env.ASSETS.fetch(request))
    }

    const code = url.searchParams.get('code')
    const appUrl = env.APP_URL || url.origin
    // Echo GitHub's `state` back to the app so it can verify the CSRF nonce it
    // minted before the redirect (issue #125).
    const state = url.searchParams.get('state')
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : ''

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
        `${appUrl}/#sync_token=${encodeURIComponent(data.access_token)}&sync_provider=github${stateParam}`
      )
    } catch {
      return Response.redirect(`${appUrl}/#sync_error=server_error`)
    }
  },
}
