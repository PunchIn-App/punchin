const FILENAME = 'punchin-data.json'

export function buildGitHubOAuthUrl(clientId, callbackBase) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${callbackBase}/oauth/github/callback`,
    scope: 'gist',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export async function createGist(token, data) {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      description: 'PunchIn time tracking data',
      public: false,
      files: { [FILENAME]: { content: JSON.stringify(data) } },
    }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return (await res.json()).id
}

export async function updateGist(token, gistId, data) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(data) } } }),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
}

export async function fetchGist(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const gist = await res.json()
  const file = gist.files[FILENAME]
  if (!file) throw new Error('No PunchIn data found in Gist')
  if (file.truncated) {
    const raw = await fetch(file.raw_url)
    return raw.json()
  }
  return JSON.parse(file.content)
}
