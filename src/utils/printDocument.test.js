import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    document.documentElement.classList.remove('pi-print-armed')   // armed for the life of the page in real use
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

  it('injects a print stylesheet that lifts the fonts + @page and scopes the layout', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    const css = printStyle().textContent
    expect(css).toContain('@font-face')                          // brand fonts kept (document-level)
    expect(css).toContain('@page')                               // page margins lifted to document level
    expect(css).toContain('24mm 20mm')
    expect(css).toContain('#pi-print-root')                      // layout scoped to the print root
  })

  // The mask deliberately does NOT ship in this removable node — see the sticky
  // mask tests below. Injecting a duplicate here would resurrect the failure mode
  // it exists to prevent, by making a removable copy authoritative again.
  it('does NOT carry the app mask in the removable injected stylesheet', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    const css = printStyle().textContent
    expect(css).not.toContain('body>*:not(#pi-print-root)')
    expect(css).not.toContain('height:auto!important')
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

  it('arms the shipped mask by adding pi-print-armed to <html>', () => {
    expect(document.documentElement.classList.contains('pi-print-armed')).toBe(false)
    openPrintWindow(ANDROID_HTML, 'android')
    expect(document.documentElement.classList.contains('pi-print-armed')).toBe(true)
  })

  // Android rasterizes LAZILY and REPEATEDLY — PrintDocumentAdapter.onLayout /
  // onWrite fire long after print() returns, and again whenever the user changes a
  // print setting. So no print-lifecycle event marks a safe teardown point. Both
  // shipped fixes tore the document down on such an event (v0.34.1 on `focus`,
  // v0.34.2 on `afterprint`+1s) and both printed the bare app UI (#294/#316).
  // Nothing may remove the document, the stylesheet, or the armed class during a
  // print — the stale-node guard on the NEXT print is the only cleanup.
  it('never tears the document down on focus, afterprint, or any timer', () => {
    vi.useFakeTimers()
    openPrintWindow(ANDROID_HTML, 'android')

    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('afterprint'))
    vi.advanceTimersByTime(600000)                        // 10 minutes — well past any old backstop

    expect(printRoot()).toBeTruthy()
    expect(printStyle()).toBeTruthy()
    expect(document.documentElement.classList.contains('pi-print-armed')).toBe(true)
  })

  // Leaving the nodes in place makes the NEXT print responsible for clearing them,
  // so a second print must not end up with two #pi-print-root nodes (a duplicate id
  // would leave the mask revealing a stale document alongside the new one).
  it('replaces the previous document on a second print rather than duplicating it', () => {
    openPrintWindow(ANDROID_HTML, 'android')
    openPrintWindow(ANDROID_HTML.replace('android-doc-marker', 'second-doc-marker'), 'android')
    expect(document.querySelectorAll('#pi-print-root')).toHaveLength(1)
    expect(document.querySelectorAll('style[data-pi-print]')).toHaveLength(1)
    expect(printRoot().textContent).toContain('second-doc-marker')
    expect(printRoot().textContent).not.toContain('android-doc-marker')
  })
})

// The mask must ship in the app's own stylesheet, not in the runtime-injected
// <style>, because the injected node is removable and this one is not. These
// assertions are the regression guard for the twice-shipped failure: if someone
// moves these rules back into printDocument.js, the bug returns.
describe('sticky print mask in src/index.css (#294/#316)', () => {
  // jsdom's http base URL breaks `new URL(..., import.meta.url)`, so resolve
  // on-disk paths from import.meta.dirname instead.
  const css = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8')

  it('keeps the print root hidden on screen independently of the injected style', () => {
    expect(css).toMatch(/#pi-print-root\s*\{\s*display:\s*none/)
  })

  it('hides the app and reveals the document under @media print, gated on the armed class', () => {
    const printBlock = css.slice(css.indexOf('@media print'))
    expect(printBlock).toMatch(/html\.pi-print-armed body\s*>\s*\*:not\(#pi-print-root\)\s*\{\s*display:\s*none\s*!important/)
    expect(printBlock).toMatch(/html\.pi-print-armed #pi-print-root\s*\{\s*display:\s*block\s*!important/)
  })

  // The app shell pins html/body/#root to `height: var(--app-h); overflow: hidden`.
  // Left alone that clips the document to one screen-height (a 60-row invoice
  // truncated to 13 rows on one page, verified by headless-Chrome print-to-PDF)
  // and paints the sheet navy. html carries the background that reaches the page box.
  it('releases the app-shell height/overflow lock on BOTH html and body', () => {
    const printBlock = css.slice(css.indexOf('@media print'))
    expect(printBlock).toMatch(/html\.pi-print-armed,\s*\n?\s*html\.pi-print-armed body/)
    expect(printBlock).toMatch(/height:\s*auto\s*!important/)
    expect(printBlock).toMatch(/overflow:\s*visible\s*!important/)
    expect(printBlock).toMatch(/background:\s*#fff\s*!important/)
  })

  // Gating on the class is what keeps iOS/desktop — which print correctly through
  // the hidden iframe — completely untouched by the Android workaround.
  it('gates every mask rule on the armed class so non-Android printing is unaffected', () => {
    const printBlock = css.slice(css.indexOf('@media print'))
    const rules = printBlock.split('\n').filter(l => l.includes('!important'))
    expect(rules.length).toBeGreaterThan(0)
    for (const line of printBlock.split('\n')) {
      if (line.includes('#pi-print-root') || line.includes('!important')) continue
      expect(line).not.toMatch(/^\s*(html|body)\s*[,{]/)   // no ungated html/body rule
    }
  })
})

// Provenance footer (opt-in). Two device tests came back unreadable because a
// printout carries no evidence of which build produced it.
describe('print diagnostics footer', () => {
  const HTML = '<html><body><div>doc</div></body></html>'
  const diag = () => document.querySelector('[data-pi-print-diagnostics]')

  afterEach(() => {
    document.querySelector('#pi-print-root')?.remove()
    document.querySelector('style[data-pi-print]')?.remove()
    document.documentElement.classList.remove('pi-print-armed')
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('is absent by default, so nothing leaks onto a client invoice', () => {
    openPrintWindow(HTML, 'android')
    expect(diag()).toBeNull()
    openPrintWindow(HTML, 'android', { diagnostics: false })
    expect(diag()).toBeNull()
  })

  it('stamps the app version into the printed page when enabled', () => {
    openPrintWindow(HTML, 'android', { diagnostics: true })
    expect(diag()).toBeTruthy()
    expect(diag().textContent).toContain(`v${__APP_VERSION__}`)
    expect(document.querySelector('#pi-print-root').contains(diag())).toBe(true)
  })

  // The value frozen on the paper is the moment Android actually sampled the DOM —
  // the number that would have settled the lazy-rasterization question outright.
  it('carries a rasterization clock that keeps ticking after print() returns', () => {
    vi.useFakeTimers()
    openPrintWindow(HTML, 'android', { diagnostics: true })
    expect(diag().textContent).toMatch(/rasterized T\+\d+ms/)
    vi.advanceTimersByTime(5000)
    expect(diag().textContent).toMatch(/rasterized T\+[1-9]\d{2,}ms/)   // advanced, not stuck at 0
  })

  it('records the print events that fired, and when', () => {
    vi.useFakeTimers()
    openPrintWindow(HTML, 'android', { diagnostics: true })
    window.dispatchEvent(new Event('beforeprint'))
    window.dispatchEvent(new Event('afterprint'))
    expect(diag().textContent).toMatch(/beforeprint T\+\d+ms/)
    expect(diag().textContent).toMatch(/afterprint T\+\d+ms/)
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
