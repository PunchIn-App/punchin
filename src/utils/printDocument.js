// Shared print-document helpers for the invoice and timesheet print/PDF paths.
//
// Why this exists: printouts must render in the brand Noto family (not the OS's
// default system-UI face). A generated print popup is a separate document that
// does NOT inherit the app's stylesheet, so it has to load the webfonts itself
// AND wait for them before calling print() — otherwise the first print can fire
// on the fallback face. Both print paths share this markup + window logic so the
// brand stays in sync — the @font-face rules below point at the self-hosted
// /fonts/*.woff2 (no CDN).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { glyphComponent, DEFAULT_LABOR_COLOR } from '../components/LaborGlyph'
import { withAlpha } from './color'

// Injected into the <head> of every print document: declare the self-hosted Noto
// brand webfonts. The print popup is same-origin (opened from the app), so the
// absolute /fonts/*.woff2 URLs resolve against the app origin — no CDN needed.
export const PRINT_FONT_HEAD = `<style>
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Display'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-display-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-mono-latin-wght-normal.woff2') format('woff2'); }
</style>`

// The brand font families PRINT_FONT_HEAD declares. The Android print path force-
// loads these via document.fonts.load() before printing: its print root is
// display:none until @media print, and a hidden subtree doesn't trigger the
// browser's normal lazy font fetch, so document.fonts.ready alone wouldn't wait
// for them and the first print could fire on the fallback face.
const PRINT_FONT_FAMILIES = ["'Noto Sans'", "'Noto Sans Display'", "'Noto Sans Mono'"]

// Escape HTML special characters in user-provided strings so they are safe to
// inject into a print HTML string. Exported as the single escaper for all print
// paths (the invoice template reuses it) so escaping behaviour can't diverge.
export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// Build the print HTML for a labor-type badge. The design is a neutral pill
// (white surface, 1px light-grey border, near-black name text) carrying a small
// tinted glyph chip — glyph drawn in lt.color on a ~22% tint background. This
// reads in colour AND in black & white (shape identifies the type, not colour
// alone). Used by both the timesheet and invoice print paths.
export function laborBadgeHTML(lt) {
  if (!lt) return '—'
  const color = lt.color || DEFAULT_LABOR_COLOR
  const Glyph = glyphComponent(lt.glyph)
  const svgStr = renderToStaticMarkup(
    createElement(Glyph, { width: 13, height: 13, color, strokeWidth: 2, 'aria-hidden': 'true' })
  )
  // Mirror the on-screen LaborTag chip exactly (LaborGlyph.jsx): an 18px box,
  // ~22% colour fill, ~42% colour border, 5px radius. box-sizing:border-box so
  // the 1px border doesn't grow the box (the app gets border-box from Tailwind).
  const chipStyle = [
    'box-sizing:border-box',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:18px',
    'height:18px',
    `background:${withAlpha(color, '38')}`,
    `border:1px solid ${withAlpha(color, '6B')}`,
    'border-radius:5px',
    'flex-shrink:0',
    'vertical-align:middle',
  ].join(';')
  const pillStyle = [
    'display:inline-flex',
    'align-items:center',
    'gap:4px',
    'padding:2px 6px 2px 3px',
    'border-radius:4px',
    'border:1px solid #d1d5db',
    'background:#ffffff',
    'font-size:11px',
    'font-weight:500',
    'color:#111827',
    'vertical-align:middle',
    'line-height:1.4',
  ].join(';')
  return `<span style="${pillStyle}"><span style="${chipStyle}">${svgStr}</span>${escHtml(lt.name)}</span>`
}

// --- CSS scoping for the Android main-document print path (below) ---------
// Split `str` on top-level occurrences of `sep`, ignoring separators nested in
// () or [] (e.g. commas inside :not(...) or an attribute selector).
function splitTopLevel(str, sep) {
  const out = []
  let depth = 0, last = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === sep && depth === 0) { out.push(str.slice(last, i)); last = i + 1 }
  }
  out.push(str.slice(last))
  return out
}

// Index of the first top-level `char` (outside ()/[]) at/after `from`, else -1.
function indexOfTopLevel(str, char, from) {
  let depth = 0
  for (let i = from; i < str.length; i++) {
    const c = str[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === char && depth === 0) return i
  }
  return -1
}

