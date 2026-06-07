import { describe, it, expect, vi, afterEach } from 'vitest'
import { PRINT_FONT_HEAD, openPrintWindow } from './printDocument'

describe('printDocument', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('PRINT_FONT_HEAD declares the self-hosted Noto brand webfonts (not a CDN or system-UI fallback)', () => {
    expect(PRINT_FONT_HEAD).toContain('@font-face')
    expect(PRINT_FONT_HEAD).not.toContain('fonts.googleapis.com')
    expect(PRINT_FONT_HEAD).toContain('/fonts/noto-sans-latin-wght-normal.woff2')
    expect(PRINT_FONT_HEAD).toContain("'Noto Sans Display'")
    expect(PRINT_FONT_HEAD).toContain("'Noto Sans Mono'")
  })

  it('writes the document and waits for the brand webfonts before printing', async () => {
    let resolveReady
    const ready = new Promise((r) => { resolveReady = r })
    const win = {
      document: { write: vi.fn(), close: vi.fn(), fonts: { ready } },
      focus: vi.fn(),
      print: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(win)

    const ok = openPrintWindow('<html>doc</html>', { width: 800, height: 600 })

    expect(ok).toBe(true)
    expect(win.document.write).toHaveBeenCalledWith('<html>doc</html>')
    expect(win.document.close).toHaveBeenCalled()
    expect(win.print).not.toHaveBeenCalled() // must not print before fonts load

    resolveReady()
    await ready
    expect(win.print).toHaveBeenCalled()
  })

  it('falls back to a timed print when document.fonts is unavailable', () => {
    vi.useFakeTimers()
    const win = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(win)

    openPrintWindow('<html>doc</html>')

    expect(win.print).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(win.print).toHaveBeenCalled()
  })

  it('returns false without throwing when the popup is blocked (window.open → null)', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    let result
    expect(() => { result = openPrintWindow('<html>doc</html>') }).not.toThrow()
    expect(result).toBe(false)
  })
})
