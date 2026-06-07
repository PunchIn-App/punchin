import { describe, it, expect } from 'vitest'
import { formatMoney, currencySymbol } from './format'

describe('formatMoney', () => {
  it('formats USD by default', () => {
    expect(formatMoney(12.5)).toContain('12.50')
    expect(formatMoney(12.5)).toContain('$')
  })

  it('formats other ISO currencies via Intl', () => {
    expect(formatMoney(12.5, 'EUR')).toMatch(/12[.,]50/)
  })

  it('returns an empty string for null / NaN amounts', () => {
    expect(formatMoney(null)).toBe('')
    expect(formatMoney(undefined)).toBe('')
    expect(formatMoney('not a number')).toBe('')
  })

  it('falls back without throwing on an invalid/empty currency code', () => {
    expect(() => formatMoney(12.5, 'NOTACODE')).not.toThrow()
    expect(formatMoney(12.5, '')).toContain('12.50')
  })
})

describe('currencySymbol', () => {
  it('returns a symbol for a valid code', () => {
    expect(currencySymbol('USD')).toContain('$')
  })

  it('does not throw on an invalid code', () => {
    expect(() => currencySymbol('XXX-bad')).not.toThrow()
  })
})
