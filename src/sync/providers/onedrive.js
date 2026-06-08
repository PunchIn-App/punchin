const FILE_NAME = 'punchin-data.json'

// A 401 means the (implicit-flow, ~1h) access token has expired or been revoked.
// Surface the shared TOKEN_EXPIRED signal so the UI prompts re-authentication
// instead of showing a raw status code (issue #121). Other statuses pass through.
function httpError(label, status) {
  return new Error(status === 401 ? 'TOKEN_EXPIRED' : `${label} ${status}`)
}

const SCOPE = 'Files.ReadWrite.AppFolder User.Read'
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

// OneDrive uses the Authorization Code flow with PKCE (issue #128): the
// authorize endpoint returns a single-use `code` in the query string (not the
// token in the URL fragment), which the app exchanges for the token via a
// direct CORS POST below. Requires the Azure app registration to expose a
// "Single-page application" redirect URI (see the PR's runbook).
export function buildOneDriveOAuthUrl(clientId, state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + '/',
    response_type: 'code',
    scope: SCOPE,
    // `state` carries the provider label (for callback routing) plus a CSRF
    // nonce verified on return (issue #125): `onedrive:<nonce>`.
    state: state ? `onedrive:${state}` : 'onedrive',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // Always show the account chooser instead of silently re-using the
    // already-signed-in Microsoft account on reconnect. OneDrive has no
    // client-side per-app revoke (its ~1h token just expires), so this prompt is
    // the lever that keeps a reconnect from "pushing right through".
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

// Exchange the authorization code + PKCE verifier for an access token. OneDrive
// is a public SPA client, so no client secret is involved and this runs entirely
// in the browser via a CORS token request — the token is never in the URL.
export async function exchangeOneDriveCode(clientId, code, codeVerifier) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: window.location.origin + '/',
      code_verifier: codeVerifier,
      scope: SCOPE,
    }),
  })
  if (!res.ok) throw httpError('OneDrive', res.status)
  return res.json()
}

export async function pushToOneDrive(token, data) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${FILE_NAME}:/content`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )
  if (!res.ok) throw httpError('OneDrive', res.status)
  return (await res.json()).id
}

export async function pullFromOneDrive(token) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${FILE_NAME}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 404) return null
  if (!res.ok) throw httpError('OneDrive', res.status)
  return res.json()
}
