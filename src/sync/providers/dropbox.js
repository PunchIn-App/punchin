const FILE_NAME = 'punchin-data.json'

// A 401 means the access token has expired or been revoked. Surface the shared
// TOKEN_EXPIRED signal so sync silently refreshes it (issue #243) — or, if the
// refresh token is gone too, the UI prompts re-authentication. Other statuses
// pass through. (Copied verbatim from google.js/onedrive.js — must not diverge.)
function httpError(label, status) {
  return new Error(status === 401 ? 'TOKEN_EXPIRED' : `${label} ${status}`)
}

const SCOPE = 'files.content.write files.content.read files.metadata.read'

// Dropbox uses the Authorization Code flow as a CONFIDENTIAL client via the
// worker (like Google/OneDrive): the authorize endpoint returns a single-use
// `code`; the worker (which holds DROPBOX_APP_SECRET) exchanges it at
// /oauth/dropbox/callback and hands back an access token PLUS a refresh token.
// `token_access_type=offline` is what makes Dropbox issue the refresh token —
// without it there is no silent renewal. App-folder scopes sandbox us to
// /Apps/<AppName>/ in the user's Dropbox (issue #295).
export function buildDropboxOAuthUrl(clientId, callbackBase, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${callbackBase}/oauth/dropbox/callback`,
    response_type: 'code',
    token_access_type: 'offline',
    scope: SCOPE,
    // CSRF nonce verified on return (issue #125); the worker echoes it back and
    // the provider is identified by the callback path, so no provider prefix.
    ...(state ? { state } : {}),
  })
  return `https://www.dropbox.com/oauth2/authorize?${params}`
}

// Fetch the signed-in Dropbox account's identity for the connect-confirm dialog
// (parity with the other providers). get_current_account takes NO parameters and
// MUST be called with no request body and no Content-Type header. Returns the
// best human-readable identifier, or null on any error so a failed lookup never
// blocks connecting.
export async function fetchDropboxUser(token) {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const acct = await res.json()
  return acct.email || acct.name?.display_name || null
}

// Write the whole snapshot to the single app-folder file (create-or-overwrite).
// Content endpoints carry their JSON args in the Dropbox-API-Arg header, not the
// body; the body is the raw file bytes.
export async function pushToDropbox(token, data) {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: `/${FILE_NAME}`, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw httpError('Dropbox', res.status)
  return (await res.json()).id
}

// Read the single app-folder file. Dropbox signals a missing file with HTTP 409
// and a `path/not_found` error summary (NOT a clean 404 like OneDrive) — that's
// the first-sync case, so return null. A 401 still maps to TOKEN_EXPIRED.
export async function pullFromDropbox(token) {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: `/${FILE_NAME}` }),
    },
  })
  if (res.status === 409) {
    const detail = await res.text().catch(() => '')
    if (detail.includes('not_found')) return null
    throw httpError('Dropbox download', 409)
  }
  if (!res.ok) throw httpError('Dropbox download', res.status)
  return res.json()
}
