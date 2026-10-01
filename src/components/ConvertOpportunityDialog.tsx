import { useEffect, useState } from 'react'
import { Button, FormGrid, TextField } from '../ui'
import { type Lead, type LeadCurrency } from '../data/leads'
import { formatConversionStamp } from '../data/opportunities'
import { guessIsoCurrency } from '../api/fillValues'
import CurrencyAmountField from './CurrencyAmountField'
import FormDrawer from './FormDrawer'
import { useOpportunityFillValues } from './useOpportunityFillValues'
import { useConfirm } from '../contexts/ConfirmContext'

export interface ConvertOpportunityInput {
  dealValue: number
  /** ISO code for in-app display; the server gets `currencyNo`. */
  valueCurrency: LeadCurrency
  /** Server currency picked in the dialog. */
  currencyNo?: number
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
  const confirm = useConfirm()
  // Server currencies only (opportunity fill values); starts on the lead's currency.
  const { values: oppFill } = useOpportunityFillValues()
  const currencies = oppFill?.currencies ?? []
  const [currencyNo, setCurrencyNo] = useState<number | undefined>(lead.spectrum?.currencyNo)
  useEffect(() => {
    if (!currencyNo && currencies[0]) setCurrencyNo(currencies[0].currencyNo)
  }, [currencies, currencyNo])
  const [value, setValue] = useState(lead.opportunityValue ? String(lead.opportunityValue) : '')
  const [closingDate, setClosingDate] = useState(lead.expectedClosureDate ?? '')
  const [conversionAt] = useState(() => formatConversionStamp(new Date().toISOString()))
  const [error, setError] = useState('')

  async function submit() {
    const dealValue = Number(String(value).replace(/[^\d.]/g, ''))
    if (!dealValue || dealValue <= 0) {
      setError('Enter an opportunity value')
      return
    }
    if (!closingDate) {
      setError('Enter an expected closure date')
      return
    }
    const picked = currencies.find((c) => c.currencyNo === currencyNo)
    if (!picked) {
      setError('Select a currency')
      return
    }
    if (!(await confirm({ title: 'Convert to Opportunity', message: `Convert "${lead.leadName || lead.companyName}" to an opportunity?`, confirmLabel: 'Convert' }))) return
    onConfirm({
      dealValue,
      valueCurrency: guessIsoCurrency({ currencyName: picked.currencyName, symbol: picked.symbol ?? '' }),
      currencyNo: picked.currencyNo,
      closingDate,
    })
  }

  return (
    <FormDrawer
      title="Create Opportunity"
      subtitle={`Lead ${lead.spectrum?.code ?? lead.id} → Convert to Opportunity · ${lead.companyName}`}
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
        <span className="font-mono font-semibold text-primary">{lead.spectrum?.code ?? lead.id}</span>.
      </p>

      <FormGrid>
        <div className="lg:col-span-2">
          <CurrencyAmountField
            label="Opportunity Value"
            required
            amount={value}
            onAmountChange={setValue}
            currencies={currencies}
            currencyNo={currencyNo}
            onCurrencyNoChange={setCurrencyNo}
          />
        </div>
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
