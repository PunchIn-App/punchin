import { describe, it, expect, vi, afterEach } from 'vitest'
import { PRINT_FONT_HEAD, openPrintWindow, laborBadgeHTML } from './printDocument'

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

describe('laborBadgeHTML', () => {
  it('returns a string containing an <svg> and the labor type name', () => {
    const lt = { name: 'Design', color: '#6366F1', glyph: 'code' }
    const html = laborBadgeHTML(lt)
    expect(html).toContain('<svg')
    expect(html).toContain('Design')
  })

  it('uses the labor color for the glyph stroke', () => {
    const lt = { name: 'Dev', color: '#FF0000', glyph: 'code' }
    const html = laborBadgeHTML(lt)
    expect(html).toContain('#FF0000')
  })

  it('uses a neutral pill background (not the labor color as the pill fill)', () => {
    const lt = { name: 'Dev', color: '#FF0000', glyph: 'code' }
    const html = laborBadgeHTML(lt)
    // The pill itself should be white/neutral, not a solid color fill
    expect(html).toContain('#ffffff')
    // The pill background should NOT be #FF0000 directly
    expect(html).not.toMatch(/background:#FF0000(?:[^3]|$)/)
  })

  it('falls back to the PunchIn brand mark when glyph is unknown/unset', () => {
    const lt = { name: 'Other', color: '#6366F1', glyph: undefined }
    const html = laborBadgeHTML(lt)
    expect(html).toContain('<svg')
    expect(html).toContain('Other')
  })

  it('escapes HTML special characters in labor type name', () => {
    const lt = { name: 'Dev & Ops <special>', color: '#6366F1', glyph: 'code' }
    const html = laborBadgeHTML(lt)
    expect(html).toContain('Dev &amp; Ops &lt;special&gt;')
    expect(html).not.toContain('<special>')
  })

  it('returns "—" when lt is null or undefined', () => {
    expect(laborBadgeHTML(null)).toBe('—')
    expect(laborBadgeHTML(undefined)).toBe('—')
  })

  it('falls back to DEFAULT_LABOR_COLOR when no color is given', () => {
    const lt = { name: 'Uncolored', glyph: 'code' }
    const html = laborBadgeHTML(lt)
    // Should not throw and should still contain an svg
    expect(html).toContain('<svg')
    expect(html).toContain('Uncolored')
  })
})
