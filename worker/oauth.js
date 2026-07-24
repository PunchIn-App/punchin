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
  "connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://www.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com https://api.dropboxapi.com https://content.dropboxapi.com",
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

async function handleGitHubCallback(url, env) {
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
    // GitHub gist tokens don't expire — no refresh/expiry to forward (issue #243).
    return Response.redirect(
      `${appUrl}/#sync_token=${encodeURIComponent(data.access_token)}&sync_provider=github${stateParam}`
    )
  } catch {
    return Response.redirect(`${appUrl}/#sync_error=server_error`)
  }
}

// Google & OneDrive run the Authorization Code flow as a CONFIDENTIAL client so
// the issued grant includes a long-lived refresh token (issue #243): Google's
// refresh token doesn't expire (published app), Microsoft's lasts 90 days for a
// confidential client (vs 24h for an SPA redirect URI) and ROTATES on each use.
// Both require the client *secret* for the code→token exchange — which must never
// reach the browser — so the exchange (and later refresh) runs here in the worker.
// `scope` is sent for Microsoft (a subset/equal of the authorize scopes, per MS
// docs); Google derives the scope from the grant and rejects a redundant one.
const OAUTH_PROVIDERS = {
  google: {
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    idVar: 'GOOGLE_CLIENT_ID',
    secretVar: 'GOOGLE_CLIENT_SECRET',
    scope: null,
  },
  onedrive: {
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    idVar: 'ONEDRIVE_CLIENT_ID',
    secretVar: 'ONEDRIVE_CLIENT_SECRET',
    scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
  },
  // Dropbox confidential-client code exchange (issue #295). token_access_type=
  // offline (set on the authorize URL by buildDropboxOAuthUrl) yields the refresh
  // token; the code→token and refresh exchanges POST client_id/client_secret as
  // form fields, so the generic handler works unchanged.
  dropbox: {
    tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
    idVar: 'DROPBOX_APP_KEY',
    secretVar: 'DROPBOX_APP_SECRET',
    scope: null,
  },
}

// Exchange a provider's authorization `code` for tokens, then hand the app back
// the access token + its lifetime + the refresh token via the URL fragment
// (scrubbed on arrival in App.jsx, same channel as GitHub/Google). The
// redirect_uri MUST be byte-identical to the one the app sent to the authorize
// endpoint — both resolve to `${APP_URL}/oauth/<provider>/callback`, so APP_URL
// (worker) and VITE_APP_URL (build) must match the registered redirect URI.
async function handleProviderCallback(url, env, provider) {
  const p = OAUTH_PROVIDERS[provider]
  const appUrl = env.APP_URL || url.origin
  const state = url.searchParams.get('state')
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : ''
  const code = url.searchParams.get('code')

  if (!code) {
    return Response.redirect(`${appUrl}/#sync_error=missing_code`)
  }

  try {
    const body = {
      client_id: env[p.idVar],
      client_secret: env[p.secretVar],
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/oauth/${provider}/callback`,
    }
    if (p.scope) body.scope = p.scope
    const res = await fetch(p.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
    const data = await res.json()
    if (!data.access_token) {
      return Response.redirect(`${appUrl}/#sync_error=${encodeURIComponent(data.error_description || 'auth_failed')}`)
    }
    const frag = [
      `sync_token=${encodeURIComponent(data.access_token)}`,
      `sync_provider=${provider}`,
    ]
    if (data.refresh_token) frag.push(`sync_refresh=${encodeURIComponent(data.refresh_token)}`)
    if (data.expires_in)    frag.push(`sync_expires=${encodeURIComponent(data.expires_in)}`)
    return Response.redirect(`${appUrl}/#${frag.join('&')}${stateParam}`)
  } catch {
    return Response.redirect(`${appUrl}/#sync_error=server_error`)
  }
}

// Silent background refresh (issue #243): the app POSTs {provider, refresh_token}
// here and the worker trades it for a fresh access token using the client secret.
// Status codes are the contract the app's tokenStore reads:
//   401  → the refresh token is revoked/expired (invalid_grant): reconnect needed
//   502  → upstream/transient failure: the app retries on the next sync tick
//   200  → { access_token, expires_in, refresh_token? } (refresh_token only when
//          the provider rotated it — Microsoft does, Google doesn't)
async function handleRefresh(request, env) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let provider, refresh_token
  try { ({ provider, refresh_token } = await request.json()) } catch { /* malformed → 400 below */ }
  const p = OAUTH_PROVIDERS[provider]
  if (!p || !refresh_token) return new Response('Bad Request', { status: 400 })

  try {
    const body = {
      client_id: env[p.idVar],
      client_secret: env[p.secretVar],
      grant_type: 'refresh_token',
      refresh_token,
    }
    if (p.scope) body.scope = p.scope
    const res = await fetch(p.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
    const data = await res.json().catch(() => ({}))
    // A dead refresh token surfaces as 400 invalid_grant from both providers —
    // map it to 401 so the app prompts a one-time reconnect (not an endless retry).
    if (res.status === 400 && data.error === 'invalid_grant') {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!res.ok || !data.access_token) return new Response('Bad Gateway', { status: 502 })
    return new Response(JSON.stringify({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token, // present only when the provider rotates it
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response('Bad Gateway', { status: 502 })
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const icon = await handleAccentIcon(url)
    if (icon) return withSecurityHeaders(icon)

    if (url.pathname === '/oauth/revoke')  return handleRevoke(request, env)
    if (url.pathname === '/oauth/refresh') return handleRefresh(request, env)
    if (url.pathname === '/oauth/google/callback')   return handleProviderCallback(url, env, 'google')
    if (url.pathname === '/oauth/onedrive/callback') return handleProviderCallback(url, env, 'onedrive')
    if (url.pathname === '/oauth/dropbox/callback')  return handleProviderCallback(url, env, 'dropbox')
    if (url.pathname === '/oauth/github/callback')   return handleGitHubCallback(url, env)

    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
