// Shared print-document helpers for the invoice and timesheet print/PDF paths.
//
// Why this exists: printouts must render in the brand Noto family (not the OS's
// default system-UI face). A generated print popup is a separate document that
// does NOT inherit the app's stylesheet, so it has to load the webfonts itself
// AND wait for them before calling print() — otherwise the first print can fire
// on the fallback face. Both print paths share this markup + window logic so the
// brand stays in sync (and so self-hosting the fonts later is a one-file change).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { glyphComponent, DEFAULT_LABOR_COLOR } from '../components/LaborGlyph'

// Injected into the <head> of every print document: declare the self-hosted Noto
// brand webfonts. The print popup is same-origin (opened from the app), so the
// absolute /fonts/*.woff2 URLs resolve against the app origin — no CDN needed.
export const PRINT_FONT_HEAD = `<style>
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Display'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-display-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-mono-latin-wght-normal.woff2') format('woff2'); }
</style>`

// Escape HTML special characters in user-provided strings so they are safe to
// inject into a print HTML string.
function escHtml(s) {
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
  const chipStyle = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:18px',
    'height:18px',
    `background:${color}38`,
    'border-radius:3px',
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

// Open a print window, write the document, and print once the brand webfonts
// have loaded. Falls back to a short fixed delay where document.fonts is absent
// (older browsers / jsdom in tests). Returns false — without throwing — when the
// popup is blocked (window.open → null) so callers can alert + offer CSV.
export function openPrintWindow(html, { width = 800, height = 600 } = {}) {
  const w = window.open('', '_blank', `width=${width},height=${height}`)
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  const fonts = w.document.fonts
  if (fonts && fonts.ready && typeof fonts.ready.then === 'function') {
    fonts.ready.then(() => w.print())
  } else {
    setTimeout(() => w.print(), 250)
  }
  return true
}
