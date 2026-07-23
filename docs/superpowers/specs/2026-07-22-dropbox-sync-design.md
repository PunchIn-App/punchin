# Dropbox cloud sync — design spec

**Date:** 2026-07-22
**Status:** Approved (design); pending spec review
**Sub-project 1 of 3** in the "more sync options" effort (issue #295). Order: **Dropbox → WebDAV → iCloud/CloudKit**, each its own spec → plan → implementation cycle. This spec covers Dropbox only.

## Goal

Add **Dropbox** as a fourth opt-in cloud-sync provider, alongside GitHub, Google Drive, and OneDrive, so a user who doesn't use those three can still sync PunchIn data across devices. Dropbox is the lowest-risk addition: it fits the existing confidential-client Authorization-Code-via-Worker pattern almost exactly, so this is a *clone* of the Google/OneDrive provider with different hostnames/params — no architectural change.

## Non-goals

- WebDAV and iCloud/CloudKit (separate sub-projects, separate specs).
- Changing the sync/merge engine (`mergeSnapshot`), the encrypted token store, or the OAuth broker's structure. Dropbox reuses all of them.
- Per-device file storage (see Decisions → single-file).
- The Dropbox App Console setup and Production-status approval — those are the user's manual steps (see "Operational prerequisites").

## Background: the existing provider pattern

Cloud sync has no formal provider interface — a "provider" is a set of named exports in `src/sync/providers/<name>.js`, dispatched by hardcoded `if/else` on `settings.syncProvider` in `syncManager.js`, `App.jsx`, and `DataSyncPanel.jsx`. Two shapes exist: GitHub's multi-file-per-device gist shape, and the **single-shared-file** shape used by `google.js` and `onedrive.js`. Dropbox follows the **single-file shape** (the template).

Auth: a full-page redirect to the provider's authorize endpoint → the Cloudflare Worker (`worker/oauth.js`) exchanges the `code` for tokens (holding the client secret) → hands the app back `#sync_token` + `#sync_refresh` + `#sync_expires` via the URL fragment. The Worker also does silent refresh (`handleRefresh`) and, where supported, revoke (`handleRevoke`). Access + refresh tokens are stored AES-GCM-encrypted in the Dexie `secrets` table via `tokenStore.js`; `getFreshAccessToken()` is the single chokepoint that refreshes near expiry and raises `TOKEN_EXPIRED` when it can't.

## Design

### 1. Client provider — `src/sync/providers/dropbox.js` (new file)

Mirrors `google.js`/`onedrive.js`. Four required exports plus the shared `httpError` helper:

- **`buildDropboxOAuthUrl(clientId, callbackBase, state)` → string**
  `https://www.dropbox.com/oauth2/authorize` with:
  - `client_id=<clientId>`, `response_type=code`
  - `token_access_type=offline` — **required**, or Dropbox returns no refresh token
  - `scope=files.content.write files.content.read files.metadata.read` (space-separated)
  - `redirect_uri=${callbackBase}/oauth/dropbox/callback`
  - `&state=<state>` appended verbatim when present (CSRF nonce, issue #125)
  - Optional UX: `prompt=select_account`-equivalent is not a Dropbox param; omit.

- **`fetchDropboxUser(token)` → Promise<string|null>**
  `POST https://api.dropboxapi.com/2/users/get_current_account` (Bearer token, no body — Dropbox requires `Content-Type` absent or `null` body for this RPC). Return `data.email` (fallback `data.name?.display_name`). Return `null` on any error — never throw (so a failed lookup doesn't block the "Connect as <you>?" dialog).

- **`pushToDropbox(token, data)` → Promise<void>** (create-or-overwrite the single file)
  `POST https://content.dropboxapi.com/2/files/upload`, headers:
  - `Authorization: Bearer <token>`
  - `Dropbox-API-Arg: {"path":"/punchin-data.json","mode":"overwrite","mute":true}`
  - `Content-Type: application/octet-stream`
  - body = `JSON.stringify(data)`
  Throw `httpError('Dropbox upload', res.status)` on non-2xx.

- **`pullFromDropbox(token)` → Promise<snapshot|null>**
  `POST https://content.dropboxapi.com/2/files/download`, headers `Authorization: Bearer <token>` + `Dropbox-API-Arg: {"path":"/punchin-data.json"}`.
  - **404 / `path/not_found`** (the file doesn't exist yet — first sync) → return `null`. Dropbox returns HTTP 409 with an error summary containing `path/not_found` for a missing file, *not* 404 — so detect missing-file by status 409 **and** an error body/`Dropbox-API-Result` mentioning `not_found`. (This is the one Dropbox-specific wrinkle vs. OneDrive's clean 404; the tests pin it.)
  - 200 → `JSON.parse(await res.text())`.
  - Any other non-2xx → throw `httpError('Dropbox download', res.status)`.

- **`httpError(label, status)`** — copied verbatim from google.js/onedrive.js: `new Error(status === 401 ? 'TOKEN_EXPIRED' : \`${label} ${status}\`)`. The literal `'TOKEN_EXPIRED'` on 401 is load-bearing — the refresh/reconnect machinery keys on it.

The snapshot object is produced by `exportSnapshot()` (`{version:1, exportedAt, jobs, entries, laborTypes, deletions, settings}`) and consumed by `mergeSnapshot()` — unchanged.

### 2. Worker — `worker/oauth.js` (3 additions, all reusing existing handlers)

- Add to `OAUTH_PROVIDERS`:
  ```js
  dropbox: {
    tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
    idVar: 'DROPBOX_APP_KEY',
    secretVar: 'DROPBOX_APP_SECRET',
    scope: null,
  },
  ```
  `handleProviderCallback` (code→token) and `handleRefresh` (refresh→token) then work verbatim: both POST form-encoded `client_id`/`client_secret`/`grant_type`/`code`(or `refresh_token`)/`redirect_uri` to `tokenEndpoint`, and Dropbox accepts `client_id`/`client_secret` as form fields. `redirect_uri` resolves to `${APP_URL}/oauth/dropbox/callback` (byte-identical to the authorize `redirect_uri`).
- Route `/oauth/dropbox/callback` → `handleProviderCallback(url, env, 'dropbox')` (same dispatch as google/onedrive).
- **CSP:** add `https://api.dropboxapi.com https://content.dropboxapi.com` to the `connect-src` list. (`www.dropbox.com` is a top-level navigation, not a fetch — no entry needed.)
- **Revoke:** Dropbox supports `POST https://api.dropboxapi.com/2/auth/token/revoke` (Bearer, no body). Optional. For v1, mirror OneDrive (no client-side revoke) to keep the change minimal; `disconnectSync()` still clears local tokens. (Revoke can be a fast follow.)

### 3. Wiring

- **`src/sync/config.js`** — add:
  ```js
  dropbox: {
    clientId: import.meta.env.VITE_DROPBOX_APP_KEY || '',
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
  ```
- **`src/sync/syncManager.js`** — extend the `google`/`onedrive` single-file branch in `runSync()` (and any provider-name switch in connect/disconnect) to include `dropbox`, calling `pullFromDropbox`/`pushToDropbox`. No new merge logic.
- **`App.jsx`** — the OAuth callback handler is path-driven (`/oauth/dropbox/callback` → provider `dropbox`) and already generic; add `dropbox` wherever the provider list/labels are enumerated for the callback + `fetchDropboxUser` in the account-confirm path.
- **`DataSyncPanel.jsx`** (the Settings sync UI) — add a **Dropbox** connect button/row alongside the others, using the same connect flow (`buildDropboxOAuthUrl` + state nonce) and the same "Connect as <you>?" confirm dialog.

### Decisions

1. **Single shared `/punchin-data.json` (not per-device files).** Matches the Google/OneDrive template exactly, reuses the proven last-write-wins `mergeSnapshot`, minimal surface. Dropbox App-folder is CORS-open so per-device *is* possible, but the single-file model is already in production for Google/OneDrive and the merge is idempotent + LWW, so the tiny simultaneous-write window is acceptable.
2. **App Folder access** (sandboxed to `/Apps/<AppName>/`), not Full Dropbox — least privilege. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`.
3. **Direct browser → Dropbox data plane** (not Worker-proxied). Dropbox's API returns `Access-Control-Allow-Origin: *`; the PWA calls upload/download directly with the Worker-minted access token, exactly like Google/OneDrive. Only the OAuth token exchange/refresh goes through the Worker.
4. **Tolerate the CORS preflight** on data calls (the `Dropbox-API-Arg` header makes each call non-simple → one OPTIONS per request). Do **not** adopt the `reject_cors_preflight`/`dropbox-cors-hack` recipe — it has browser-rewrite edge cases and the latency on tiny snapshots is negligible.
5. **`VITE_DROPBOX_APP_KEY`** (App key = OAuth client_id) is public → build var (Workers Builds build var, like the other `VITE_*` client IDs). **`DROPBOX_APP_SECRET`** (App secret) is a Worker secret only, never in the bundle.

### Error handling

- 401 on any data call → `httpError` raises `TOKEN_EXPIRED` → existing `getFreshAccessToken` refresh path silently refreshes and retries; if the refresh token is dead, the app surfaces "reconnect needed" (existing behavior).
- Missing file on first pull → `null` → treated as "nothing to merge yet, seed from local" (existing `runSync` behavior).
- Blocked/failed OAuth → Worker redirects `#sync_error=...` (existing).
- A wrong/truncated `DROPBOX_APP_SECRET` fails **safe**: the token exchange returns no `access_token` → `#sync_error` → user re-pastes the secret (no redeploy). The only proof the secret is whole is a **live Dropbox sign-in round-trip** (same gate as Google/OneDrive; the secret can't be read back).

### Testing (TDD)

- `src/sync/providers/dropbox.test.js` (new):
  - `buildDropboxOAuthUrl` includes `response_type=code`, `token_access_type=offline`, the three scopes, `redirect_uri=.../oauth/dropbox/callback`, and appends `state`.
  - `fetchDropboxUser` returns the email; returns `null` on a non-2xx / thrown fetch.
  - `pushToDropbox` posts to the content host with the `Dropbox-API-Arg` overwrite header and the serialized snapshot body; throws `httpError` on non-2xx.
  - `pullFromDropbox` returns the parsed snapshot on 200; returns `null` on the missing-file (409/`path/not_found`) response; throws on other non-2xx.
  - `httpError` maps **401 → `TOKEN_EXPIRED`**, other statuses → `\`${label} ${status}\``.
- `worker/oauth.test.js` (extend): `OAUTH_PROVIDERS.dropbox` has the right endpoint/idVar/secretVar; `/oauth/dropbox/callback` dispatches to `handleProviderCallback`; the CSP `connect-src` includes both Dropbox origins.
- `DataSyncPanel.test.jsx` (extend): a Dropbox connect control renders and initiates the flow (build URL called with the config clientId + a state nonce).
- Gate: `npm run build` and `npm run test:run` both green.

### Documentation & version (Docs-Sync CI)

- **MINOR** bump → `0.34.0` (new user-visible feature): `package.json`, `docs/CHANGELOG.md` (new `[0.34.0]` section), `README.md` badge, `CLAUDE.md` `**Version:**`, `SECURITY.md` supported-versions (minor bump).
- `docs/ARCHITECTURE.md` — add `src/sync/providers/dropbox.js` to the file map (R1).
- `docs/TEST-COVERAGE.md` — add the new test file row (R2).
- `.env.example` — add `VITE_DROPBOX_APP_KEY`.
- `wrangler.jsonc` keep-vars comment — note `DROPBOX_APP_SECRET`.
- Update the Overview line in `CLAUDE.md` if it enumerates providers; update the sync section if it lists connect-src origins.

### Operational prerequisites (user's manual steps — I cannot do these)

1. Dropbox App Console: create a **Scoped-access, App-folder** app; enable `files.content.write` / `files.content.read` / `files.metadata.read`; register redirect URI `https://<worker-host>/oauth/dropbox/callback`.
2. Set the **`DROPBOX_APP_SECRET`** Cloudflare Worker secret and the **`VITE_DROPBOX_APP_KEY`** Workers Builds build var.
3. Start the **Dropbox Production-status application early** — dev apps cap linked accounts; approval is review-gated and is the only non-code long pole. All code ships behind this config; the feature goes live once the key/secret are set and a live sign-in round-trip confirms the secret is whole.

## Rollout

Code + tests land behind the config (inert until `VITE_DROPBOX_APP_KEY` is set — the connect button can be shown-but-disabled or hidden when the client id is empty, matching how the other providers degrade). Merge → deploy → user sets key/secret → live sign-in round-trip verifies → Dropbox appears as a connect option.

## Cross-cutting invariant

Whatever the provider, the client module **must** raise the literal string `'TOKEN_EXPIRED'` on an expired-credential (401) response — the entire reconnect/refresh machinery keys on it.