// Given `str` and the index of an opening `{`, return the brace-balanced body
// (exclusive of the outer braces) and the index just past the closing `}`.
// Balances nested braces so an @media block's inner rules are captured whole.
function readBlock(str, braceIndex) {
  let depth = 0
  for (let i = braceIndex; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') { depth--; if (depth === 0) return { body: str.slice(braceIndex + 1, i), end: i + 1 } }
  }
  return { body: str.slice(braceIndex + 1), end: str.length }
}

// Rewrite a self-contained print template's CSS so it can live in the MAIN
// document without the app's global / Tailwind-Preflight styles bleeding into
// it. Every style-rule selector is scoped under `scope` (an id selector, whose
// id-specificity out-ranks Preflight's element/`*` rules); `body`/`html`/`:root`
// map to the scope root itself; `*` maps to the root AND its descendants; and
// document-level at-rules (@page, @font-face, @keyframes) are lifted OUT into a
// separate `page` bucket because they have no effect when nested under a normal
// selector. @media/@supports blocks are preserved with their inner rules scoped.
// Returns { scoped, page }. Used by the Android print path (openPrintWindow).
export function scopePrintCss(css, scope) {
  const page = []
  const prefixSelectorList = (selText) =>
    splitTopLevel(selText, ',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(sel => {
        if (sel === 'body' || sel === 'html' || sel === ':root') return scope
        if (sel === '*') return `${scope}, ${scope} *`
        // A `body ...` / `html ...` descendant selector: the scope root IS the
        // document root, so drop the leading element and keep the rest.
        const lead = sel.match(/^(body|html|:root)(?=[\s>~+])/)
        if (lead) return `${scope}${sel.slice(lead[1].length)}`
        return `${scope} ${sel}`
      })
      .join(', ')

  const walk = (input, out) => {
    let i = 0
    while (i < input.length) {
      const braceAt = indexOfTopLevel(input, '{', i)
      if (braceAt === -1) break
      const prelude = input.slice(i, braceAt).trim()
      const { body, end } = readBlock(input, braceAt)
      i = end
      if (!prelude) continue
      const at = prelude.toLowerCase()
      if (at.startsWith('@page') || at.startsWith('@font-face') || at.startsWith('@keyframes')) {
        page.push(`${prelude} { ${body.trim()} }`)                 // lift document-level at-rules out
      } else if (at.startsWith('@media') || at.startsWith('@supports')) {
        const inner = []
        walk(body, inner)                                          // recurse; inner @page still lifts to `page`
        out.push(`${prelude} { ${inner.join(' ')} }`)
      } else {
        out.push(`${prefixSelectorList(prelude)} { ${body.trim()} }`)
      }
    }
  }

  const scopedRules = []
  walk(css, scopedRules)
  return { scoped: scopedRules.join('\n'), page: page.join('\n') }
}

// Render the document into a hidden, same-page iframe and print THAT — never a
// popup window. On iOS a print popup (window.open) can't be dismissed back to an
// installed PWA: closing the print/share sheet strands the user on a dead tab they
// have to force-quit. An iframe prints in place — closing the sheet returns to the
// app — and it isn't subject to popup blockers. Being about:blank, it inherits the
// app's base URL, so the document's absolute /fonts/*.woff2 URLs still resolve.
//
// Android is the exception: Android Chrome/WebView cannot print a subframe — its
// print pipeline always serializes the TOP-LEVEL document (chromium #41323115 /
// #40896385) — so on the iframe path it prints the visible app UI instead of the
// document (#294/#316). For os==='android' we take openPrintAndroid() below, which
// injects the document into the MAIN page and prints the top window. iOS/desktop
// (any other os, or none) keep the hidden-iframe path unchanged.
//
// Prints once the brand webfonts have loaded, but never hangs on it: iOS *has*
// document.fonts yet its `ready` promise can stall, so race it against a 1.5s
// safety timeout (a `printed` latch makes the loser a no-op). The iframe is removed
// once the user is done — on `afterprint`, or when the app regains focus after the
// print sheet closes. Returns false (without throwing) only if the frame can't
// initialise, so callers can still alert + offer CSV.
export function openPrintWindow(html, os) {
  if (os === 'android') return openPrintAndroid(html)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.title = 'Print document'
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  if (!win) { iframe.remove(); return false }
  win.document.open()
  win.document.write(html)
  win.document.close()

  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    try { win.focus(); win.print() } catch { /* printing unsupported here — no-op */ }
  }
  // Idempotent cleanup: afterprint (desktop), or the app regaining focus once the
  // iOS print/share sheet is dismissed (afterprint isn't reliable there).
  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe) }
  try { win.addEventListener('afterprint', cleanup) } catch { /* ignore */ }
  window.addEventListener('focus', cleanup, { once: true })

  const fonts = win.document.fonts
  if (fonts && fonts.ready && typeof fonts.ready.then === 'function') {
    fonts.ready.then(doPrint)
    setTimeout(doPrint, 1500)
  } else {
    setTimeout(doPrint, 250)
  }
  return true
}

