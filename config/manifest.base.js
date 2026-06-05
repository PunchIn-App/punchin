// The canonical PWA manifest, shared by the Vite build (config/vite.config.js)
// and the per-accent install-icon generator (scripts/icons.mjs) so the per-colour
// manifest variants can never drift from the real one (issue #228).
//
// The icon `src` values are RELATIVE, so the same manifest object resolves to the
// root icons when served at /manifest.webmanifest and to a palette colour's icons
// when copied to /icons/<key>/manifest.webmanifest.
export const manifest = {
  name: 'PunchIn',
  short_name: 'PunchIn',
  description: 'Precision time tracking for freelancers',
  theme_color: '#0F1117',
  background_color: '#0F1117',
  display: 'standalone',
  orientation: 'any',
  start_url: '/',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
