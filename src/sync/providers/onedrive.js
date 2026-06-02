const FILE_NAME = 'punchin-data.json'

export function buildOneDriveOAuthUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + '/',
    response_type: 'token',
    scope: 'Files.ReadWrite.AppFolder User.Read',
    state: 'onedrive',
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
  if (!res.ok) throw new Error(`OneDrive ${res.status}`)
  return (await res.json()).id
}

export async function pullFromOneDrive(token) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${FILE_NAME}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`OneDrive ${res.status}`)
  return res.json()
}
