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

async function getOrCreateKey() {
  const existing = await db.secrets.get(KEY_NAME)
  if (existing?.key) return existing.key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await db.secrets.put({ name: KEY_NAME, key })
  return key
}

/** Encrypt and persist the sync token (replaces any prior value). */
export async function setSyncToken(token) {
  if (!token) return clearSyncToken()
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  )
  await db.secrets.put({ name: TOKEN_NAME, iv, ct })
}

/**
 * Return the decrypted sync token, or null if not connected. Lazily migrates a
 * pre-existing plaintext `settings.syncToken` (from before this change) into the
 * encrypted store so already-connected users don't have to re-authenticate.
 */
export async function getSyncToken() {
  const rec = await db.secrets.get(TOKEN_NAME)
  if (rec?.ct) {
    const key = await getOrCreateKey()
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(rec.iv) }, key, rec.ct)
      return new TextDecoder().decode(pt)
    } catch {
      return null // key/ciphertext mismatch — treat as disconnected
    }
  }
  // Legacy plaintext fallback + one-time migration.
  const legacy = await db.settings.get('syncToken')
  if (legacy?.value) {
    await setSyncToken(legacy.value)
    await db.settings.delete('syncToken')
    return legacy.value
  }
  return null
}

/** Remove the stored token (the key is kept; it's harmless and reusable). */
export async function clearSyncToken() {
  await db.secrets.delete(TOKEN_NAME)
  // Also clear any lingering legacy plaintext value.
  try { await db.settings.delete('syncToken') } catch { /* ignore */ }
}
