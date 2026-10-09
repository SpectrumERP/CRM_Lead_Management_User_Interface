import { useMemo } from 'react'
import { TableSearchSelect, TextInput, type TableSearchColumn } from '../ui'
import { clampMoneyInput } from '../constants/fieldLimits'

/** Server currency row (fill values). */
export interface ServerCurrency {
  currencyNo: number
  currencyCode?: string
  currencyName: string
  symbol?: string
}

const COLUMNS: TableSearchColumn<ServerCurrency>[] = [
  { header: 'Code', getValue: (c) => c.currencyCode || '', width: '6.5rem' },
  { header: 'Currency', getValue: (c) => c.currencyName, truncate: true },
  { header: 'Symbol', getValue: (c) => c.symbol || '', width: '4.5rem' },
]

export interface CurrencyAmountFieldProps {
  label: string
  required?: boolean
  error?: string
  amount: string
  onAmountChange: (value: string) => void
  /** Server currencies (fill values); empty until they load. */
  currencies: readonly ServerCurrency[]
  currencyNo?: number
  onCurrencyNoChange: (no: number) => void
  placeholder?: string
  /** Hide the visible label (e.g. inside a detail cell that already shows it). */
  hideLabel?: boolean
}

/**
 * Currency + amount as one field (currency | ₹ amount, split by a divider). The currency is a searchable
 * table lookup (Code | Currency | Symbol) of the server currencies.
 */
export default function CurrencyAmountField({
  label,
  required,
  error,
  amount,
  onAmountChange,
  currencies,
  currencyNo,
  onCurrencyNoChange,
  placeholder = '0',
  hideLabel,
}: CurrencyAmountFieldProps) {
  const selected = currencies.find((c) => c.currencyNo === currencyNo) ?? null
  // In code order (CM0001, CM0002, …), then by name for currencies without a code.
  const sorted = useMemo(
    () =>
      [...currencies].sort(
        (a, b) =>
          (a.currencyCode ?? '').localeCompare(b.currencyCode ?? '', undefined, { numeric: true, sensitivity: 'base' }) ||
          a.currencyName.localeCompare(b.currencyName, undefined, { sensitivity: 'base' }),
      ),
    [currencies],
  )

  return (
    <div role="group" aria-label={label}>
      {hideLabel ? null : (
        <p className="form-label">
          {label} {required ? <span className="form-required">*</span> : null}
        </p>
      )}
      <div className={`form-input-combo${error ? ' error' : ''}`}>
        <div className="form-input-combo-picker">
          <TableSearchSelect
            aria-label="Currency"
            options={sorted}
            value={selected}
            onChange={(c) => { if (c) onCurrencyNoChange(c.currencyNo) }}
            getKey={(c) => String(c.currencyNo)}
            getLabel={(c) => c.currencyName}
            filterItem={(c, q) => `${c.currencyCode ?? ''} ${c.currencyName} ${c.symbol ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())}
            columns={COLUMNS}
            // Wider than the small currency box beside the amount, so Code, Currency and Symbol all show.
            menuWidth={380}
            placeholder="Currency"
            searchPlaceholder="Search currency"
            emptyText="No currencies"
            clearable={false}
            disabled={currencies.length === 0}
          />
        </div>
        <span className="form-input-combo-divider" aria-hidden />
        <div className="form-input-combo-amount">
          <TextInput
            aria-label={`${label} amount`}
            type="number"
            min={0}
            leading={selected?.symbol || ''}
            value={amount}
            // `money` column: at most 15 whole digits and 2 decimals.
            onValueChange={(v) => onAmountChange(clampMoneyInput(v))}
            placeholder={placeholder}
          />
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
