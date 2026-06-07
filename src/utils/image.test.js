import { describe, it, expect, vi, afterEach } from 'vitest'
import { fileToLogoDataUrl } from './image'

const realCreate = document.createElement.bind(document)
const OrigImage = global.Image

// jsdom doesn't decode images or implement canvas 2D, so stub Image (fire
// load/error async) and document.createElement('canvas').
function stubImage({ width = 400, height = 100, fail = false } = {}) {
  global.Image = class {
    set src(v) {
      this._src = v
      Promise.resolve().then(() => {
        if (fail) return this.onerror && this.onerror()
        this.width = width
        this.height = height
        this.onload && this.onload()
      })
    }
  }
}
function stubCanvas(ctx, dataUrl = 'data:image/png;base64,SMALL') {
  vi.spyOn(document, 'createElement').mockImplementation(tag =>
    tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx, toDataURL: () => dataUrl } : realCreate(tag),
  )
}

afterEach(() => { vi.restoreAllMocks(); global.Image = OrigImage })

describe('fileToLogoDataUrl', () => {
  it('downscales via canvas and returns a PNG data URL', async () => {
    stubImage({ width: 800, height: 200 })
    const drawImage = vi.fn()
    stubCanvas({ drawImage }, 'data:image/png;base64,SCALED')
    const url = await fileToLogoDataUrl(new Blob(['x'], { type: 'image/png' }), 240)
    expect(url).toBe('data:image/png;base64,SCALED')
    expect(drawImage).toHaveBeenCalled()
  })

  it('falls back to the raw data URL when canvas 2D is unavailable', async () => {
    stubImage()
    stubCanvas(null)
    const url = await fileToLogoDataUrl(new Blob(['x'], { type: 'image/png' }))
    expect(url).toMatch(/^data:/)
  })

  it('falls back to the raw data URL when the image cannot be decoded', async () => {
    stubImage({ fail: true })
    const url = await fileToLogoDataUrl(new Blob(['x'], { type: 'image/png' }))
    expect(url).toMatch(/^data:/)
  })
})
