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

  // openPrintWindow now renders into a hidden, same-page iframe (NOT a popup), so
  // the print sheet can be dismissed back to an installed iOS PWA instead of
  // stranding the user on a dead popup tab. These cover the iframe mechanics; the
  // brand-font HTML is asserted by PRINT_FONT_HEAD above and at each call site.
  function getPrintFrame() {
    return document.querySelector('iframe[aria-hidden="true"][title="Print document"]')
  }

  it('renders the document into a hidden, same-page iframe (never a popup window)', () => {
    const openSpy = vi.spyOn(window, 'open')
    const ok = openPrintWindow('<html><body>doc-marker</body></html>')
    expect(ok).toBe(true)
    expect(openSpy).not.toHaveBeenCalled()                       // no popup window
    const frame = getPrintFrame()
    expect(frame).toBeTruthy()
    expect(frame.style.visibility).toBe('hidden')               // offscreen + invisible
    expect(frame.contentDocument.body.textContent).toContain('doc-marker')
    frame.remove()
  })

  it('prints the iframe after the font fallback delay (document.fonts absent in jsdom)', () => {
    vi.useFakeTimers()
    openPrintWindow('<html><body>x</body></html>')
    const frame = getPrintFrame()
    const printSpy = vi.spyOn(frame.contentWindow, 'print').mockImplementation(() => {})
    expect(printSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(printSpy).toHaveBeenCalledTimes(1)
    frame.remove()
  })

  it('removes the print iframe when the app regains focus (print sheet dismissed)', () => {
    openPrintWindow('<html><body>x</body></html>')
    expect(getPrintFrame()).toBeTruthy()
    window.dispatchEvent(new Event('focus'))
    expect(getPrintFrame()).toBeNull()
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
