// Money formatting for invoices and exports. Uses Intl.NumberFormat with the
// user's defaultCurrency (ISO 4217). The currency code is user-editable, so guard
// against an empty/invalid code (Intl throws RangeError) with a plain fallback.

export function formatMoney(amount, currency = 'USD') {
  if (amount == null || Number.isNaN(Number(amount))) return ''
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    const n = Number(amount).toFixed(2)
    return currency ? `${currency} ${n}` : `$${n}`
  }
}

// The currency symbol alone (e.g. for CSV column headers like "Rate ($/hr)").
export function currencySymbol(currency = 'USD') {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0)
    return parts.find(p => p.type === 'currency')?.value || currency
  } catch {
    return currency || '$'
  }
}
