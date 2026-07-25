import { describe, it, expect, vi, afterEach } from 'vitest'
import { PRINT_FONT_HEAD, openPrintWindow, laborBadgeHTML, scopePrintCss } from './printDocument'

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

  // The hidden-iframe path stays for iOS/desktop; passing a non-'android' os (or
  // none) must not change it. This guards against the Android fix leaking into
  // the platforms that already print correctly.
  it('keeps the hidden-iframe path for a non-android os (no main-document injection)', () => {
    const ok = openPrintWindow('<html><body>x</body></html>', 'web')
    expect(ok).toBe(true)
    expect(getPrintFrame()).toBeTruthy()
    expect(document.querySelector('#pi-print-root')).toBeNull()
    getPrintFrame()?.remove()
  })
})

// Android Chrome/WebView cannot target a subframe's print() — it always
// serializes the TOP-LEVEL document — so the hidden-iframe path prints the app
// UI instead of the document (#294/#316). On the android os we instead inject the
// document into the MAIN page (scoped to #pi-print-root), mask the app with an
// @media-print stylesheet, and print the top window. iOS/desktop are untouched.
describe('openPrintWindow — Android main-document print (#294/#316)', () => {
  const ANDROID_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>t</title>
    <style>@font-face { font-family: 'Noto Sans'; src: url('/fonts/noto.woff2') format('woff2'); }</style>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Noto Sans', sans-serif; color: #111; padding: 48px; }
      table { width: 100%; border-collapse: collapse; }
      thead th.right { text-align: right; }
      tbody tr:last-child td { border-bottom: none; }
      @media print { @page { margin: 24mm 20mm; } body { padding: 0; } }
    </style></head><body><div class="doc">android-doc-marker</div></body></html>`

  const printRoot = () => document.querySelector('#pi-print-root')
  const printStyle = () => document.querySelector('style[data-pi-print]')
  const printFrame = () => document.querySelector('iframe[title="Print document"]')

  afterEach(() => {
    printRoot()?.remove()
    printStyle()?.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('injects the document into the main page (no print iframe) and returns true', () => {
    const ok = openPrintWindow(ANDROID_HTML, 'android')
    expect(ok).toBe(true)
    expect(printFrame()).toBeNull()                             // NOT the iframe path
    expect(printRoot()).toBeTruthy()
    expect(printRoot().textContent).toContain('android-doc-marker')
  })

  it('injects a print stylesheet that lifts the fonts + @page, scopes layout, and masks the app', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    const css = printStyle().textContent
    expect(css).toContain('@font-face')                          // brand fonts kept (document-level)
    expect(css).toContain('@page')                               // page margins lifted to document level
    expect(css).toContain('24mm 20mm')
    expect(css).toContain('#pi-print-root')                      // layout scoped to the print root
    expect(css).toContain('body>*:not(#pi-print-root)')          // the app is hidden while printing
    expect(css).toMatch(/@media\s+print/)
  })

  it('prints the TOP window (never an iframe) after the font fallback delay', () => {
    vi.useFakeTimers()
    const topPrint = vi.spyOn(window, 'print').mockImplementation(() => {})
    openPrintWindow(ANDROID_HTML, 'android')
    expect(topPrint).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1500)                                 // covers the 250ms fallback and 1.5s font cap
    expect(topPrint).toHaveBeenCalledTimes(1)                    // the `printed` latch keeps it to one
  })

  it('force-loads the brand fonts and waits for them before printing (root is display:none until @media print)', async () => {
    // The print root is display:none until @media print, so the browser would
    // NOT lazily fetch the injected @font-face faces — document.fonts.ready would
    // resolve with nothing pending and we'd print in the fallback face. So the
    // Android path must explicitly document.fonts.load() the brand families.
    const resolvers = []
    const fakeFonts = { load: vi.fn(() => new Promise(r => resolvers.push(r))) }
    Object.defineProperty(document, 'fonts', { value: fakeFonts, configurable: true })
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    try {
      openPrintWindow(ANDROID_HTML, 'android')
      expect(fakeFonts.load).toHaveBeenCalled()            // forced the brand faces to load
      expect(fakeFonts.load.mock.calls.some(c => /Noto Sans/.test(c[0]))).toBe(true)
      expect(printSpy).not.toHaveBeenCalled()              // not yet — still loading the fonts
      resolvers.forEach(r => r())                          // fonts finish loading
      await new Promise(r => setTimeout(r, 0))             // flush the load promises
      expect(printSpy).toHaveBeenCalledTimes(1)            // now it prints
    } finally {
      delete document.fonts
    }
  })

  // The app shell pins `html, body, #root { height: var(--app-h); overflow: hidden;
  // background: <dark> }` (src/index.css). Left alone, that CLIPS the print root to
  // one screen-height — a multi-page invoice silently loses every row past page 1 —
  // and paints the page navy. Verified by real headless-Chrome print-to-PDF: 60 rows
  // truncated to 13 on one page before this rule, 3 full pages after.
  it('releases the app-shell height/overflow lock and whitens html so multi-page documents are not clipped', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    const css = printStyle().textContent
    const printBlock = css.slice(css.search(/@media\s+print/))
    expect(printBlock).toMatch(/html\s*,\s*body/)         // BOTH elements — the lock is on html too
    expect(printBlock).toContain('height:auto!important')
    expect(printBlock).toContain('overflow:visible!important')
    expect(printBlock).toContain('background:#fff!important')
  })

  // Android rasterizes the page LAZILY — the print framework can re-render after
  // window.print() returns and after the app regains focus. Tearing the document
  // down on `focus` (as the iframe path safely does) strips it before rasterization
  // and prints the bare app UI instead. The root is display:none on screen, so
  // leaving it in place costs nothing.
  it('does NOT tear the document down when the app regains focus (Android rasterizes late)', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    window.dispatchEvent(new Event('focus'))
    expect(printRoot()).toBeTruthy()
    expect(printStyle()).toBeTruthy()
  })

  it('cleans up a short while after afterprint', () => {
    vi.useFakeTimers()
    openPrintWindow(ANDROID_HTML, 'android')
    window.dispatchEvent(new Event('afterprint'))
    expect(printRoot()).toBeTruthy()                      // not immediately — rasterization may still be running
    vi.advanceTimersByTime(2000)
    expect(printRoot()).toBeNull()
    expect(printStyle()).toBeNull()
  })
})

