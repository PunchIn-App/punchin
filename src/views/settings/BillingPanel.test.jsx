import { render, screen, fireEvent } from '@testing-library/react'
import BillingPanel from './BillingPanel'

const h = vi.hoisted(() => ({ settings: {}, updateSetting: vi.fn() }))
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: h.settings, updateSetting: h.updateSetting }),
}))

beforeEach(() => { h.updateSetting.mockClear(); h.settings = { numberInvoices: false } })

it('edits a billing-profile field', () => {
  render(<BillingPanel onBack={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Jane' } })
  expect(h.updateSetting).toHaveBeenCalledWith('billingName', 'Jane')
})

it('changes the default currency', () => {
  render(<BillingPanel onBack={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Default currency'), { target: { value: 'EUR' } })
  expect(h.updateSetting).toHaveBeenCalledWith('defaultCurrency', 'EUR')
})

it('reveals the prefix / next-number inputs only when numbering is on', () => {
  h.settings = { numberInvoices: false }
  const { rerender } = render(<BillingPanel onBack={vi.fn()} />)
  expect(screen.queryByLabelText('Prefix')).toBeNull()
  h.settings = { numberInvoices: true }
  rerender(<BillingPanel onBack={vi.fn()} />)
  expect(screen.getByLabelText('Prefix')).toBeInTheDocument()
  expect(screen.getByLabelText('Next number')).toBeInTheDocument()
})

it('toggling "Number invoices" updates the setting', () => {
  render(<BillingPanel onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('switch', { name: /number invoices/i }))
  expect(h.updateSetting).toHaveBeenCalledWith('numberInvoices', true)
})

it('shows the logo preview + Remove when a logo is set, and clears it on Remove', () => {
  h.settings = { numberInvoices: false, billingLogo: 'data:image/png;base64,LOGO' }
  render(<BillingPanel onBack={vi.fn()} />)
  expect(screen.getByAltText('Business logo')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(h.updateSetting).toHaveBeenCalledWith('billingLogo', '')
})

it('shows Upload (no preview) when no logo is set', () => {
  h.settings = { numberInvoices: false }
  render(<BillingPanel onBack={vi.fn()} />)
  expect(screen.queryByAltText('Business logo')).toBeNull()
  expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
})
