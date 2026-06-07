// Shared print-document helpers for the invoice and timesheet print/PDF paths.
//
// Why this exists: printouts must render in the brand Noto family (not the OS's
// default system-UI face). A generated print popup is a separate document that
// does NOT inherit the app's stylesheet, so it has to load the webfonts itself
// AND wait for them before calling print() — otherwise the first print can fire
// on the fallback face. Both print paths share this markup + window logic so the
// brand stays in sync (and so self-hosting the fonts later is a one-file change).

// Injected into the <head> of every print document: declare the self-hosted Noto
// brand webfonts. The print popup is same-origin (opened from the app), so the
// absolute /fonts/*.woff2 URLs resolve against the app origin — no CDN needed.
export const PRINT_FONT_HEAD = `<style>
@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Display'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-display-latin-wght-normal.woff2') format('woff2'); }
@font-face { font-family: 'Noto Sans Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('/fonts/noto-sans-mono-latin-wght-normal.woff2') format('woff2'); }
</style>`

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
