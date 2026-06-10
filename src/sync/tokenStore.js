import { db } from '../db'

// At-rest encryption for the cloud-sync OAuth token (issue #126).
//
// The token is encrypted with an AES-GCM key that is generated with
// `extractable: false` and stored as a CryptoKey in IndexedDB — so the raw key
// bytes are never exposed to JS and the token is never written to IndexedDB in
// plaintext. This raises the bar against *at-rest* inspection (DevTools, IDB
// exports, disk forensics). It does **not** stop an active same-origin XSS from
// calling decrypt() — that limit is inherent to a no-backend PWA, which is why
// the worker's CSP (issue #129) is the primary XSS control. Defense in depth.

const KEY_NAME = 'syncKey'
const TOKEN_NAME = 'syncToken'
// The OAuth refresh token (Google/OneDrive, issue #243). Longer-lived and more
// sensitive than the access token, so it gets the same at-rest encryption.
const REFRESH_NAME = 'syncRefreshToken'

async function getOrCreateKey() {
  const existing = await db.secrets.get(KEY_NAME)
  if (existing?.key) return existing.key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await db.secrets.put({ name: KEY_NAME, key })
  return key
}

// Encrypt `value` under the at-rest key and store it as a named secret.
async function encryptTo(name, value) {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  )
  await db.secrets.put({ name, iv, ct })
}

// Decrypt a named secret, or null if absent / undecryptable (key mismatch →
// treat as not present rather than throwing).
async function decryptFrom(name) {
  const rec = await db.secrets.get(name)
  if (!rec?.ct) return null
  const key = await getOrCreateKey()
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(rec.iv) }, key, rec.ct)
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

/** Encrypt and persist the sync token (replaces any prior value). */
export async function setSyncToken(token) {
  if (!token) return clearSyncToken()
  await encryptTo(TOKEN_NAME, token)
}

/** Encrypt and persist the OAuth refresh token (issue #243). */
export async function setRefreshToken(token) {
  if (token) await encryptTo(REFRESH_NAME, token)
}

/** Return the decrypted refresh token, or null if none is stored. */
export async function getRefreshToken() {
  return decryptFrom(REFRESH_NAME)
}

/**
 * Return the decrypted sync token, or null if not connected. Lazily migrates a
 * pre-existing plaintext `settings.syncToken` (from before this change) into the
 * encrypted store so already-connected users don't have to re-authenticate.
 */
export async function getSyncToken() {
  const rec = await db.secrets.get(TOKEN_NAME)
  // An encrypted record present but undecryptable (key mismatch) is treated as
  // disconnected — NOT a fall-through to the legacy plaintext path.
  if (rec?.ct) return decryptFrom(TOKEN_NAME)
  // Legacy plaintext fallback + one-time migration.
  const legacy = await db.settings.get('syncToken')
  if (legacy?.value) {
    await setSyncToken(legacy.value)
    await db.settings.delete('syncToken')
    return legacy.value
  }
  return null
}

// Refresh an access token this close to expiry, so a sync can't start and then
// have the token die mid-flight, leaving remote state half-updated.
const EXPIRY_MARGIN_MS = 30_000

// In-flight refresh, shared so concurrent syncs (a manual "Sync Now" racing a
// periodic auto-sync tick) collapse to ONE refresh. Critical for Microsoft,
// which rotates and invalidates the refresh token on first use: two refreshes
// reading the same stored token would have the second re-spend a now-dead token
// and trip a spurious TOKEN_EXPIRED. The token is read INSIDE the lock so a
// later caller always reads the freshest stored value.
let refreshInFlight = null

/**
 * The single access-token chokepoint for syncing: returns a usable access token,
 * silently refreshing it via the worker when it's expired and a refresh token is
 * stored (Google/OneDrive, issue #243). Returns null only when there's no token
 * at all (not connected). Throws `TOKEN_EXPIRED` when the access token is expired
 * and can't be refreshed — no refresh token (GitHub, or a pre-#243 connection) or
 * the refresh token itself is dead — so the UI prompts a reconnect.
 *
 * Refresh is PROACTIVE (driven by the stored expiry + margin), not reactive. A
 * provider call that 401s mid-sync despite a not-yet-expired local expiry —
 * meaningful clock skew (>30s) or an external revocation — still surfaces as
 * TOKEN_EXPIRED → reconnect rather than auto-refreshing. Accepted residual: the
 * forced open-sync and the periodic tick keep the token ahead of real expiry, so
 * this only bites on clock skew or a revocation where reconnect is the right call.
 */
export async function getFreshAccessToken() {
  const token = await getSyncToken()
  if (!token) return null
  const expiry = (await db.settings.get('syncTokenExpiry'))?.value
  // No expiry (GitHub's non-expiring gist token) or comfortably in-date → use as-is.
  if (!expiry || Date.now() <= expiry - EXPIRY_MARGIN_MS) return token
  return refreshAccessToken()
}

// Single-flight wrapper. Reads the refresh token + provider INSIDE the lock so a
// caller that arrives after a rotation picks up the rotated token, never the
// spent one (see refreshInFlight above).
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken()
      if (!refreshToken) throw new Error('TOKEN_EXPIRED') // nothing to refresh with → reconnect
      const provider = (await db.settings.get('syncProvider'))?.value
      return doRefresh(provider, refreshToken)
    })().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

// Trade the refresh token for a fresh access token via the worker (which holds
// the client secret). The worker's status codes are the contract:
//   401 → refresh token revoked/expired → TOKEN_EXPIRED (one-time reconnect)
//   other non-2xx / network → transient Error (auto-sync swallows + retries next tick)
async function doRefresh(provider, refreshToken) {
  const res = await fetch('/oauth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, refresh_token: refreshToken }),
  })
  if (res.status === 401) throw new Error('TOKEN_EXPIRED')
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`)
  const data = await res.json()
  if (!data?.access_token) throw new Error('Token refresh failed (no token)')
  await setSyncToken(data.access_token)
  await db.settings.put({ key: 'syncTokenExpiry', value: Date.now() + (data.expires_in ?? 3600) * 1000 })
  // Microsoft rotates the refresh token on every use (the old one is now dead);
  // persist the replacement. Google returns none here — the original stays valid.
  if (data.refresh_token) await setRefreshToken(data.refresh_token)
  return data.access_token
}

/** Remove the stored access + refresh tokens (the key is kept; it's reusable). */
export async function clearSyncToken() {
  await db.secrets.delete(TOKEN_NAME)
  await db.secrets.delete(REFRESH_NAME)
  // Also clear any lingering legacy plaintext value.
  try { await db.settings.delete('syncToken') } catch { /* ignore */ }
}
