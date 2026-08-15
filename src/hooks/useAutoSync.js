import { useEffect } from 'react'
import { useSettings } from './useSettings'
import { setAutoSyncEnabled, trigger, PERIODIC_MS } from '../sync/autoSync'

// Drives the auto-sync engine from settings + the app lifecycle — mount once at
// the app root. Auto-sync runs only while connected and opted in; `autoSync !==
// false` means users who connected before this shipped (no stored value) get it
// ON by default, matching "default ON at connect".
//
// Auto-sync survives an access-token expiry on every provider (issue #243):
// GitHub's token never expires, and an expired Google/OneDrive access token is
// refreshed silently inside runSync.
// So a merely-lapsed access-token expiry is NOT a stop signal — gating on it would
// disable the very open-trigger that performs the refresh. The only stop is
// syncError === 'TOKEN_EXPIRED', set when a refresh actually failed (a dead or
// absent refresh token), at which point the engine stops and "Reconnect" shows.
export function useAutoSync() {
  const { settings } = useSettings()
  const connected = !!settings.syncProvider
  const tokenExpired = settings.syncError === 'TOKEN_EXPIRED'
  const enabled = connected && settings.autoSync !== false && !tokenExpired

  useEffect(() => {
    setAutoSyncEnabled(enabled)
    if (!enabled) return

    trigger('open', { force: true }) // sync once on open / on enabling
    const onFocus = () => trigger('focus')
    const onVisible = () => { if (document.visibilityState === 'visible') trigger('focus') }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(() => trigger('periodic'), PERIODIC_MS)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
      setAutoSyncEnabled(false)
    }
  }, [enabled])
}
