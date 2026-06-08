import { SYNC_CONFIG } from './config'

describe('SYNC_CONFIG — shape', () => {
  it('exports github, google, and onedrive keys', () => {
    expect(SYNC_CONFIG).toHaveProperty('github')
    expect(SYNC_CONFIG).toHaveProperty('google')
    expect(SYNC_CONFIG).toHaveProperty('onedrive')
  })

  it('github has clientId (string) and callbackBase (string)', () => {
    expect(typeof SYNC_CONFIG.github.clientId).toBe('string')
    expect(typeof SYNC_CONFIG.github.callbackBase).toBe('string')
  })

  it('google has clientId (string) and callbackBase (string)', () => {
    expect(typeof SYNC_CONFIG.google.clientId).toBe('string')
    expect(typeof SYNC_CONFIG.google.callbackBase).toBe('string')
  })

  it('onedrive has clientId (string) and callbackBase (string)', () => {
    expect(typeof SYNC_CONFIG.onedrive.clientId).toBe('string')
    expect(typeof SYNC_CONFIG.onedrive.callbackBase).toBe('string')
  })

  it('clientIds default to empty string when env vars are absent', () => {
    // In the test environment VITE_* vars are not set; the || '' fallbacks kick in
    expect(SYNC_CONFIG.github.clientId).toBe('')
    expect(SYNC_CONFIG.google.clientId).toBe('')
    expect(SYNC_CONFIG.onedrive.clientId).toBe('')
  })
})
