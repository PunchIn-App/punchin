import { accentIconKey } from '../accentPresets'
import { nearestPaletteKey } from '../iconPalette'
import { drawFaviconDataUrl } from './favicon'

// Point the install / home-screen icon at the user's accent BEFORE they install
// (issue #228). Per platform:
//  - iOS reads <link rel="apple-touch-icon"> off the page and accepts an inline
//    data URL, so the app renders the EXACT accent there, client-side.
//  - Android & desktop bake the icon from the manifest's icon URLs (Android via
//    Google's WebAPK minting server, which fetches them), so the colour must come
//    from a real URL. <link rel="manifest"> is pointed at:
//      • a preset's pre-rendered STATIC set (/icons/<key>/…) — exact, no compute;
//      • for a custom colour, the nearest STATIC swatch as an always-valid default,
//        then UPGRADED to the worker's on-demand EXACT render (/icons/i/<hex>/…)
//        once a one-time probe confirms the worker is actually serving here.
//
// Why probe instead of a build-time flag: `npm run preview` serves the production
// build (so `import.meta.env.PROD` is true) with no worker, and the app can be
// self-hosted on a real domain without the worker — in both cases /icons/i/ 404s
// to the SPA index.html, an invalid manifest that silently disables the install
// prompt. The probe tests the actual capability (does this origin serve the route)
// rather than guessing from the build mode or hostname, so it's correct across
// prod-with-worker, preview, dev, and self-host. We default to the safe static
// swatch and only upgrade on a confirmed probe, so the install icon is never worse
// than today — at worst the nearest swatch, at best the exact colour.
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

// One-time, single-flight probe: does this origin actually serve the worker's
// on-demand icon route, or does it fall through to the SPA shell? The manifest
// branch of the route returns static JSON (no PNG render), so this is cheap; the
// content-type is the discriminator (application/manifest+json vs text/html).
// Cached for the session — the answer can't change without a redeploy.
let workerProbe
function probeWorkerIcons() {
  if (!workerProbe) {
    workerProbe =
      typeof fetch === 'function'
        ? fetch('/icons/i/2d5bf5/manifest.webmanifest')
            .then((res) => res.ok && (res.headers.get('content-type') || '').includes('manifest'))
            .catch(() => false)
        : Promise.resolve(false)
  }
  return workerProbe
}

// The accent whose install icon is currently applied. Guards stale async upgrades:
// if the user changes accent again before the probe resolves, only the latest pick
// is honoured.
let currentAccent

export function applyInstallIcon(hex) {
  if (typeof document === 'undefined') return
  currentAccent = hex

  // iOS: exact colour via a client-rendered data URL (canvas-less envs → null).
  const dataUrl = drawFaviconDataUrl(hex, 180)
  if (dataUrl) setLink('apple-touch-icon', dataUrl)

  // Preset: the committed static set is already the exact colour — done, no probe.
  const presetKey = accentIconKey(hex)
  if (presetKey) {
    setLink('manifest', `/icons/${presetKey}/manifest.webmanifest`)
    return
  }

  // Custom colour: paint the always-valid nearest static swatch now…
  setLink('manifest', `/icons/${nearestPaletteKey(hex)}/manifest.webmanifest`)
  // …then upgrade to the worker's exact on-demand render iff it's served here.
  const h = hex.replace(/^#/, '').toLowerCase()
  probeWorkerIcons().then((available) => {
    if (available && currentAccent === hex) {
      setLink('manifest', `/icons/i/${h}/manifest.webmanifest`)
    }
  })
}
