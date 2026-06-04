import { createOAuthState, consumeOAuthState } from './oauthState'

describe('oauthState — OAuth CSRF nonce (issue #125)', () => {
  beforeEach(() => sessionStorage.clear())

  it('createOAuthState returns a 32-char hex nonce and stores it', () => {
    const nonce = createOAuthState()
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(sessionStorage.getItem('pi.oauthState')).toBe(nonce)
  })

  it('generates a different nonce each call', () => {
    expect(createOAuthState()).not.toBe(createOAuthState())
  })

  it('consumeOAuthState returns true for a matching nonce and clears it (one-time use)', () => {
    const nonce = createOAuthState()
    expect(consumeOAuthState(nonce)).toBe(true)
    expect(sessionStorage.getItem('pi.oauthState')).toBeNull()
    expect(consumeOAuthState(nonce)).toBe(false) // already consumed
  })

  it('fails closed for a mismatched, empty, or missing nonce', () => {
    createOAuthState()
    expect(consumeOAuthState('wrong')).toBe(false) // mismatch (and clears)
    expect(consumeOAuthState('')).toBe(false)
    expect(consumeOAuthState(undefined)).toBe(false)
  })
})
