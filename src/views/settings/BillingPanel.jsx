import { useRef } from 'react'
import { DollarSign, Hash, Image as ImageIcon } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { fileToLogoDataUrl } from '../../utils/image'
import EntitySelect from '../../components/EntitySelect'
import { Panel, SettingsRow, Toggle } from './components'

const inputCls =
  'w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-sm placeholder-appTextDisabled focus:outline-none focus:ring-2 focus:ring-appAccent/50 transition-colors'
const labelCls = 'font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-appTextMuted'

// A reasonable shortlist; users can also store any ISO 4217 code another way.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'MXN', 'SEK', 'NZD', 'ZAR', 'SGD']
const CURRENCY_OPTIONS = CURRENCIES.map(c => ({ value: c, label: c }))

function Field({ id, label, value, onChange, type = 'text', placeholder, multiline }) {
  const props = { id, value: value ?? '', onChange: e => onChange(e.target.value), placeholder, className: inputCls }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelCls}>{label}</label>
      {multiline ? <textarea rows={2} {...props} /> : <input type={type} {...props} />}
    </div>
  )
}

export default function BillingPanel({ onBack }) {
  const { settings, updateSetting } = useSettings()
  const set = k => v => updateSetting(k, v)
  const logoInputRef = useRef(null)

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (file) updateSetting('billingLogo', await fileToLogoDataUrl(file))
  }

  return (
    <Panel title="Billing" onBack={onBack}>
      {/* Billed from — the invoice sender identity */}
      <div className="rounded-xl border border-appBorder bg-appCard p-4 space-y-3">
        <p className={labelCls}>Billed from</p>
        <p className="text-xs text-appTextMuted -mt-1">Appears on the invoice printout. All optional.</p>

        {/* Logo */}
        <div className="flex items-center gap-3">
          {settings.billingLogo ? (
            <img src={settings.billingLogo} alt="Business logo" className="w-14 h-14 rounded-lg object-contain bg-appBg border border-appBorder flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg border border-dashed border-appBorder grid place-items-center text-appTextMuted flex-shrink-0">
              <ImageIcon className="w-5 h-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-appText">Logo</p>
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => logoInputRef.current?.click()} className="text-xs text-appAccent hover:underline">
                {settings.billingLogo ? 'Replace' : 'Upload'}
              </button>
              {settings.billingLogo && (
                <button type="button" onClick={() => updateSetting('billingLogo', '')} className="text-xs text-appTextMuted hover:text-red-400 transition-colors">Remove</button>
              )}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" aria-label="Upload business logo" onChange={onLogoFile} />
        </div>

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
            <div className="w-32 flex-shrink-0">
              <EntitySelect
                compact plain hideLabel
                label="Default currency"
                value={settings.defaultCurrency || 'USD'}
                onChange={v => updateSetting('defaultCurrency', v)}
                options={CURRENCY_OPTIONS}
              />
            </div>
          }
        />
      </div>

      {/* Invoice numbering (display-only) */}
      <div className="rounded-xl border border-appBorder bg-appCard">
        <SettingsRow
          icon={Hash}
          title="Number invoices"
          subtitle="Print an invoice number; it advances each time you generate one"
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
              <label htmlFor="invoice-prefix" className={labelCls}>Prefix</label>
              <input id="invoice-prefix" value={settings.invoicePrefix ?? ''} onChange={e => updateSetting('invoicePrefix', e.target.value)} placeholder="PI-" className={inputCls} />
            </div>
            <div className="space-y-1 w-28">
              <label htmlFor="invoice-next" className={labelCls}>Next number</label>
              <input id="invoice-next" type="number" min="1" value={settings.nextInvoiceNumber ?? 1} onChange={e => updateSetting('nextInvoiceNumber', Number(e.target.value) || 1)} className={inputCls} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
