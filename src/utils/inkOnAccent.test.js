import { describe, it, expect } from 'vitest'
import { readableInk, DARK_INK } from './inkOnAccent'

describe('readableInk', () => {
  it('returns white on dark/saturated accents (so the mark glyph reads)', () => {
    expect(readableInk('#2D5BF5')).toBe('#FFFFFF') // PunchIn Blue (default, dark theme)
    expect(readableInk('#2348DB')).toBe('#FFFFFF') // PunchIn Blue (light theme)
    expect(readableInk('#7C5CFF')).toBe('#FFFFFF') // violet
    expect(readableInk('#000000')).toBe('#FFFFFF')
  })

  it('flips to dark ink on light/pastel accents (white would wash out)', () => {
    expect(readableInk('#FFD66B')).toBe(DARK_INK) // light yellow
    expect(readableInk('#9FE5C5')).toBe(DARK_INK) // mint
    expect(readableInk('#FFB163')).toBe(DARK_INK) // pastel orange
    expect(readableInk('#E6C84B')).toBe(DARK_INK) // pastel yellow
    expect(readableInk('#FFFFFF')).toBe(DARK_INK)
  })

  it('DARK_INK is the app on-accent ink #0F1117', () => {
    expect(DARK_INK).toBe('#0F1117')
  })

  it('tolerates a missing # and mixed case', () => {
    expect(readableInk('2d5bf5')).toBe('#FFFFFF')
    expect(readableInk('#ffd66b')).toBe(DARK_INK)
  })

  // --on-accent styles normal-size button TEXT, so App.jsx passes minRatio 4.5;
  // the brand renderers keep the default 3:1 graphic threshold.
  describe('minRatio (text on the accent → 4.5:1)', () => {
    it('keeps white when white clears the higher text threshold', () => {
      expect(readableInk('#2D5BF5', 4.5)).toBe('#FFFFFF') // ~5.35:1
    })

    it('flips mid-contrast accents (pass 3:1, fail 4.5:1) from white to dark ink', () => {
      expect(readableInk('#0EA66B')).toBe('#FFFFFF')     // ~3.14:1 — fine for the graphic mark
      expect(readableInk('#0EA66B', 4.5)).toBe(DARK_INK) // ...but dark ink for text
      expect(readableInk('#E5484D', 4.5)).toBe(DARK_INK) // ~3.91:1
    })

    it('defaults to the 3:1 graphic threshold when minRatio is omitted', () => {
      expect(readableInk('#0EA66B')).toBe(readableInk('#0EA66B', 3))
    })
  })
})
