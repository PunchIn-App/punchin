# WebDAV cloud sync — design spec

> ## ❌ NOT BUILT — considered and rejected (2026-07-24)
>
> This design was completed and reviewed, then **deliberately dropped before implementation**. It is kept
> as a record of the research and of *why* WebDAV isn't a good fit, so the question doesn't get re-opened
> from scratch. **Do not implement this without revisiting the reasoning below.**
>
> **Why it was rejected:**
> 1. **It can't serve the people who want it.** WebDAV's appeal is self-hosting (a NAS at home), but a
>    Cloudflare Worker's `fetch()` reaches only the **public internet with valid TLS** — so LAN-only
>    (`192.168.x`), plaintext-`http`, and self-signed servers are all unreachable. The feature would turn
>    away most of its own target audience and generate unreproducible "my Synology doesn't work" reports.
> 2. **It's the only provider requiring a permanent relay** (`/dav`) on our infrastructure. Every other
>    provider is a browser→cloud-API call. This one alone adds a forwarding endpoint that must stay
>    locked down for the life of the app — ongoing surface area and maintenance for a niche feature.
> 3. **It's the only provider holding a non-expiring credential.** OAuth access tokens expire in ~1 h; a
>    WebDAV app-password lives until manually revoked, so an XSS exfiltrates durable access. A worse
>    class of secret to be responsible for.
> 4. **Nobody actually asked for it.** Issue #295 listed "iCloud/Apple, Dropbox, maybe proton drive,
>    nordlocker, or even a custom nas path" as a brainstorm; the reporter was asked to prioritize and
>    never replied. **Dropbox (shipped, PR #318) is the most probable real need.**
>
> **What replaced it:** the effort went straight to **iCloud/CloudKit** — no relay, no stored passwords
> (Apple hosts the sign-in), and a large natural audience for a time-tracking app.
>
> The technical research below (esp. the Cloudflare Workers SSRF/egress findings) remains accurate and
> reusable if a proxy-style provider is ever revisited.

**Date:** 2026-07-24
**Status:** ❌ Rejected — not implemented (see banner above)
**Was:** Sub-project 2 of 3 in the "more sync options" effort (issue #295). Revised order: Dropbox → iCloud/CloudKit.

## Goal

Add **WebDAV** (Nextcloud, Synology, generic RFC 4918 servers) as a fifth opt-in cloud-sync provider, so a user can sync to **their own server** with no third-party cloud account. Unlike the OAuth providers, WebDAV uses a **server URL + username + app-password** entered in a form, brokered through a new **same-origin Worker proxy** (`/dav`) — the only viable transport for a locked-down-CSP PWA.

## Non-goals

- iCloud/CloudKit (separate sub-project).
- Direct browser → WebDAV (impossible here: servers' CORS is off by default **and** the app's fixed `connect-src` CSP can't allowlist an arbitrary user origin). Proxy-only.
- LAN-only / self-signed / plaintext-`http` servers — a Cloudflare Worker's `fetch()` is **public-internet-only** and can't reach RFC1918/loopback, and we require valid TLS. Public **HTTPS** WebDAV servers only. (This is a hard platform constraint, documented, not a bug.)
- Server-side storage of user credentials (a KV-token design is noted as a future hardening, not built in v1 — the Worker stays **stateless** and stores nothing).

## Background: how this differs from the OAuth providers

There is no OAuth, no authorization server, no client secret, no refresh token. The user supplies `{serverUrl, username, appPassword}`; every request carries `Authorization: Basic base64(user:pass)`. The Worker's role collapses from token-minter to a **dumb, SSRF-guarded pass-through proxy**. The sync/merge engine is unchanged. Storage uses the **multi-file-per-device** model (like the GitHub Gist provider), not the single-file model — each device writes only its own file, so there are no write races.

## Design

### 1. Worker proxy — `POST /dav` (new route in `worker/oauth.js`)

The browser calls the **same-origin** `/dav` route (so `connect-src 'self'` already allows it — **zero CSP change**); the Worker forwards to the user's WebDAV server. Header-based envelope, streamed body:

Request headers from the browser:
- `X-Dav-Url` — the absolute target URL (a specific file or the collection).
- `X-Dav-Method` — one of `GET | PUT | PROPFIND | MKCOL | DELETE` (allowlist).
- `X-Dav-Auth` — `Basic base64(user:appPassword)` (never logged).
- `X-Dav-Depth` — `0`/`1` (only for PROPFIND).
- Body — the raw payload (JSON for PUT, the PROPFIND XML for PROPFIND).

Worker behavior:
```js
// pseudocode — full impl in the plan
if (request.method !== 'POST') return 405
const origin = request.headers.get('Origin')
if (origin && origin !== env.APP_URL) return 403            // same-origin deterrent
const target = new URL(davUrl)                               // throws → 400
if (target.protocol !== 'https:') return 400                 // https-only
if (isPrivateOrReservedHost(target.hostname)) return 400     // belt-and-suspenders IP-literal block
if (!ALLOWED_METHODS.has(davMethod)) return 405
const upstream = await fetch(target, {
  method: davMethod,
  headers: {
    Authorization: davAuth,                                  // forwarded, never logged
    ...(depth ? { Depth: depth } : {}),
    ...(contentType ? { 'Content-Type': contentType } : {}),
  },
  body: METHODS_WITH_BODY.has(davMethod) ? request.body : undefined,   // streamed
  redirect: 'manual',                                        // CRITICAL: a followed redirect forwards Authorization
  signal: AbortSignal.timeout(15000),
})
return new Response(upstream.body, { status: upstream.status, headers: safeHeaders(upstream.headers) })
```

**SSRF / open-relay guard checklist (all mandatory):**
1. **`https:`-only** target scheme (parse via `new URL`, check `.protocol`; reject `http/file/gopher/…`).
2. **Reject private/reserved IP-literal hosts** — `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`, `0.0.0.0`, IPv4-mapped IPv6. (The platform already can't route to these, but this fails fast and guards against future platform changes.)
3. **`redirect: 'manual'`** — a followed cross-host redirect forwards the `Authorization` header to the redirect target; never allow it. Surface the 3xx to the client instead.
4. **Method allowlist** — `GET/PUT/PROPFIND/MKCOL/DELETE` only.
5. **Size + time caps** — request/response body ≤ ~5 MB; `AbortSignal.timeout(15000)`.
6. **Origin gate** — only accept `/dav` when `Origin` is `env.APP_URL` (a deterrent; acknowledged spoofable by non-browser clients).
7. **Never log** `X-Dav-Auth`, the credential, or arguably the target URL; strip hop-by-hop headers both ways.

> **Why this is proportionate:** Cloudflare Workers `fetch()` is public-internet-only, so the "reach my LAN / metadata endpoint" SSRF vector is closed by the platform (a rebind to a private IP just fails to connect — Cloudflare's Workers VPC product exists precisely because plain Workers can't reach private endpoints). The residual risk is a **low-value open relay**: an abuser must supply an `https` public target **and** valid Basic creds for it, can use only WebDAV verbs, can't reach private networks, and is size/time-capped. The load-bearing controls above bound it. A **per-install KV token** (Worker mints a random token at connect, stores `{token → creds}` server-side, client sends only the token) is the stronger design and is noted as a **future hardening** if abuse appears — not built in v1, to keep the Worker stateless and avoid making it a credential honeypot.

### 2. Client provider — `src/sync/providers/webdav.js` (new file)

All requests go through the `/dav` proxy via a small `davFetch(cred, { method, path, depth, body })` helper that sets the `X-Dav-*` headers. `cred` is the parsed `{serverUrl, username, appPassword}` bundle. The provider mirrors the **GitHub multi-file contract**:

- **`parseCred(token)`** — the stored "token" is `JSON.stringify({serverUrl, username, appPassword})`; parse it. (Reuses the encrypted-secrets token slot; see §4.)
- **`buildBasicAuth(username, appPassword)`** → `'Basic ' + base64(user:pass)`.
- **`ensureCollection(cred)`** — `MKCOL` the `PunchIn/` collection under the base URL. **201 = created; 405/403 = already exists → treat as success; 401 → `TOKEN_EXPIRED`; else throw.** (MKCOL doesn't create parents, but the base collection is expected to exist; we only create our own `PunchIn/` child.)
- **`getDeviceFilename(deviceId)`** → `punchin-data-${deviceId}.json` (same convention as `github.js`; `deviceId` from `src/utils/deviceId.js`).
- **`listDeviceFiles(cred)`** — `PROPFIND` the `PunchIn/` collection with `Depth: 1` + the minimal prop XML → parse the 207 with `DOMParser('application/xml')`, using **namespace-aware** `getElementsByTagNameNS('DAV:', 'response'|'href'|'resourcetype'|'collection')`. **URL-decode** each `<href>`, resolve it against the base URL, **skip the collection's own self-entry**, and return the child filenames matching `punchin-data-*.json`.
- **`pullAllDeviceData(cred)`** — `GET` each peer device file → `JSON.parse` → return an array of snapshots (skip a file that 404s or fails to parse). Mirrors `fetchAllDeviceData`.
- **`pushDeviceData(cred, deviceId, snapshot)`** — `PUT` this device's file with `JSON.stringify(snapshot)`. **201/204 = ok; 401 → `TOKEN_EXPIRED`; 409 (missing parent) → `ensureCollection` then retry once; else throw.**
- **`deleteDeviceFile(cred, deviceId)`** — `DELETE` own file on disconnect (**204/404 both = ok**).
- **`httpError(label, status)`** — copied from the other providers: `new Error(status === 401 ? 'TOKEN_EXPIRED' : \`${label} ${status}\`)`. A WebDAV 401 = bad/revoked app-password → surfaces as "reconnect" (re-enter creds), the same UX path as an expired OAuth token (there's no refresh, so `getFreshAccessToken` — see §4 — never tries one).

### 3. Connect UX — a form, not an OAuth button (`DataSyncPanel.jsx`)

WebDAV has no OAuth redirect/callback, so it does **not** touch `App.jsx`'s callback dispatch or `PROVIDER_CONNECT`. Instead, `DataSyncPanel` renders a **WebDAV form** (Server URL, Username, App password) in the connect list, gated on a build flag `SYNC_CONFIG.webdav.enabled` (so it can be hidden per-deployment like the others). On submit it calls a new `connectWebDav({serverUrl, username, appPassword})` (see §4), which **validates** (a live `ensureCollection` round-trip through the proxy) before persisting — a typo'd host fails loudly instead of silently syncing nowhere (there's no "Connect as \<you\>?" identity dialog since Basic auth carries no identity; the form echoes back the server + username on success). Add `webdav: 'WebDAV'` to `PROVIDER_LABEL`.

### 4. Credential storage + connect/disconnect (`syncManager.js`, `tokenStore.js` reuse)

- The credential bundle is stored via the **existing encrypted `secrets` table** (`setSyncToken(JSON.stringify(cred))`), `syncProvider = 'webdav'`, `syncTokenExpiry = null` (never expires → `getFreshAccessToken` returns it verbatim, no refresh attempt), `syncUsername = \`${username} @ ${host}\`` for display. **No new Cloudflare secret, no build var** — a first among providers.
- **`connectWebDav(cred)`** (new, in `syncManager.js`): `ensureCollection(cred)` to validate; on success persist the settings + token exactly as `confirmConnect` does for OAuth (minus refresh); on failure throw a clear error the form shows.
- **`runSync` webdav branch**: `const cred = parseCred(token); await ensureCollection(cred); const snaps = await pullAllDeviceData(cred); for (const s of snaps) await mergeSnapshot(s); if (wasEmpty && …) applyPortableSettings; const snapshot = await exportSnapshot(); await pushDeviceData(cred, deviceId, snapshot)`. Mirrors the **github** multi-file branch (loop-merge many, push own), not the single-file branch.
- **`disconnectSync` webdav branch**: best-effort `deleteDeviceFile(cred, deviceId)` before clearing local token (so the device's file is removed from the server), then the standard `clearSyncToken` + null-out. No `revokeViaWorker` (nothing to revoke).

### 5. CSP / secrets / build

- **No CSP change** — `/dav` is same-origin (`connect-src 'self'`). The Worker→WebDAV hop is server-side, not subject to CSP or CORS.
- **No new Cloudflare *secret*** — the Worker holds nothing. A single opt-in **build flag** gates the UI: `SYNC_CONFIG.webdav = { enabled: import.meta.env.VITE_WEBDAV_ENABLED === 'true' }`. This is a var (not a secret), consistent with "the provider appears when the deployment enables it," and keeps the "no providers configured" empty state coherent (it now also checks `!SYNC_CONFIG.webdav.enabled`). The user's deployment sets `VITE_WEBDAV_ENABLED=true` (one build var on both Workers Builds triggers) to turn it on — no secret, no OAuth app.

### Error handling

- **401** (bad/revoked app-password) → `TOKEN_EXPIRED` → surfaces as the "reconnect" state; the WebDAV reconnect action re-opens the form (not an OAuth redirect).
- **405/403 on MKCOL** → collection exists → success.
- **409 on PUT** → missing parent collection → `ensureCollection` + retry once.
- **404 on GET/DELETE** → treated as "no file" (first sync / already gone).
- **Proxy 400** (bad scheme / private host) or **403** (origin) or **timeout** → surfaced as a clear connect/sync error.
- Malformed PROPFIND XML (`<parsererror>`) → throw a clear "couldn't read the server listing" error.

### Testing (TDD)

- `worker/oauth.test.js` (extend): `/dav` proxy — forwards method/url/auth/body to `fetch` with `redirect: 'manual'`; rejects non-`https` target (400); rejects a private-IP-literal host (400); rejects a disallowed method (405); rejects a cross-origin `Origin` (403); streams the upstream status/body back. (Stub global `fetch`.)
- `src/sync/providers/webdav.test.js` (new): `ensureCollection` (201 ok, 405 ok, 401 → TOKEN_EXPIRED); `getDeviceFilename`; `listDeviceFiles` (parses a Nextcloud-style 207 **and** an uppercase-`D:`-prefixed 207 via `getElementsByTagNameNS`; URL-decodes hrefs; skips the self-entry); `pullAllDeviceData` (multi-file, skips a 404/malformed peer); `pushDeviceData` (201/204 ok, 409 → ensureCollection+retry, 401 → TOKEN_EXPIRED); `deleteDeviceFile` (204/404 ok); `buildBasicAuth`. Stub `davFetch`/`fetch`.
- `src/sync/syncManager.test.js` (extend): `connectWebDav` persists provider/token/username after a successful `ensureCollection`; `runSync` webdav branch loops `pullAllDeviceData` → merges → `pushDeviceData`; `disconnectSync` deletes the device file then clears.
- `src/views/settings/DataSyncPanel.test.jsx` (extend): the WebDAV form renders in the connect list; submitting calls `connectWebDav` with the entered fields; a validation failure shows an error.
- The four `SettingsView.*.test.jsx` mocks get a `webdav` entry (as Dropbox needed) if they render the connect list.
- Gate: `npm run build` + `npm run test:run` green.

### Documentation & version (Docs-Sync CI)

- **MINOR** → `0.35.0` (stacked on Dropbox's 0.34.0): `package.json`, `docs/CHANGELOG.md` `[0.35.0]`, `README.md` badge, `CLAUDE.md` `**Version:**`, `SECURITY.md` supported-versions.
- `docs/ARCHITECTURE.md` — add `src/sync/providers/webdav.js` **and** note the `/dav` proxy route in the `worker/oauth.js` description.
- `docs/TEST-COVERAGE.md` — add `webdav.test.js`.
- `CLAUDE.md` — add WebDAV to the provider list in "What NOT to Do"; note the `/dav` proxy + its SSRF guard in the PWA/Deployment notes; document that WebDAV is public-HTTPS-only.
- No `.env.example` / `wrangler.jsonc` secret changes (none needed).

### Honest limitations (documented for users)

- **Public HTTPS servers only.** A Cloudflare Worker can't reach a LAN-only, `http`-only, or self-signed NAS. Homelab users on `http://192.168.x` or a self-signed cert are **not supported** — this is a hard platform constraint.
- **Long-lived credential.** A WebDAV app-password doesn't expire, so a live same-origin XSS exfiltrates durable access (worse blast radius than a ~1 h OAuth token). Mitigated by: mandating a **scoped app-password / dedicated limited user** (the form copy insists on it), AES-GCM-at-rest encryption, and the app's strict CSP as the primary XSS control.
- **Credentials transit the Worker.** On each sync the credential passes through the Cloudflare edge (over HTTPS) to be attached as Basic auth; the Worker stores/logs nothing. (The KV-token design would remove per-request transit — noted as future hardening.)
- **Residual open-relay surface** on `/dav`, bounded to WebDAV-verbs-only, https-public-targets, credential-required, size/time-capped (see §1).

## Cross-cutting invariant

The client module MUST raise the literal string `'TOKEN_EXPIRED'` on a 401 — the reconnect machinery keys on it (here it means "the app-password is wrong/revoked; re-enter it").
