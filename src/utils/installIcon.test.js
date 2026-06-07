import { waitFor } from '@testing-library/react'

// Canvas isn't available in jsdom, so stub the data-URL renderer.
vi.mock('./favicon', () => ({
  drawFaviconDataUrl: (hex) => `data:image/png;base64,MOCK-${hex}`,
}))

const link = (rel) => document.head.querySelector(`link[rel="${rel}"]`)

// Re-import per test so the module-level worker-probe cache (single-flight) starts
// clean each time.
async function load() {
  return (await import('./installIcon')).applyInstallIcon
}

const flush = () => new Promise((r) => setTimeout(r))

// A Response-ish stub whose content-type header drives the capability probe.
const resWith = (ct, ok = true) => ({
  ok,
  headers: { get: (h) => (h.toLowerCase() === 'content-type' ? ct : null) },
})
const MANIFEST_RES = resWith('application/manifest+json; charset=utf-8')
const HTML_RES = resWith('text/html; charset=utf-8') // SPA fallback (no worker)

function stubFetch(impl) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

describe('applyInstallIcon (#228)', () => {
  it('points the manifest at the pre-rendered static set for a preset', async () => {
    stubFetch(() => Promise.resolve(MANIFEST_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#2D5BF5')
    expect(link('manifest').getAttribute('href')).toBe('/icons/2d5bf5/manifest.webmanifest')
  })

  it('does NOT probe the worker for a preset colour (the common case stays network-free)', async () => {
    const fetchSpy = stubFetch(() => Promise.resolve(MANIFEST_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#F59E0B')
    await flush()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(link('manifest').getAttribute('href')).toBe('/icons/f59e0b/manifest.webmanifest')
  })

  it('paints a custom colour at the nearest STATIC swatch synchronously (a valid manifest before any probe resolves)', async () => {
    stubFetch(() => new Promise(() => {})) // never resolves
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    const href = link('manifest').getAttribute('href')
    expect(href).toMatch(/^\/icons\/[0-9a-f]{6}\/manifest\.webmanifest$/) // a committed swatch folder
    expect(href).not.toContain('/icons/i/')
  })

  it('upgrades a custom colour to the worker EXACT render once the probe confirms the worker is serving', async () => {
    stubFetch(() => Promise.resolve(MANIFEST_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    await waitFor(() => {
      expect(link('manifest').getAttribute('href')).toBe('/icons/i/7c3aed/manifest.webmanifest')
    })
  })

  it('keeps the static swatch when the probe gets the SPA fallback (no worker — dev/preview/self-host)', async () => {
    const fetchSpy = stubFetch(() => Promise.resolve(HTML_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    await flush()
    expect(fetchSpy).toHaveBeenCalled()
    expect(link('manifest').getAttribute('href')).not.toContain('/icons/i/')
  })

  it('keeps the static swatch when the probe network-errors (offline)', async () => {
    const fetchSpy = stubFetch(() => Promise.reject(new Error('offline')))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    await flush()
    expect(fetchSpy).toHaveBeenCalled()
    expect(link('manifest').getAttribute('href')).not.toContain('/icons/i/')
  })

  it('probes the worker only once across many accent changes (single-flight cache)', async () => {
    const fetchSpy = stubFetch(() => Promise.resolve(MANIFEST_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    applyInstallIcon('#EC4899')
    applyInstallIcon('#7C3AED')
    await waitFor(() => expect(link('manifest').getAttribute('href')).toContain('/icons/i/'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('upgrades only to the LATEST custom colour when rapid changes race the probe', async () => {
    stubFetch(() => Promise.resolve(MANIFEST_RES))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED') // A
    applyInstallIcon('#EC4899') // B — the latest pick
    await waitFor(() => {
      expect(link('manifest').getAttribute('href')).toBe('/icons/i/ec4899/manifest.webmanifest')
    })
    expect(link('manifest').getAttribute('href')).not.toBe('/icons/i/7c3aed/manifest.webmanifest')
  })

  it('sets an exact-colour apple-touch-icon for iOS', async () => {
    stubFetch(() => new Promise(() => {}))
    const applyInstallIcon = await load()
    applyInstallIcon('#7C3AED')
    expect(link('apple-touch-icon').getAttribute('href')).toBe('data:image/png;base64,MOCK-#7C3AED')
  })

  it('reuses the existing manifest link instead of duplicating it', async () => {
    stubFetch(() => new Promise(() => {}))
    const applyInstallIcon = await load()
    const el = document.createElement('link')
    el.setAttribute('rel', 'manifest')
    el.setAttribute('href', '/manifest.webmanifest')
    document.head.appendChild(el)

    applyInstallIcon('#F59E0B') // preset → static, no probe

    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1)
    expect(link('manifest').getAttribute('href')).toBe('/icons/f59e0b/manifest.webmanifest')
  })
})
