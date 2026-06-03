const MARKER_FILENAME = '- PunchIn Sync'
const DATA_PREFIX = 'punchin-data'
const LEGACY_FILENAME = 'punchin-data.json'
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

const MARKER_CONTENT = JSON.stringify({
  app: 'PunchIn',
  version: 1,
  note: 'This gist is managed by PunchIn. Do not edit manually.',
})

export function getDeviceFilename(deviceId) {
  return `${DATA_PREFIX}-${deviceId}.json`
}

export function buildGitHubOAuthUrl(clientId, callbackBase) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${callbackBase}/oauth/github/callback`,
    scope: 'gist',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export async function fetchGitHubUser(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
  })
  if (!res.ok) return null
  return res.json()
}

export async function findExistingPunchInGist(token) {
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
    })
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    const gists = await res.json()
    if (gists.length === 0) break
    const found = gists.find(g =>
      MARKER_FILENAME in g.files ||
      LEGACY_FILENAME in g.files ||
      Object.keys(g.files).some(f => f.startsWith(DATA_PREFIX + '-'))
    )
    if (found) return found.id
    if (gists.length < 100) break
  }
  return null
}

export async function createGist(token, deviceId, data) {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...GH_HEADERS },
    body: JSON.stringify({
      description: 'PunchIn time tracking data',
      public: false,
      files: {
        [MARKER_FILENAME]: { content: MARKER_CONTENT },
        [getDeviceFilename(deviceId)]: { content: JSON.stringify(data) },
      },
    }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return (await res.json()).id
}

export async function fetchAllDeviceData(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const gist = await res.json()

  const snapshots = []
  for (const [name, file] of Object.entries(gist.files)) {
    if (name !== LEGACY_FILENAME && !name.startsWith(DATA_PREFIX + '-')) continue
    if (name === MARKER_FILENAME) continue
    try {
      let data
      if (file.truncated) {
        const raw = await fetch(file.raw_url)
        data = await raw.json()
      } else {
        data = JSON.parse(file.content)
      }
      if (data && typeof data.version !== 'undefined') snapshots.push(data)
    } catch {
      // skip malformed files silently
    }
  }
  return snapshots
}

export async function pushDeviceData(token, gistId, deviceId, data) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...GH_HEADERS },
    body: JSON.stringify({
      files: {
        [MARKER_FILENAME]: { content: MARKER_CONTENT },
        [getDeviceFilename(deviceId)]: { content: JSON.stringify(data) },
      },
    }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
}

export async function deleteDeviceFile(token, gistId, deviceId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...GH_HEADERS },
    body: JSON.stringify({ files: { [getDeviceFilename(deviceId)]: null } }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
}

export async function updateGist(token, gistId, data) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...GH_HEADERS },
    body: JSON.stringify({ files: { [LEGACY_FILENAME]: { content: JSON.stringify(data) } } }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
}

export async function fetchGist(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const gist = await res.json()
  const file = gist.files[LEGACY_FILENAME]
  if (!file) throw new Error('No PunchIn data found in Gist')
  if (file.truncated) {
    const raw = await fetch(file.raw_url)
    return raw.json()
  }
  return JSON.parse(file.content)
}
