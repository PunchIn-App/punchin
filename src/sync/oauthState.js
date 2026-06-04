// CSRF protection for the OAuth sync flows (issue #125). Before redirecting to a
// provider we mint a random `state` nonce and stash it in sessionStorage; on the
// callback we require the returned `state` to match the stashed one. This stops
// an attacker from completing OAuth in the victim's browser and silently
// connecting *their* account/token (login CSRF / token fixation).
//
// sessionStorage is the right store: it survives the same-tab redirect round
// trip, is per-origin, isn't shared with other tabs, and is cleared when the tab
// closes — so a stale nonce can't linger.

const STATE_KEY = 'pi.oauthState'

/** Mint a random nonce, persist it, and return it to embed in the OAuth `state`. */
export function createOAuthState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  try {
    sessionStorage.setItem(STATE_KEY, nonce)
  } catch {
    /* private mode / storage disabled — best effort; verification will simply fail closed */
  }
  return nonce
}

/**
 * Verify a returned nonce against the stored one, then clear it (one-time use).
 * Returns true only on an exact, non-empty match — so a missing/blank/mismatched
 * state always fails closed.
 */
export function consumeOAuthState(returned) {
  let stored = null
  try {
    stored = sessionStorage.getItem(STATE_KEY)
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    /* ignore */
  }
  return Boolean(returned) && Boolean(stored) && returned === stored
}
