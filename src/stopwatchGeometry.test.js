import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { STOPWATCH_ELEMENTS } from './stopwatchGeometry'
import { iconSvg } from './iconSvg'
import { PunchGlyph } from './components/BrandMark'

// The point of stopwatchGeometry.js is that the SVG-string renderer (iconSvg.js →
// build PNGs + the Worker) and the React renderer (BrandMark.jsx) can't drift.
// These lock both to the shared STOPWATCH_ELEMENTS source.
const dPaths = STOPWATCH_ELEMENTS.filter(e => e.d).map(e => e.d)
const circles = STOPWATCH_ELEMENTS.filter(e => !e.d)

describe('stopwatch geometry — shared by both renderers', () => {
  it('holds the 4 stroked paths + body circle + a single filled centre dot', () => {
    expect(dPaths).toHaveLength(4)
    expect(circles).toHaveLength(2)
    expect(circles.filter(c => c.fill)).toHaveLength(1)
  })

  it('iconSvg (SVG-string renderer) draws every shared element', () => {
    const svg = iconSvg(64, '#2D5BF5') // white ink on this accent
    for (const d of dPaths) expect(svg).toContain(`<path d="${d}"/>`)
    expect(svg).toContain('<circle cx="12" cy="13.4" r="8.2"/>')   // body (stroked)
    expect(svg).toContain('r="0.9" fill="#FFFFFF" stroke="none"')  // dot filled in ink
  })

  it('PunchGlyph (React renderer) draws the same elements from the shared source', () => {
    const html = renderToStaticMarkup(createElement(PunchGlyph))
    expect(html.match(/<path /g) || []).toHaveLength(4)
    expect(html.match(/<circle /g) || []).toHaveLength(2)
    for (const d of dPaths) expect(html).toContain(`d="${d}"`)
    expect(html).toContain('fill="currentColor"') // the centre dot
  })
})
