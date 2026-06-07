import { DollarSign, Hash } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { Panel, SettingsRow, Toggle } from './components'

const inputCls =
  'w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm placeholder-appTextDisabled focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors'
const selectClass =
  'bg-appInput border border-appBorder text-appText rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

// A reasonable shortlist; users can also store any ISO 4217 code another way.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'MXN', 'SEK', 'NZD', 'ZAR', 'SGD']

function Field({ id, label, value, onChange, type = 'text', placeholder, multiline }) {
  const props = { id, value: value ?? '', onChange: e => onChange(e.target.value), placeholder, className: inputCls }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">{label}</label>
      {multiline ? <textarea rows={2} {...props} /> : <input type={type} {...props} />}
    </div>
  )
}

export default function BillingPanel({ onBack }) {
  const { settings, updateSetting } = useSettings()
  const set = k => v => updateSetting(k, v)

  return (
    <Panel title="Billing" onBack={onBack}>
      {/* Billed from — the invoice sender identity */}
      <div className="rounded-xl border border-appBorder bg-appCard p-4 space-y-3">
        <p className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Billed from</p>
        <p className="text-xs text-appTextMuted -mt-1">Appears on the invoice printout. All optional.</p>
        <Field id="billing-name"     label="Your name"     value={settings.billingName}         onChange={set('billingName')}         placeholder="Jane Doe" />
        <Field id="billing-business" label="Business"      value={settings.billingBusiness}     onChange={set('billingBusiness')}     placeholder="Optional" />
        <Field id="billing-email"    label="Email"   type="email" value={settings.billingEmail} onChange={set('billingEmail')}        placeholder="you@example.com" />
        <Field id="billing-phone"    label="Phone"   type="tel"   value={settings.billingPhone} onChange={set('billingPhone')} />
        <Field id="billing-address"  label="Address"      value={settings.billingAddress}      onChange={set('billingAddress')}      multiline />
        <Field id="billing-terms"    label="Payment terms" value={settings.billingPaymentTerms} onChange={set('billingPaymentTerms')} placeholder="e.g. Net 30" />
        <Field id="billing-notes"    label="Notes"        value={settings.billingNotes}        onChange={set('billingNotes')}        multiline placeholder="Payment instructions, etc." />
      </div>

      {/* Currency */}
      <div className="rounded-xl border border-appBorder bg-appCard">
        <SettingsRow
          icon={DollarSign}
          title="Currency"
          subtitle="Used for invoice & CSV amounts"
          right={
            <select
              aria-label="Default currency"
              value={settings.defaultCurrency || 'USD'}
              onChange={e => updateSetting('defaultCurrency', e.target.value)}
              className={selectClass}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          }
        />
      </div>

      {/* Invoice numbering (display-only) */}
      <div className="rounded-xl border border-appBorder bg-appCard">
        <SettingsRow
          icon={Hash}
          title="Number invoices"
          subtitle="Show an invoice number on the printout"
          right={
            <Toggle
              ariaLabel="Number invoices"
              value={!!settings.numberInvoices}
              onChange={set('numberInvoices')}
            />
          }
        />
        {settings.numberInvoices && (
          <div className="px-4 pb-4 pt-3 flex items-end gap-3 border-t border-appBorderLight">
            <div className="space-y-1 flex-1">
              <label htmlFor="invoice-prefix" className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Prefix</label>
              <input id="invoice-prefix" value={settings.invoicePrefix ?? ''} onChange={e => updateSetting('invoicePrefix', e.target.value)} placeholder="PI-" className={inputCls} />
            </div>
            <div className="space-y-1 w-28">
              <label htmlFor="invoice-next" className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest">Next number</label>
              <input id="invoice-next" type="number" min="1" value={settings.nextInvoiceNumber ?? 1} onChange={e => updateSetting('nextInvoiceNumber', Number(e.target.value) || 1)} className={inputCls} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
