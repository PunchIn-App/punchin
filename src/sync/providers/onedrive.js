const FILE_NAME = 'punchin-data.json'

// A 401 means the (implicit-flow, ~1h) access token has expired or been revoked.
// Surface the shared TOKEN_EXPIRED signal so the UI prompts re-authentication
// instead of showing a raw status code (issue #121). Other statuses pass through.
function httpError(label, status) {
  return new Error(status === 401 ? 'TOKEN_EXPIRED' : `${label} ${status}`)
}

export function buildOneDriveOAuthUrl(clientId, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + '/',
    response_type: 'token',
    scope: 'Files.ReadWrite.AppFolder User.Read',
    // `state` carries the provider label (for callback routing) plus a CSRF
    // nonce verified on return (issue #125): `onedrive:<nonce>`.
    state: state ? `onedrive:${state}` : 'onedrive',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
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
