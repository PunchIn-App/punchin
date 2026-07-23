# Dropbox Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dropbox as a fourth opt-in cloud-sync provider by cloning the Google/OneDrive single-file OAuth pattern.

**Architecture:** A new `src/sync/providers/dropbox.js` (4 exports mirroring `onedrive.js`) + a `dropbox` entry in the Worker's `OAUTH_PROVIDERS` (reusing the existing code→token and refresh handlers) + config/syncManager/App.jsx/DataSyncPanel wiring. No changes to the merge engine or token store. Data plane is called directly from the browser (Dropbox CORS is open); only the OAuth exchange goes through the Worker.

**Tech Stack:** React 19, Vite, Vitest (jsdom), Cloudflare Worker (`worker/oauth.js`), Dexie. Tests run with `npm run test:run` (which passes `--config config/vite.config.js`; a bare `npx vitest` does NOT pick up the jsdom env).

## Global Constraints

- Run tests with: `npx vitest run --config config/vite.config.js <files>` (or `npm run test:run` for the full suite). A bare `npx vitest` uses the wrong (node) environment.
- The client provider module MUST raise the literal string `'TOKEN_EXPIRED'` on a 401 — the refresh/reconnect machinery keys on it.
- Single shared file name: `punchin-data.json` (App-folder-relative path `/punchin-data.json`). No per-device files.
- Dropbox scopes: `files.content.write files.content.read files.metadata.read`. Authorize URL MUST include `token_access_type=offline` (required for a refresh token).
- Client id build var: `VITE_DROPBOX_APP_KEY` (public). Worker secret: `DROPBOX_APP_SECRET`. Redirect: `${callbackBase}/oauth/dropbox/callback`.
- Version bump: MINOR → `0.34.0` (new user-visible feature). Docs-Sync CI requires the new provider file in `docs/ARCHITECTURE.md`, the new test file in `docs/TEST-COVERAGE.md`, and a `docs/CHANGELOG.md` `[0.34.0]` section + `SECURITY.md` supported-versions on a minor bump.
- Passing bar: `npm run build` AND `npm run test:run` both green (the 5 pre-existing `deviceId.test.js` jsdom-local failures are unrelated and out of scope).

---

## File Structure

- **Create:** `src/sync/providers/dropbox.js` — the provider (buildDropboxOAuthUrl, fetchDropboxUser, pushToDropbox, pullFromDropbox, httpError).
- **Create:** `src/sync/providers/dropbox.test.js` — provider unit tests.
- **Modify:** `worker/oauth.js` — `OAUTH_PROVIDERS.dropbox`, `/oauth/dropbox/callback` route, CSP `connect-src` origins.
- **Modify:** `worker/oauth.test.js` — dropbox CSP + callback tests.
- **Modify:** `src/sync/config.js` — `dropbox` registry entry.
- **Modify:** `src/sync/syncManager.js` — dropbox import + runSync branch.
- **Modify:** `src/sync/syncManager.test.js` — dropbox mock + runSync branch test.
- **Modify:** `src/App.jsx` — `fetchDropboxUser` import, `PROVIDER_CONNECT.dropbox`, callback dispatch.
- **Modify:** `src/views/settings/DataSyncPanel.jsx` — Dropbox connect button + `PROVIDER_LABEL` + empty-state guard.
- **Modify:** `src/views/settings/DataSyncPanel.test.jsx` — dropbox mock + button test.
- **Modify (docs/version):** `package.json`, `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/TEST-COVERAGE.md`, `SECURITY.md`, `README.md`, `CLAUDE.md`, `.env.example`, `wrangler.jsonc`.

---

## Task 1: Dropbox provider module

**Files:**
- Create: `src/sync/providers/dropbox.js`
- Test: `src/sync/providers/dropbox.test.js`

**Interfaces:**
- Produces: `buildDropboxOAuthUrl(clientId, callbackBase, state) → string`; `fetchDropboxUser(token) → Promise<string|null>`; `pushToDropbox(token, data) → Promise<string>` (returns the uploaded file id); `pullFromDropbox(token) → Promise<object|null>`.

- [ ] **Step 1: Write the failing tests**

Create `src/sync/providers/dropbox.test.js`:

