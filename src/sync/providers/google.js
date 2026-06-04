const FILE_NAME = 'punchin-data.json'

// A 401 means the (implicit-flow, ~1h) access token has expired or been revoked.
// Surface the shared TOKEN_EXPIRED signal so the UI prompts re-authentication
// instead of showing a raw status code (issue #121). Other statuses pass through.
function httpError(label, status) {
  return new Error(status === 401 ? 'TOKEN_EXPIRED' : `${label} ${status}`)
}

// Google intentionally stays on the implicit flow (response_type=token), unlike
// OneDrive's Auth Code + PKCE (issue #128). Google "Web application" OAuth
// clients require the client *secret* for the code→token exchange even with
// PKCE — there is no no-secret public-client web flow. Doing Auth Code for
// Google would therefore require routing the exchange through a server with the
// secret, and a stateless Cloudflare Worker can only hand the token back to the
// SPA via the URL fragment again — so it wouldn't achieve the goal of keeping
// the token out of the URL without a stateful backend. The fragment is already
// scrubbed immediately on return (App.jsx), which is the available mitigation.
export function buildGoogleOAuthUrl(clientId, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + '/',
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    // `state` carries the provider label (for callback routing) plus a CSRF
    // nonce verified on return (issue #125): `google:<nonce>`.
    state: state ? `google:${state}` : 'google',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function findFileId(token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw httpError('Drive', res.status)
  const { files } = await res.json()
  return files?.[0]?.id ?? null
}

export async function pushToDrive(token, data) {
  const existingId = await findFileId(token)
  const content = JSON.stringify(data)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: content,
      }
    )
    if (!res.ok) throw httpError('Drive', res.status)
    return existingId
  }

  const boundary = 'punchin_mp'
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
  const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  if (!res.ok) throw httpError('Drive', res.status)
  return (await res.json()).id
}

export async function pullFromDrive(token) {
  const fileId = await findFileId(token)
  if (!fileId) return null
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw httpError('Drive', res.status)
  return res.json()
}
