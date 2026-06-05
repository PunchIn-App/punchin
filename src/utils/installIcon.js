import { accentIconKey } from '../accentPresets'
import { drawFaviconDataUrl } from './favicon'

// Point the install / home-screen icon at the user's accent BEFORE they install
// (issue #228). Per platform:
//  - iOS reads <link rel="apple-touch-icon"> off the page and accepts an inline
//    data URL, so the app renders the EXACT accent there, client-side.
//  - Android & desktop bake the icon from the manifest's icon URLs (Android via
//    Google's WebAPK minting server, which fetches them), so the colour must come
//    from a real URL. <link rel="manifest"> is pointed at:
//      • a preset's pre-rendered STATIC set (/icons/<key>/…) — exact, no compute;
//      • for a custom colour, the worker's on-demand EXACT render
//        (/icons/i/<hex>/…), which falls back to the nearest static swatch on
//        failure (see worker/oauth.js).
//
// Only affects the icon captured at *install* time; an already-installed icon
// can't be changed afterwards (the OS owns it).
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applyInstallIcon(hex) {
  if (typeof document === 'undefined') return
  // iOS: exact colour via a client-rendered data URL (canvas-less envs → null).
  const dataUrl = drawFaviconDataUrl(hex, 180)
  if (dataUrl) setLink('apple-touch-icon', dataUrl)

  const presetKey = accentIconKey(hex)
  const norm = String(hex || '').trim().toLowerCase().replace('#', '')
  setLink(
    'manifest',
    presetKey
      ? `/icons/${presetKey}/manifest.webmanifest` // preset: pre-rendered static set
      : `/icons/i/${norm}/manifest.webmanifest`,    // custom: worker on-demand exact render
  )
}