// The scoper is the load-bearing piece of the Android path: it rewrites the
// self-contained print template's CSS so it can live in the MAIN document
// without the app's Tailwind Preflight bleeding in — every rule scoped under an
// id (id-specificity out-ranks element/`*` Preflight rules), body → the root,
// and document-level @page lifted out.
describe('scopePrintCss', () => {
  const S = '#pi-print-root'

  it('prefixes a bare element selector with the scope', () => {
    const { scoped } = scopePrintCss('table { width: 100%; }', S)
    expect(scoped).toContain('#pi-print-root table')
    expect(scoped).toContain('width: 100%')
  })

  it('maps the body selector to the scope root itself (not a descendant of it)', () => {
    const { scoped } = scopePrintCss('body { padding: 48px; }', S)
    expect(scoped).toMatch(/#pi-print-root\s*\{/)
    expect(scoped).not.toContain('#pi-print-root body')
  })

  it('maps the universal selector to the root and its descendants', () => {
    const { scoped } = scopePrintCss('* { box-sizing: border-box; }', S)
    expect(scoped).toMatch(/#pi-print-root\s*,\s*#pi-print-root \*/)
  })

  it('prefixes descendant / compound selectors', () => {
    const { scoped } = scopePrintCss('tbody tr:last-child td { border-bottom: none; }', S)
    expect(scoped).toContain('#pi-print-root tbody tr:last-child td')
  })

  it('prefixes each selector in a comma list independently', () => {
    const { scoped } = scopePrintCss('h1, .right { margin: 0; }', S)
    expect(scoped).toContain('#pi-print-root h1')
    expect(scoped).toContain('#pi-print-root .right')
  })

  it('lifts @page out of the @media block into the page bucket and scopes the rest', () => {
    const { scoped, page } = scopePrintCss('@media print { @page { margin: 24mm 20mm; } body { padding: 0; } }', S)
    expect(page).toContain('@page')
    expect(page).toContain('24mm 20mm')
    expect(scoped).not.toContain('@page')
    expect(scoped).toMatch(/@media\s+print/)
    expect(scoped).toMatch(/@media\s+print\s*\{[^}]*#pi-print-root\s*\{[^}]*padding:\s*0/)
  })

  it('leaves no unscoped element rule when run over template-shaped CSS', () => {
    const css = `
      * { box-sizing: border-box; }
      body { color: #111; }
      .header h1 { font-size: 26px; }
      thead th.right { text-align: right; }
      .party.to { text-align: right; }
      @media print { @page { margin: 24mm 20mm; } body { padding: 0; } }`
    const { scoped } = scopePrintCss(css, S)
    // No style-rule selector should start (line-start or after `}`) with a bare
    // element/body — they must all be prefixed with #pi-print-root.
    expect(scoped).not.toMatch(/(?:^|})\s*(?:body|table|thead|tbody|h1)\s*[.{]/m)
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
