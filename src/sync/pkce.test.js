import { createPkceChallenge, consumePkceVerifier } from './pkce'

describe('pkce — Auth Code + PKCE helpers (issue #128)', () => {
  beforeEach(() => sessionStorage.clear())

  it('createPkceChallenge stores a verifier and returns a base64url S256 challenge', async () => {
    const challenge = await createPkceChallenge()
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/) // base64url, no padding
    expect(challenge).not.toContain('=')
    const verifier = sessionStorage.getItem('pi.pkceVerifier')
    expect(verifier).toBeTruthy()
    expect(challenge).not.toBe(verifier) // the challenge is the SHA-256 of the verifier
  })

  it('consumePkceVerifier returns the stored verifier once, then null (one-time use)', async () => {
    await createPkceChallenge()
    expect(consumePkceVerifier()).toBeTruthy()
    expect(consumePkceVerifier()).toBeNull()
  })

  it('returns null when no verifier is stored', () => {
    expect(consumePkceVerifier()).toBeNull()
  })
})
