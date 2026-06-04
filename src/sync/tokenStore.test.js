import 'fake-indexeddb/auto'
import { db } from '../db'
import { setSyncToken, getSyncToken, clearSyncToken } from './tokenStore'

beforeEach(async () => {
  await db.secrets.clear()
  await db.settings.delete('syncToken')
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
