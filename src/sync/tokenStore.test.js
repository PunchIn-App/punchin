import 'fake-indexeddb/auto'
import { db } from '../db'
import {
  setSyncToken, getSyncToken, getFreshAccessToken, clearSyncToken,
  setRefreshToken, getRefreshToken,
} from './tokenStore'

beforeEach(async () => {
  await db.secrets.clear()
  await db.settings.delete('syncToken')
  await db.settings.delete('syncTokenExpiry')
  await db.settings.delete('syncProvider')
})
afterAll(async () => { await db.close(); await db.delete() })

describe('tokenStore — encrypted at-rest sync token (issue #126)', () => {
  it('round-trips a token through encryption', async () => {
    await setSyncToken('secret-token-123')
    expect(await getSyncToken()).toBe('secret-token-123')
  })

  it('does not store the token in plaintext, and uses a non-extractable key', async () => {
    await setSyncToken('plain-look-for-me')
    const rec = await db.secrets.get('syncToken')
    // ciphertext bytes are present and contain no trace of the plaintext
    // (instanceof is unreliable here: fake-indexeddb structured-clones the
    // Uint8Array across realms — real IndexedDB preserves it; decrypt still works)
    expect(rec.ct.length).toBeGreaterThan(0)
    expect(new TextDecoder().decode(new Uint8Array(rec.ct))).not.toContain('plain-look-for-me')
    const keyRec = await db.secrets.get('syncKey')
    expect(keyRec.key.extractable).toBe(false)
  })

  it('returns null when nothing is stored', async () => {
    expect(await getSyncToken()).toBeNull()
  })

  it('clearSyncToken removes the token', async () => {
    await setSyncToken('t')
    await clearSyncToken()
    expect(await getSyncToken()).toBeNull()
  })

  it('lazily migrates a legacy plaintext settings.syncToken and removes the plaintext', async () => {
    await db.settings.put({ key: 'syncToken', value: 'legacy-plaintext' })
    expect(await getSyncToken()).toBe('legacy-plaintext') // migrated transparently
    expect(await db.settings.get('syncToken')).toBeUndefined() // plaintext removed
    expect(await getSyncToken()).toBe('legacy-plaintext') // now served from the encrypted store
  })
})

describe('tokenStore — getFreshAccessToken chokepoint', () => {
  it('returns null when there is no token (not connected)', async () => {
    expect(await getFreshAccessToken()).toBeNull()
  })

  it('returns the token when there is no expiry (e.g. GitHub, never expires)', async () => {
    await setSyncToken('gh-token')
    expect(await getFreshAccessToken()).toBe('gh-token')
  })

  it('returns the token when the expiry is comfortably in the future', async () => {
    await setSyncToken('fresh')
    await db.settings.put({ key: 'syncTokenExpiry', value: Date.now() + 3_600_000 })
    expect(await getFreshAccessToken()).toBe('fresh')
  })

  it('throws TOKEN_EXPIRED inside the safety margin when there is no refresh token', async () => {
    await setSyncToken('stale')
    await db.settings.put({ key: 'syncTokenExpiry', value: Date.now() + 5_000 }) // inside the 30s margin
    await expect(getFreshAccessToken()).rejects.toThrow('TOKEN_EXPIRED')
  })
})

describe('tokenStore — refresh token storage (issue #243)', () => {
  it('round-trips the refresh token through encryption', async () => {
    await setRefreshToken('refresh-abc')
    expect(await getRefreshToken()).toBe('refresh-abc')
  })

  it('stores the refresh token encrypted (no plaintext trace)', async () => {
    await setRefreshToken('refresh-look-for-me')
    const rec = await db.secrets.get('syncRefreshToken')
    expect(new TextDecoder().decode(new Uint8Array(rec.ct))).not.toContain('refresh-look-for-me')
  })

  it('returns null when no refresh token is stored', async () => {
    expect(await getRefreshToken()).toBeNull()
  })

  it('treats an empty refresh token as a no-op (nothing stored)', async () => {
    await setRefreshToken('')
    expect(await getRefreshToken()).toBeNull()
  })

  it('clearSyncToken removes BOTH the access and the refresh token', async () => {
    await setSyncToken('a')
    await setRefreshToken('r')
    await clearSyncToken()
    expect(await getSyncToken()).toBeNull()
    expect(await getRefreshToken()).toBeNull()
  })
})

describe('tokenStore — getFreshAccessToken silent refresh (issue #243)', () => {
  let fetchMock
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => vi.unstubAllGlobals())

  const expire = async (provider) => {
    await db.settings.put({ key: 'syncProvider', value: provider })
    await db.settings.put({ key: 'syncTokenExpiry', value: Date.now() - 1_000 }) // already past
  }

  // The discriminating test: an expired access token + a stored refresh token
  // refreshes silently (no throw), returns the NEW token, and persists the new
  // expiry plus the rotated refresh token — all from one worker round-trip.
  it('silently refreshes an expired access token via the worker and persists the result', async () => {
    await setSyncToken('stale-access')
    await setRefreshToken('refresh-1')
    await expire('onedrive')
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ access_token: 'fresh-access', expires_in: 3600, refresh_token: 'refresh-2' }),
    })

    expect(await getFreshAccessToken()).toBe('fresh-access')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/oauth/refresh')
    expect(JSON.parse(opts.body)).toEqual({ provider: 'onedrive', refresh_token: 'refresh-1' })

    expect(await getSyncToken()).toBe('fresh-access')
    expect((await db.settings.get('syncTokenExpiry')).value).toBeGreaterThan(Date.now())
    expect(await getRefreshToken()).toBe('refresh-2') // Microsoft rotates → stored replacement
  })

  it('keeps the existing refresh token when the provider returns none (Google does not rotate)', async () => {
    await setSyncToken('stale')
    await setRefreshToken('refresh-keep')
    await expire('google')
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'g2', expires_in: 3600 }) })
    await getFreshAccessToken()
    expect(await getRefreshToken()).toBe('refresh-keep')
  })

  it('throws TOKEN_EXPIRED without calling the worker when no refresh token is stored', async () => {
    await setSyncToken('stale')
    await expire('google')
    await expect(getFreshAccessToken()).rejects.toThrow('TOKEN_EXPIRED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws TOKEN_EXPIRED when the worker reports the refresh token is dead (401)', async () => {
    await setSyncToken('stale')
    await setRefreshToken('dead')
    await expire('onedrive')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'invalid_grant' }) })
    await expect(getFreshAccessToken()).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('throws a retryable (NON-TOKEN_EXPIRED) error on a transient worker failure (502)', async () => {
    await setSyncToken('stale')
    await setRefreshToken('r')
    await expire('onedrive')
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    const err = await getFreshAccessToken().catch(e => e)
    // Must NOT be TOKEN_EXPIRED, so auto-sync retries instead of forcing a reconnect.
    expect(err.message).not.toBe('TOKEN_EXPIRED')
    expect(err.message).toMatch(/Token refresh failed/)
  })

  it('collapses concurrent refreshes into a single worker call (single-flight)', async () => {
    // Guards against re-spending a rotated (now-dead) Microsoft refresh token when
    // a manual "Sync Now" races a periodic tick.
    await setSyncToken('stale')
    await setRefreshToken('r1')
    await expire('onedrive')
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ access_token: 'fresh', expires_in: 3600, refresh_token: 'r2' }),
    })
    const [a, b] = await Promise.all([getFreshAccessToken(), getFreshAccessToken()])
    expect(a).toBe('fresh')
    expect(b).toBe('fresh')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
