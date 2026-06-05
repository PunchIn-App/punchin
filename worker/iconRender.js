import { Resvg, initWasm } from '@resvg/resvg-wasm'
import wasm from '@resvg/resvg-wasm/index_bg.wasm'
import { iconSvg } from '../src/iconSvg.js'

// On-demand SVG→PNG rendering of the brand mark for the accent install icon
// (issue #228). Cloudflare Workers can't use sharp/canvas, so this uses the
// resvg WASM renderer. The wasm is bundled by wrangler (`import … .wasm`) and
// initialised once per isolate; the init promise is cached so concurrent
// requests share a single initialisation.
//
// Isolated in its own module so the worker's unit tests can mock it (and never
// load the wasm under vitest); the live worker imports it statically.
let initPromise
function ensureInit() {
  if (!initPromise) initPromise = initWasm(wasm)
  return initPromise
}

/**
 * Render the mark in `hex` (6 hex chars, no '#') at `size` px to a PNG.
 * `maskable` renders the full-bleed safe-zone variant for Android adaptive icons.
 * @returns {Promise<Uint8Array>}
 */
export async function renderIconPng(hex, size, { maskable = false } = {}) {
  await ensureInit()
  const svg = iconSvg(size, `#${hex}`, maskable ? { pad: 0, radius: 0 } : {})
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return resvg.render().asPng()
}
