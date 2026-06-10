const FILE_NAME = 'punchin-data.json'

// A 401 means the access token has expired or been revoked. Surface the shared
// TOKEN_EXPIRED signal so sync silently refreshes it (issue #243) — or, if the
// refresh token is gone too, the UI prompts re-authentication (issue #121).
// Other statuses pass through.
function httpError(label, status) {
  return new Error(status === 401 ? 'TOKEN_EXPIRED' : `${label} ${status}`)
}

const SCOPE = 'Files.ReadWrite.AppFolder User.Read'

// OneDrive uses the Authorization Code flow as a CONFIDENTIAL client via the
// worker (issue #243), upgrading the earlier public-SPA + PKCE flow (issue #128).
// The authorize endpoint returns a single-use `code`; the worker (which holds
// the client secret) exchanges it at /oauth/onedrive/callback and hands back an
// access token PLUS a refresh token. The `offline_access` scope is what makes
// Microsoft issue the refresh token, and a confidential-client refresh token
// lasts 90 days (vs 24h for an SPA redirect URI) — so this requires the Azure
// app registration to expose the redirect URI under the "Web" platform, not
// "Single-page application" (see the PR runbook). Tradeoff vs #128: the token
// now travels back via the URL fragment (scrubbed on arrival) rather than a
// direct POST — the cost of moving the secret-bearing exchange server-side.
export function buildOneDriveOAuthUrl(clientId, callbackBase, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${callbackBase}/oauth/onedrive/callback`,
    response_type: 'code',
    scope: `${SCOPE} offline_access`,
    // CSRF nonce verified on return (issue #125); the worker echoes it back and
    // the provider is identified by the callback path, so no provider prefix.
    ...(state ? { state } : {}),
    // Always show the account chooser instead of silently re-using the
    // already-signed-in Microsoft account on reconnect.
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

// Fetch the signed-in Microsoft account's identity so the connect dialog can
// show WHICH account is being linked — parity with GitHub, which has always
// shown its account (issue #243 follow-up). Uses the `User.Read` scope already
// requested above (no new consent). Returns the best human-readable identifier,
// or null on any error so a failed lookup never blocks connecting.
export async function fetchOneDriveUser(token) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const me = await res.json()
  return me.userPrincipalName || me.mail || me.displayName || null
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
