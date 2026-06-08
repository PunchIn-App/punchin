import { describe, it, expect } from 'vitest'
import { normalizeHex, hexToRgb, withAlpha } from './color'

describe('color helpers', () => {
  describe('normalizeHex', () => {
    it('passes a valid 6-digit hex through unchanged (case preserved)', () => {
      expect(normalizeHex('#2D5BF5')).toBe('#2D5BF5')
      expect(normalizeHex('#6366f1')).toBe('#6366f1')
    })
    it('adds a missing leading #', () => {
      expect(normalizeHex('2D5BF5')).toBe('#2D5BF5')
    })
    it('expands 3-digit shorthand to 6-digit', () => {
      expect(normalizeHex('#abc')).toBe('#aabbcc')
      expect(normalizeHex('f0a')).toBe('#ff00aa')
    })
    it('falls back on invalid input (default black, or the given fallback)', () => {
      expect(normalizeHex('rgb(1,2,3)')).toBe('#000000')
      expect(normalizeHex('', '#9B8CFF')).toBe('#9B8CFF')
      expect(normalizeHex(null, '#9B8CFF')).toBe('#9B8CFF')
      expect(normalizeHex(undefined)).toBe('#000000')
    })
  })

  describe('hexToRgb', () => {
    it('converts a 6-digit hex to space-separated rgb', () => {
      expect(hexToRgb('#2D5BF5')).toBe('45 91 245')
      expect(hexToRgb('#000000')).toBe('0 0 0')
      expect(hexToRgb('#FFFFFF')).toBe('255 255 255')
    })
    it('handles 3-digit + missing # via normalize', () => {
      expect(hexToRgb('#fff')).toBe('255 255 255')
      expect(hexToRgb('2D5BF5')).toBe('45 91 245')
    })
    it('never returns NaN for a short/invalid value', () => {
      expect(hexToRgb('#abc')).not.toContain('NaN')
      expect(hexToRgb('bogus')).toBe('0 0 0')
    })
  })

  describe('withAlpha', () => {
    it('appends the alpha hex to a normalized base (#rrggbbaa)', () => {
      expect(withAlpha('#6366F1', '38')).toBe('#6366F138')
      expect(withAlpha('#abc', '6B')).toBe('#aabbcc6B')
    })
  })
})