```js
import { buildDropboxOAuthUrl, pushToDropbox, pullFromDropbox, fetchDropboxUser } from './dropbox'

describe('buildDropboxOAuthUrl (Auth Code via worker, confidential client)', () => {
  const BASE = 'https://app.example'

  it('points to the Dropbox authorize endpoint', () => {
    expect(buildDropboxOAuthUrl('db-key', BASE)).toMatch(/^https:\/\/www\.dropbox\.com\/oauth2\/authorize/)
  })

  it('includes the client_id (app key)', () => {
    expect(buildDropboxOAuthUrl('db-key', BASE)).toContain('client_id=db-key')
  })

  it('uses response_type=code with NO PKCE challenge (the worker holds the secret)', () => {
    const url = buildDropboxOAuthUrl('id', BASE, 'nonce')
    expect(new URL(url).searchParams.get('response_type')).toBe('code')
    expect(url).not.toContain('code_challenge')
  })

  it('requests token_access_type=offline (required for a refresh token)', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('token_access_type')).toBe('offline')
  })

  it('requests the app-folder file scopes', () => {
    const scope = new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('scope')
    expect(scope).toContain('files.content.write')
    expect(scope).toContain('files.content.read')
    expect(scope).toContain('files.metadata.read')
  })

  it('points redirect_uri at the worker callback under the callbackBase', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.get('redirect_uri')).toBe('https://app.example/oauth/dropbox/callback')
  })

  it('carries the raw CSRF nonce in state (provider identified by callback path)', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE, 'nonce123')).searchParams.get('state')).toBe('nonce123')
  })

  it('omits state entirely when no nonce is given', () => {
    expect(new URL(buildDropboxOAuthUrl('id', BASE)).searchParams.has('state')).toBe(false)
  })
})

describe('pushToDropbox', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('POSTs to the content upload endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id:abc' }) })
    await pushToDropbox('token', { version: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://content.dropboxapi.com/2/files/upload',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends the Bearer token and an overwrite Dropbox-API-Arg for /punchin-data.json', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x' }) })
    await pushToDropbox('my-token', {})
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
    const arg = JSON.parse(opts.headers['Dropbox-API-Arg'])
    expect(arg).toEqual({ path: '/punchin-data.json', mode: 'overwrite', mute: true })
  })

  it('JSON-stringifies the snapshot in the request body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x' }) })
    const snapshot = { version: 1, jobs: [], entries: [], laborTypes: [] }
    await pushToDropbox('token', snapshot)
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual(snapshot)
  })

  it('returns the uploaded file id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id:abc' }) })
    expect(await pushToDropbox('token', {})).toBe('id:abc')
  })

  it('throws with status code on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 })
    await expect(pushToDropbox('token', {})).rejects.toThrow('Dropbox 403')
  })

  it('throws TOKEN_EXPIRED on a 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pushToDropbox('token', {})).rejects.toThrow('TOKEN_EXPIRED')
  })
})

describe('pullFromDropbox', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns null when the file is not found (409 path/not_found = first sync)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => '{"error_summary":"path/not_found/..","error":{".tag":"path"}}' })
    expect(await pullFromDropbox('token')).toBeNull()
  })

  it('throws on a 409 that is NOT a not_found', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => '{"error_summary":"path/conflict/.."}' })
    await expect(pullFromDropbox('token')).rejects.toThrow('Dropbox download 409')
  })

  it('returns parsed JSON when the file exists', async () => {
    const data = { version: 1, jobs: [], entries: [], laborTypes: [] }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => data })
    expect(await pullFromDropbox('token')).toEqual(data)
  })

  it('sends the Bearer token and a download Dropbox-API-Arg', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await pullFromDropbox('my-token')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://content.dropboxapi.com/2/files/download')
    expect(opts.headers['Authorization']).toBe('Bearer my-token')
    expect(JSON.parse(opts.headers['Dropbox-API-Arg'])).toEqual({ path: '/punchin-data.json' })
  })

  it('throws with status code on other errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(pullFromDropbox('token')).rejects.toThrow('Dropbox download 500')
  })

  it('throws TOKEN_EXPIRED on a 401 (so the UI prompts re-auth)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(pullFromDropbox('token')).rejects.toThrow('TOKEN_EXPIRED')
  })
})

describe('fetchDropboxUser', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('POSTs get_current_account with the bearer token and returns the email', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'rob@dropbox.com', name: { display_name: 'Rob' } }) })
    expect(await fetchDropboxUser('token123')).toBe('rob@dropbox.com')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.dropboxapi.com/2/users/get_current_account')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer token123')
  })

  it('falls back to the display name when there is no email', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: { display_name: 'Rob P' } }) })
    expect(await fetchDropboxUser('t')).toBe('Rob P')
  })

  it('returns null on a failed lookup rather than throwing (never blocks connecting)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    expect(await fetchDropboxUser('t')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config config/vite.config.js src/sync/providers/dropbox.test.js`
