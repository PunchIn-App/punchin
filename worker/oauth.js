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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const icon = await handleAccentIcon(url)
    if (icon) return withSecurityHeaders(icon)

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
