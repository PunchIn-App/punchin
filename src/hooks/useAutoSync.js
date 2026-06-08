import { useEffect } from 'react'
import { useSettings } from './useSettings'
import { setAutoSyncEnabled, trigger, PERIODIC_MS } from '../sync/autoSync'

// Drives the auto-sync engine from settings + the app lifecycle — mount once at
// the app root. Auto-sync runs only while connected, opted in, and the token is
// live; `autoSync !== false` means users who connected before this shipped (no
// stored value) get it ON by default, matching "default ON at connect".
//
// GitHub tokens don't expire, so this is fully seamless there today; Google /
// OneDrive (~1h, non-refreshable until the refresh-token work lands) will hit
// TOKEN_EXPIRED, at which point the engine stops and the "Reconnect" nudge shows.
export function useAutoSync() {
  const { settings } = useSettings()
  const connected = !!settings.syncProvider
  const tokenExpired =
    (settings.syncTokenExpiry && Date.now() > settings.syncTokenExpiry) ||
    settings.syncError === 'TOKEN_EXPIRED'
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
