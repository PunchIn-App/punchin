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

export function buildGitHubOAuthUrl(clientId, callbackBase, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${callbackBase}/oauth/github/callback`,
    scope: 'gist',
  })
  if (state) params.set('state', state) // CSRF nonce, echoed back via the worker (issue #125)
  return `https://github.com/login/oauth/authorize?${params}`
}

export async function fetchGitHubUser(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
  })
  if (!res.ok) return null
  return res.json()
}

// Safety bound on how many gist pages to scan (~10k gists). Prevents an
// unbounded loop while being far above any realistic account size — replaces
// the old hard 3-page (300-gist) cap that could miss a PunchIn gist for users
// with many gists.
const MAX_GIST_PAGES = 100

export async function findExistingPunchInGist(token) {
  // The marker file (`- PunchIn Sync`) is the authoritative signal that a gist
  // is PunchIn's. A gist that merely contains a `punchin-data-*` file (e.g. an
  // unrelated `punchin-data-notes.json`) or the legacy `punchin-data.json` is
  // only a *fallback* — adopted solely when no marker-bearing gist exists
  // anywhere in the account. So we must scan every page before settling for a
  // fallback, but can return a marker match the moment we see one.
  let fallback = null
  for (let page = 1; page <= MAX_GIST_PAGES; page++) {
    const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, ...GH_HEADERS },
    })
    if (!res.ok) throw new Error(`GitHub ${res.status}`)
    const gists = await res.json()
    if (gists.length === 0) break

    const marker = gists.find(g => MARKER_FILENAME in g.files)
    if (marker) return marker.id

    if (!fallback) {
      const legacy = gists.find(g =>
        LEGACY_FILENAME in g.files ||
        Object.keys(g.files).some(f => f.startsWith(DATA_PREFIX + '-'))
      )
      if (legacy) fallback = legacy.id
    }

    if (gists.length < 100) break
  }
  return fallback
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