Expected: FAIL — `Failed to resolve import "./dropbox"` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/sync/providers/dropbox.js`:

```js
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
// /Apps/<AppName>/ in the user's Dropbox.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config config/vite.config.js src/sync/providers/dropbox.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/sync/providers/dropbox.js src/sync/providers/dropbox.test.js
git commit -m "feat(sync): Dropbox provider module (build/fetch-user/push/pull) (#295)"
```

---

## Task 2: Worker OAuth provider, route, and CSP

**Files:**
- Modify: `worker/oauth.js` (`OAUTH_PROVIDERS`, the route dispatch near line 308-310, the CSP `connect-src` near line 17)
- Test: `worker/oauth.test.js`

**Interfaces:**
- Consumes: `handleProviderCallback(url, env, provider)` (existing, generic).
- Produces: a `/oauth/dropbox/callback` route and `OAUTH_PROVIDERS.dropbox`.

- [ ] **Step 1: Write the failing tests**

Add to `worker/oauth.test.js` (new `describe` blocks; keep existing tests untouched). Note the existing file imports the worker as `worker` and calls `worker.fetch(request, env)`:

```js
describe('worker Dropbox OAuth (issue #295)', () => {
  it('CSP connect-src allows the Dropbox api + content hosts', async () => {
    const res = await worker.fetch({ url: 'https://app.example/index.html' }, {})
    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toContain('https://api.dropboxapi.com')
    expect(csp).toContain('https://content.dropboxapi.com')
  })

  it('exchanges the dropbox code and redirects with sync_provider=dropbox + tokens', async () => {
    const env = {
      APP_URL: 'https://app.example',
      DROPBOX_APP_KEY: 'db-key',
      DROPBOX_APP_SECRET: 'db-secret',
    }
    const fetchMock = vi.fn().mockResolvedValueOnce({
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 14400 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await worker.fetch(
        { url: 'https://app.example/oauth/dropbox/callback?code=abc&state=NONCE' }, env,
      )
      // handleProviderCallback POSTs the token endpoint...
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.dropboxapi.com/oauth2/token',
        expect.objectContaining({ method: 'POST' }),
      )
      // ...then redirects back to the app with the tokens in the fragment.
      const loc = res.headers.get('Location')
      expect(loc).toContain('sync_provider=dropbox')
      expect(loc).toContain('sync_token=at')
      expect(loc).toContain('sync_refresh=rt')
      expect(loc).toContain('state=NONCE')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config config/vite.config.js worker/oauth.test.js -t "Dropbox"`
Expected: FAIL — CSP has no dropbox hosts; the dropbox callback path isn't routed (redirects to a non-dropbox path or 404).

- [ ] **Step 3: Implement the three edits in `worker/oauth.js`**

Edit 1 — CSP `connect-src` (the line currently ending `...https://login.microsoftonline.com"`): append the two Dropbox origins:

```js
  "connect-src 'self' https://api.github.com https://gist.githubusercontent.com https://www.googleapis.com https://graph.microsoft.com https://login.microsoftonline.com https://api.dropboxapi.com https://content.dropboxapi.com",
```

Edit 2 — add to `OAUTH_PROVIDERS` (after the `onedrive` entry):

```js
  dropbox: {
    tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
    idVar: 'DROPBOX_APP_KEY',
    secretVar: 'DROPBOX_APP_SECRET',
    scope: null,
  },
```

Edit 3 — add the route (beside the google/onedrive callback routes, ~line 309):

```js
    if (url.pathname === '/oauth/dropbox/callback') return handleProviderCallback(url, env, 'dropbox')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config config/vite.config.js worker/oauth.test.js`
Expected: PASS (the new Dropbox block + all existing worker tests).

- [ ] **Step 5: Commit**

```bash
git add worker/oauth.js worker/oauth.test.js
git commit -m "feat(sync): Worker Dropbox OAuth provider, callback route, and CSP (#295)"
```

---

## Task 3: Client config + syncManager branch

**Files:**
- Modify: `src/sync/config.js`
- Modify: `src/sync/syncManager.js` (import near line 10-11; runSync branch near line 314-319)
- Test: `src/sync/syncManager.test.js`

**Interfaces:**
- Consumes: `pushToDropbox`, `pullFromDropbox` (Task 1); `SYNC_CONFIG.dropbox`.
- Produces: a `dropbox` runSync branch.

- [ ] **Step 1: Add the config entry (no test needed — trivial data; covered by the panel test in Task 4)**

In `src/sync/config.js`, add after the `onedrive` entry inside `SYNC_CONFIG`:

```js
  dropbox: {
    clientId: import.meta.env.VITE_DROPBOX_APP_KEY || '',
    // Auth Code flow via the worker at /oauth/dropbox/callback (issue #295)
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
```

- [ ] **Step 2: Write the failing syncManager test**

In `src/sync/syncManager.test.js`, add a dropbox mock beside the google/onedrive mocks (near line 28):

```js
vi.mock('./providers/dropbox', () => ({
  pushToDropbox: vi.fn(),
  pullFromDropbox: vi.fn(),
}))
```

Add the import beside the other provider imports (near line 7):

```js
import * as dropbox from './providers/dropbox'
```

Then add this test (place it near the existing runSync tests; reuse the file's `seedSyncSettings` helper — grep it in the file to match its exact signature, it seeds the sync settings + token):

```js
describe('runSync — dropbox provider', () => {
  it('pulls then pushes via the dropbox provider when syncProvider is dropbox', async () => {
    await seedSyncSettings({ syncProvider: 'dropbox', syncToken: 'db-token' })
    dropbox.pullFromDropbox.mockResolvedValue(null)   // first sync: no remote file yet
    dropbox.pushToDropbox.mockResolvedValue('id:x')
    await runSync()
    expect(dropbox.pullFromDropbox).toHaveBeenCalledWith('db-token')
    expect(dropbox.pushToDropbox).toHaveBeenCalledWith('db-token', expect.objectContaining({ version: 1 }))
  })
})
```

> Note: `seedSyncSettings` must set `syncTokenExpiry` to a future value (or null) so `getFreshAccessToken` returns the token as-is without attempting a refresh. Match how the existing `syncProvider: 'google'` disconnect tests seed it (grep `seedSyncSettings` in the file for the exact shape).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --config config/vite.config.js src/sync/syncManager.test.js -t "dropbox provider"`
Expected: FAIL — `runSync` throws or does nothing for the unknown `dropbox` provider (no branch), so `pullFromDropbox` is never called.

- [ ] **Step 4: Implement the syncManager branch**

In `src/sync/syncManager.js`, add the import beside the google/onedrive imports (line 10-11):

```js
import { pushToDropbox, pullFromDropbox } from './providers/dropbox'
```

Add a branch after the `onedrive` branch in `runSync` (after line ~319, mirroring the onedrive branch — grep the onedrive branch to copy its exact `syncStep`/merge/export shape):

```js
  } else if (s.syncProvider === 'dropbox') {
    const remote = await syncStep('download', () => pullFromDropbox(token))
    if (remote) await mergeSnapshot(remote)
    if (wasEmpty && remote?.settings) applyPortableSettings(remote.settings)
    const snapshot = await exportSnapshot()
    await syncStep('upload', () => pushToDropbox(token, snapshot))
```

> Match the exact statements of the onedrive branch (the download→merge→seed→export→upload sequence and variable names like `remote`, `wasEmpty`, `snapshot`). If the onedrive branch differs in detail, copy it verbatim and swap the provider functions — do not invent a new shape.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --config config/vite.config.js src/sync/syncManager.test.js`
Expected: PASS (the dropbox test + all existing syncManager tests).

- [ ] **Step 6: Commit**

```bash
git add src/sync/config.js src/sync/syncManager.js src/sync/syncManager.test.js
git commit -m "feat(sync): wire Dropbox into config + syncManager runSync (#295)"
```

---

## Task 4: UI wiring — DataSyncPanel button + App.jsx callback

**Files:**
- Modify: `src/views/settings/DataSyncPanel.jsx`
- Modify: `src/views/settings/DataSyncPanel.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `buildDropboxOAuthUrl` (Task 1), `fetchDropboxUser` (Task 1), `SYNC_CONFIG.dropbox` (Task 3).

- [ ] **Step 1: Write the failing panel test**

In `src/views/settings/DataSyncPanel.test.jsx`: extend the `SYNC_CONFIG` mock (near line 25) to include dropbox, and add the provider mock (near line 34):

```js
// inside the SYNC_CONFIG mock object, after onedrive:
    dropbox:  { clientId: '' },
```
```js
vi.mock('../../sync/providers/dropbox', () => ({ buildDropboxOAuthUrl: () => '' }))
```

Add a test that, when `SYNC_CONFIG.dropbox.clientId` is set, the Dropbox connect option renders. Because the mock is module-level, add a dedicated test that renders with a configured dropbox by overriding the mock return per-test is awkward; instead assert the button renders when configured by using a separate describe that re-mocks. Simplest robust assertion given the existing mock style: assert the Dropbox label appears in the connect list when its clientId is non-empty. Implement it by setting the mock's dropbox clientId to a value for this test file's connect-list test. Concretely, change the shared `SYNC_CONFIG` mock's `dropbox` to `{ clientId: 'db-key' }` and add:

```js
it('offers Dropbox as a connect option when configured', () => {
  mockSettings = {}              // not connected → the connect list shows
  render(<DataSyncPanel />)
  expect(screen.getByText('Dropbox')).toBeInTheDocument()
})
```

> If the existing panel tests rely on ALL providers being unconfigured (clientId `''`) to assert the "no providers configured" empty state, keep github/google/onedrive as `''` and set ONLY `dropbox: { clientId: 'db-key' }`, then update that empty-state test if present so it no longer expects an empty list (it now has Dropbox). Grep the test file for the empty-state assertion (`no.*provider|not configured`) and adjust it to reflect that Dropbox is configured, OR give dropbox `clientId: ''` in the shared mock and instead write the button test in its own `describe` with a local `vi.doMock`. Choose whichever keeps all existing panel tests green — verify by running the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --config config/vite.config.js src/views/settings/DataSyncPanel.test.jsx -t "Dropbox"`
Expected: FAIL — no Dropbox option rendered (button not added yet).

- [ ] **Step 3: Implement DataSyncPanel.jsx**

Add the import (beside line 8):

```js
import { buildDropboxOAuthUrl } from '../../sync/providers/dropbox'
```

Extend `PROVIDER_LABEL` (line 16):

```js
const PROVIDER_LABEL = { github: 'GitHub Gist', google: 'Google Drive', onedrive: 'OneDrive', dropbox: 'Dropbox' }
```

Add the connect button after the OneDrive one (after line ~275), mirroring the OneDrive block exactly:

```jsx
              {SYNC_CONFIG.dropbox.clientId && (
                <button
                  onClick={() => { window.location.href = buildDropboxOAuthUrl(SYNC_CONFIG.dropbox.clientId, SYNC_CONFIG.dropbox.callbackBase, createOAuthState()) }}
                  className="..."   /* copy the exact className from the OneDrive button */
                >
                  <div>
                    <p className="text-sm text-appText font-medium">Dropbox</p>
                    <p className="text-xs text-appTextMuted">Stored in your Dropbox app folder</p>
                  </div>
                </button>
              )}
```

> Copy the OneDrive `<button>`'s exact `className` and inner markup structure (icon element, layout) — only the label, sublabel, and the `SYNC_CONFIG.dropbox` references change.

Update the empty-state guard (line 276) to include dropbox:

```jsx
              {!SYNC_CONFIG.github.clientId && !SYNC_CONFIG.google.clientId && !SYNC_CONFIG.onedrive.clientId && !SYNC_CONFIG.dropbox.clientId && (
```

- [ ] **Step 4: Implement App.jsx**

Add the import (beside line 27-29):

```js
import { fetchDropboxUser } from './sync/providers/dropbox'
```

Add to `PROVIDER_CONNECT` (after the onedrive entry, ~line 86), mirroring the onedrive entry's fields exactly:

```js
  dropbox: {
    label: 'Dropbox',
    prefix: '',
    storage: 'an app folder in your Dropbox',
    note: 'PunchIn only ever accesses its own app folder — never the rest of your Dropbox. You can revoke access anytime in your Dropbox account settings.',
  },
```

> Match the exact keys the onedrive entry uses (grep `PROVIDER_CONNECT` — it has `label`, and per the code near line 76-86 also a handle/prefix + `storage` + `note`; copy that entry's shape precisely).

Extend the callback dispatch (line ~391) so dropbox is handled with google/onedrive:

```js
      } else if (provider === 'google' || provider === 'onedrive' || provider === 'dropbox') {
        // ...existing body unchanged...
        const fetchUser = provider === 'google' ? fetchGoogleUser
                        : provider === 'onedrive' ? fetchOneDriveUser
                        : fetchDropboxUser
```

> The existing line is `const fetchUser = provider === 'google' ? fetchGoogleUser : fetchOneDriveUser`. Replace it with the three-way form above. Leave the rest of that branch (refresh/expiresIn handling) unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --config config/vite.config.js src/views/settings/DataSyncPanel.test.jsx src/App.test.jsx`
Expected: PASS. (If `src/App.test.jsx` doesn't exist or doesn't cover the callback, at least the panel file must be green; the App.jsx change is exercised by the full suite + the live round-trip.)

- [ ] **Step 6: Commit**

```bash
git add src/views/settings/DataSyncPanel.jsx src/views/settings/DataSyncPanel.test.jsx src/App.jsx
git commit -m "feat(sync): Dropbox connect button + account-confirm wiring (#295)"
```

---

## Task 5: Docs, version bump, and the full gate

**Files:**
- Modify: `package.json`, `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/TEST-COVERAGE.md`, `SECURITY.md`, `README.md`, `CLAUDE.md`, `.env.example`, `wrangler.jsonc`

- [ ] **Step 1: Version bump to 0.34.0**

- `package.json`: `"version": "0.34.0"`.
- `CLAUDE.md`: `**Version:** 0.34.0`.
- `README.md`: version badge `version-0.34.0` (both the `img src` URL and the `alt` text).
- `SECURITY.md`: in the Supported Versions table, set the row to `0.34.x  Yes` and mark `< 0.34  No` (mirror the existing pattern — grep the current table).

- [ ] **Step 2: CHANGELOG entry**

In `docs/CHANGELOG.md`, add at the top (above the latest section):

```markdown
## [0.34.0] — 2026-07-22

### Added
- **Sync to Dropbox.** Dropbox joins GitHub, Google Drive, and OneDrive as a cloud-sync option — connect it in Settings → Data & sync and your jobs, entries, and labor types sync across devices through a private app folder in your Dropbox (PunchIn only ever sees its own folder). Sign-in uses the same secure flow as the other providers, with silent background token refresh.

---
```

- [ ] **Step 3: Architecture + test-coverage + env + wrangler docs**

- `docs/ARCHITECTURE.md`: in the `src/sync/providers/` area of the file map, add a line for `dropbox.js` mirroring the `onedrive.js` entry (single app-folder file, Auth Code via the worker).
- `docs/TEST-COVERAGE.md`: add a row for `src/sync/providers/dropbox.test.js`.
- `.env.example`: add `VITE_DROPBOX_APP_KEY=` beside the other `VITE_*` client-id vars (with a short comment mirroring the others).
- `wrangler.jsonc`: in the keep-vars comment that lists the OAuth secrets, add `DROPBOX_APP_SECRET`.
- `CLAUDE.md`: if the Overview line enumerates providers or the sync section lists `connect-src` origins, add Dropbox / the two Dropbox origins there.

- [ ] **Step 4: Run the docs-sync check**

Run: `npm run check:docs`
Expected: `✓ docs-sync: all documentation in sync.`
If it flags a missing entry, fix that file and re-run.

- [ ] **Step 5: Full gate**

Run: `npm run build`
Expected: BUILD OK.

Run: `npm run test:run`
Expected: only the 5 pre-existing `deviceId.test.js` failures; everything else (incl. all new Dropbox tests) green.

- [ ] **Step 6: Commit**

```bash
git add package.json docs/ SECURITY.md README.md CLAUDE.md .env.example wrangler.jsonc
git commit -m "docs(sync): Dropbox provider docs + v0.34.0 (#295)"
```

---

## Self-review notes (author)

- **Spec coverage:** provider module (T1), Worker+CSP (T2), config+syncManager (T3), UI+callback (T4), docs+version (T5) — every spec section maps to a task.
- **TOKEN_EXPIRED invariant:** enforced in T1 (`httpError`) and tested in both push and pull.
- **Missing-file wrinkle:** the 409/`path/not_found` → null behavior is pinned by T1 tests.
- **Inert-until-configured:** the connect button is gated on `SYNC_CONFIG.dropbox.clientId`, so the feature stays hidden until `VITE_DROPBOX_APP_KEY` is set (matches the other providers).
- **Type consistency:** `buildDropboxOAuthUrl`, `fetchDropboxUser`, `pushToDropbox`, `pullFromDropbox` names are identical across T1 (definition), T3 (syncManager import), and T4 (App.jsx/panel import).
- **Operational prerequisites** (Dropbox App Console app, `DROPBOX_APP_SECRET` secret, `VITE_DROPBOX_APP_KEY` build var, Production-status application) are the user's — the code lands inert behind config and goes live after a real Dropbox sign-in round-trip.
