import { drawFaviconDataUrl, updateFavicon } from './favicon'

const realCreate = document.createElement.bind(document)

function stubCanvas(dataUrl = 'data:image/png;base64,FAKE') {
  const ctx = {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), arcTo: vi.fn(),
    arc: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  }
  const canvas = {
    width: 0, height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => dataUrl),
  }
  vi.spyOn(document, 'createElement').mockImplementation(tag =>
    tag === 'canvas' ? canvas : realCreate(tag)
  )
  return { canvas, ctx }
}

function stubCanvasNoContext() {
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => null), toDataURL: vi.fn() }
  vi.spyOn(document, 'createElement').mockImplementation(tag =>
    tag === 'canvas' ? canvas : realCreate(tag)
  )
  return canvas
}

afterEach(() => {
  vi.restoreAllMocks()
  document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove())
  document.getElementById('dynamic-favicon')?.remove()
})

describe('drawFaviconDataUrl', () => {
  it('returns a PNG data URL drawn in the given accent color', () => {
    const { ctx, canvas } = stubCanvas('data:image/png;base64,XYZ')
    const url = drawFaviconDataUrl('#F59E0B')
    expect(url).toBe('data:image/png;base64,XYZ')
    expect(ctx.fillStyle).toBe('#F59E0B')
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  it('returns null when no 2D context is available', () => {
    stubCanvasNoContext()
    expect(drawFaviconDataUrl('#ffffff')).toBeNull()
  })
})

describe('updateFavicon', () => {
  it('creates a dynamic favicon link with the rendered data URL', () => {
    stubCanvas('data:image/png;base64,LINK')
    updateFavicon('#1f6feb')
    const link = document.getElementById('dynamic-favicon')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('data:image/png;base64,LINK')
    expect(link.rel).toBe('icon')
  })

  it('declares a sizes attribute so the icon stays crisp on high-DPI (#164)', () => {
    stubCanvas('data:image/png;base64,SZ')
    updateFavicon('#1f6feb')
    expect(document.getElementById('dynamic-favicon').getAttribute('sizes')).toBe('96x96')
  })

  it('removes any pre-existing static icon link so the dynamic one wins', () => {
    const stale = realCreate('link')
    stale.rel = 'icon'
    stale.href = '/icon-192.png'
    document.head.appendChild(stale)

    stubCanvas('data:image/png;base64,NEW')
    updateFavicon('#000000')

    const icons = document.querySelectorAll('link[rel~="icon"]')
    expect(icons.length).toBe(1)
    expect(icons[0].id).toBe('dynamic-favicon')
  })

  it('updates the same link on subsequent accent changes', () => {
    const { canvas } = stubCanvas()
    canvas.toDataURL
      .mockReturnValueOnce('data:image/png;base64,FIRST')
      .mockReturnValueOnce('data:image/png;base64,SECOND')
    updateFavicon('#111111')
    updateFavicon('#222222')
    const links = document.querySelectorAll('#dynamic-favicon')
    expect(links.length).toBe(1)
    expect(links[0].getAttribute('href')).toBe('data:image/png;base64,SECOND')
  })

  it('does not throw when canvas is unsupported', () => {
    stubCanvasNoContext()
    expect(() => updateFavicon('#000000')).not.toThrow()
    expect(document.getElementById('dynamic-favicon')).toBeNull()
  })
})
