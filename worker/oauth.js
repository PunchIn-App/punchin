export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname !== '/oauth/github/callback') {
      return env.ASSETS.fetch(request)
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
