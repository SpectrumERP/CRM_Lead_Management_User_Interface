import { useState } from 'react'
import { Button, FormGrid, SearchSelectField, TextField } from '../ui'
import { type Lead, type LeadCurrency } from '../data/leads'
import { MAIN_CURRENCIES, currencyAmountPrefix, currencyLabel, findCurrency, matchesCurrency } from '../data/currencies'
import { formatConversionStamp } from '../data/opportunities'
import FormDrawer from './FormDrawer'

export interface ConvertOpportunityInput {
  dealValue: number
  valueCurrency: LeadCurrency
  closingDate: string
}

export interface ConvertOpportunityDialogProps {
  lead: Lead
  convertedBy: string
  onConfirm: (input: ConvertOpportunityInput) => void
  onCancel: () => void
}

export default function ConvertOpportunityDialog({
  lead,
  convertedBy,
  onConfirm,
  onCancel,
}: ConvertOpportunityDialogProps) {
  const [currency, setCurrency] = useState<LeadCurrency>(lead.valueCurrency ?? 'INR')
  const [value, setValue] = useState(lead.opportunityValue ? String(lead.opportunityValue) : '')
  const [closingDate, setClosingDate] = useState(lead.expectedClosureDate ?? '')
  const [conversionAt] = useState(() => formatConversionStamp(new Date().toISOString()))
  const [error, setError] = useState('')

  function submit() {
    const dealValue = Number(String(value).replace(/[^\d.]/g, ''))
    if (!dealValue || dealValue <= 0) {
      setError('Enter an opportunity value')
      return
    }
    if (!closingDate) {
      setError('Enter an expected closure date')
      return
    }
    onConfirm({ dealValue, valueCurrency: currency, closingDate })
  }

  return (
    <FormDrawer
      title="Create Opportunity"
      subtitle={`Lead ${lead.id} → Convert to Opportunity · ${lead.companyName}`}
      onClose={onCancel}
      zClass="z-[90]"
      widthClass="w-[28rem]"
      icon={
        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={submit}>
            Create Opportunity
          </Button>
        </>
      )}
    >
      <p className="mb-4 text-xs leading-relaxed text-ink-muted">
        This lead will be converted into an opportunity. Reference Lead No will stay linked as{' '}
        <span className="font-mono font-semibold text-primary">{lead.id}</span>.
      </p>

      <FormGrid>
        <SearchSelectField
          label="Currency"
          options={MAIN_CURRENCIES}
          value={findCurrency(currency)}
          onChange={(item) => {
            if (item) setCurrency(item.code)
          }}
          getKey={(item) => item.code}
          getLabel={currencyLabel}
          filterItem={matchesCurrency}
          searchPlaceholder="Search country, code or symbol…"
          emptyText="No currency matches"
          clearable={false}
          preserveOrder
          renderOption={(item) => (
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-8 shrink-0 text-xs font-bold text-primary">{item.symbol}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink">
                  {item.code} — {item.name}
                </span>
                <span className="block truncate text-xs text-ink-faint">{item.countries.join(', ')}</span>
              </span>
            </div>
          )}
        />
        <TextField
          label="Opportunity Value"
          required
          type="number"
          min={0}
          leading={currencyAmountPrefix(currency)}
          value={value}
          onValueChange={setValue}
          placeholder="0"
        />
        <TextField
          fieldClassName="lg:col-span-2"
          label="Expected Closure Date"
          required
          type="date"
          value={closingDate}
          onValueChange={setClosingDate}
        />
        <TextField
          label="Conversion Date"
          value={conversionAt}
          readOnly
          disabled
        />
        <TextField
          label="Converted By"
          value={convertedBy}
          readOnly
          disabled
        />
      </FormGrid>

      {error ? (
        <p className="mt-3 text-xs text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </FormDrawer>
  )
}