// Android print path. The document can't be isolated in an iframe (Android prints
// the top document, not the frame — see openPrintWindow), so we inject it into the
// MAIN page instead: the template's @font-face + @page are lifted to a document-
// level <style>, the layout CSS is scoped to #pi-print-root so the app's Tailwind
// Preflight can't bleed in, and an @media-print rule hides the app (every other
// body child) and reveals only the print root while printing. Same-origin, no
// popup — nothing to strand a PWA (and this path is Android-only regardless).
// Returns false (without throwing) if the document can't be parsed, so callers
// keep their CSV fallback. The injected nodes are removed on afterprint / focus.
function openPrintAndroid(html) {
  let doc
  try { doc = new DOMParser().parseFromString(html, 'text/html') } catch { return false }
  if (!doc || !doc.body) return false

  // @font-face blocks are document-level and pass through untouched; the layout
  // block is scoped and its @page lifted out (see scopePrintCss).
  let fontCss = ''
  let layoutCss = ''
  for (const s of doc.querySelectorAll('style')) {
    if (s.textContent.includes('@font-face')) fontCss += `${s.textContent}\n`
    else layoutCss += `${s.textContent}\n`
  }
  const { scoped, page } = scopePrintCss(layoutCss, '#pi-print-root')

  // Clear any leftovers from a prior print whose cleanup hasn't fired yet, so we
  // never leave two #pi-print-root nodes (duplicate id) racing the @media mask.
  document.querySelector('#pi-print-root')?.remove()
  document.querySelector('style[data-pi-print]')?.remove()

  const style = document.createElement('style')
  style.setAttribute('data-pi-print', '')
  style.textContent = [
    fontCss,
    page,                                                   // @page margins (document-level)
    '#pi-print-root{display:none}',                         // never shown on screen — only when printing
    scoped,                                                 // the scoped print layout
    '@media print{',
    'body>*:not(#pi-print-root){display:none!important}',   // hide the app UI
    '#pi-print-root{display:block!important}',              // reveal the document
    'body{background:#fff!important}',                      // no dark app background on paper
    '}',
  ].join('\n')
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'pi-print-root'
  // importNode (not document.write / innerHTML) — nodes are copied inert, so any
  // <script> in the template would not execute (the templates have none; this is
  // strictly safer than the iframe path's document.write).
  for (const node of doc.body.childNodes) root.appendChild(document.importNode(node, true))
  document.body.appendChild(root)

  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    try { window.print() } catch { /* printing unsupported here — no-op */ }
  }
  const cleanup = () => {
    if (root.parentNode) root.parentNode.removeChild(root)
    if (style.parentNode) style.parentNode.removeChild(style)
  }
  try { window.addEventListener('afterprint', cleanup, { once: true }) } catch { /* ignore */ }
  window.addEventListener('focus', cleanup, { once: true })

  // Force-load the brand faces then print — the print root is display:none until
  // @media print, so we can't rely on lazy loading + document.fonts.ready (it'd
  // resolve with nothing pending and print in the fallback face). Capped at 1.5s
  // (a `printed` latch makes the loser a no-op) so a stalled load can't hang.
  const fonts = document.fonts
  if (fonts && typeof fonts.load === 'function') {
    Promise.all(PRINT_FONT_FAMILIES.map(f => fonts.load(`16px ${f}`).catch(() => {}))).then(doPrint)
    setTimeout(doPrint, 1500)
  } else {
    setTimeout(doPrint, 250)
  }
  return true
}
