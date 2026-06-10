export const SYNC_CONFIG = {
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    // callback goes through the Cloudflare Worker at /oauth/github/callback
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    // Auth Code flow via the worker at /oauth/google/callback (issue #243)
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
  onedrive: {
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
    // Auth Code flow via the worker at /oauth/onedrive/callback (issue #243)
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
}
