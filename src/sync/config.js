export const SYNC_CONFIG = {
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    // callback goes through the Cloudflare Worker at /oauth/github/callback
    callbackBase: import.meta.env.VITE_APP_URL || window.location.origin,
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  },
  onedrive: {
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
  },
}
