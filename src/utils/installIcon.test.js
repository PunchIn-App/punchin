import { applyInstallIcon } from './installIcon'

// Canvas isn't available in jsdom, so stub the data-URL renderer.
vi.mock('./favicon', () => ({
  drawFaviconDataUrl: (hex) => `data:image/png;base64,MOCK-${hex}`,
}))

const link = (rel) => document.head.querySelector(`link[rel="${rel}"]`)

describe('applyInstallIcon (#228)', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('points the manifest at the matching palette swatch for a preset', () => {
    applyInstallIcon('#1f6feb')
    expect(link('manifest').getAttribute('href')).toBe('/icons/1f6feb/manifest.webmanifest')
  })

  it('snaps a custom colour to a palette swatch manifest', () => {
    applyInstallIcon('#7C3AED')
    expect(link('manifest').getAttribute('href')).toMatch(/^\/icons\/[0-9a-f]{6}\/manifest\.webmanifest$/)
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
