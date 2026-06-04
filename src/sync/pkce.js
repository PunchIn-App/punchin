// PKCE (Proof Key for Code Exchange) helpers for the OneDrive Authorization
// Code flow (issue #128). The app mints a random `code_verifier`, sends only its
// SHA-256 `code_challenge` to the authorize endpoint, and proves possession of
// the verifier at token-exchange time — so the access token is obtained via a
// direct POST and never travels in the URL (unlike the implicit flow).

const VERIFIER_KEY = 'pi.pkceVerifier'

function base64url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Mint a `code_verifier`, persist it in sessionStorage (survives the redirect,
 * per-origin, cleared on tab close), and return the `code_challenge` (S256) to
 * embed in the authorize URL.
 */
export async function createPkceChallenge() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier)
  } catch {
    /* private mode — best effort; the exchange will fail closed without a verifier */
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** Read and clear the stored verifier (one-time use), or null if absent. */
export function consumePkceVerifier() {
  let v = null
  try {
    v = sessionStorage.getItem(VERIFIER_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
  } catch {
    /* ignore */
  }
  return v
}
