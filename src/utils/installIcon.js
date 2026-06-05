import { nearestPaletteKey } from '../iconPalette'
import { drawFaviconDataUrl } from './favicon'

// Point the install / home-screen icon at the user's accent BEFORE they install
// (issue #228). The two platforms get it differently:
//  - iOS reads <link rel="apple-touch-icon"> off the page and accepts an inline
//    data URL, so we render the EXACT accent there, client-side.
//  - Android & desktop bake the icon from the manifest's icon URLs (Android via
//    Google's WebAPK minting server, which fetches them itself), so a custom
//    colour can't be supplied on the fly — we instead point <link rel="manifest">
//    at the nearest pre-rendered palette swatch under /icons/<key>/.
//
// This only affects the icon captured at *install* time; an already-installed
// icon can't be changed afterwards (the OS owns it).
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
  // iOS: exact colour via a client-rendered data URL (best-effort — depends on
  // iOS honouring data-URL touch icons; canvas-less environments return null).
  const dataUrl = drawFaviconDataUrl(hex, 180)
  if (dataUrl) setLink('apple-touch-icon', dataUrl)
  // Android / desktop: the nearest pre-rendered swatch's manifest.
  setLink('manifest', `/icons/${nearestPaletteKey(hex)}/manifest.webmanifest`)
}
