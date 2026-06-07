import { applyInstallIcon } from './installIcon'

// Canvas isn't available in jsdom, so stub the data-URL renderer.
vi.mock('./favicon', () => ({
  drawFaviconDataUrl: (hex) => `data:image/png;base64,MOCK-${hex}`,
}))

const link = (rel) => document.head.querySelector(`link[rel="${rel}"]`)

describe('applyInstallIcon (#228)', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('points the manifest at the pre-rendered static set for a preset', () => {
    applyInstallIcon('#2D5BF5')
    expect(link('manifest').getAttribute('href')).toBe('/icons/2d5bf5/manifest.webmanifest')
  })

  it('points a custom colour at the nearest STATIC swatch (never the worker /icons/i/ route, which 404s without the Worker and breaks the install prompt)', () => {
    applyInstallIcon('#7C3AED')
    const href = link('manifest').getAttribute('href')
    expect(href).toMatch(/^\/icons\/[0-9a-f]{6}\/manifest\.webmanifest$/) // a committed swatch folder
    expect(href).not.toContain('/icons/i/')
  })

  it('sets an exact-colour apple-touch-icon for iOS', () => {
    applyInstallIcon('#7C3AED')
    expect(link('apple-touch-icon').getAttribute('href')).toBe('data:image/png;base64,MOCK-#7C3AED')
  })

  it('reuses the existing manifest link instead of duplicating it', () => {
    const el = document.createElement('link')
    el.setAttribute('rel', 'manifest')
    el.setAttribute('href', '/manifest.webmanifest')
    document.head.appendChild(el)

    applyInstallIcon('#F59E0B')

    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1)
    expect(link('manifest').getAttribute('href')).toBe('/icons/f59e0b/manifest.webmanifest')
  })
})
