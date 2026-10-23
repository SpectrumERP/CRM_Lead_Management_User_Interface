import { useEffect, useState } from 'react'
import { Button, FormGrid, SelectField, TextAreaField, TextField } from '../ui'
import { toApiError } from '../api/errors'
import { guessIsoCurrency } from '../api/fillValues'
import { usePendingData, isPendingApiMock } from '../api/pendingApiStore'
import {
  STATUS_REMARK_MAX,
  isConvertedStatus,
  statusRule,
  validateStatusChange,
  type StatusChangeErrors,
  type StatusOption,
  type StatusRecordType,
} from '../api/statusChange'
import { formatConversionStamp } from '../data/opportunities'
import { useConfirm } from '../contexts/ConfirmContext'
import type { ConvertOpportunityInput } from './ConvertOpportunityDialog'
import CurrencyAmountField from './CurrencyAmountField'
import FormDrawer from './FormDrawer'
import { useOpportunityFillValues } from './useOpportunityFillValues'

export interface StatusChangeSubmit {
  newStatus: StatusOption
  remark: string
  /** Won only. */
  orderValue?: string
  /** Won only, `YYYY-MM-DD`. */
  orderDate?: string
  /** Lead, Converted status: convert the lead to an opportunity with these (instead of a status change). */
  conversion?: ConvertOpportunityInput
}

/** Lead: picking a Converted status converts the lead — its opportunity value, currency and closure date to start with. */
export interface ConversionDefaults {
  value?: number
  currencyNo?: number
  /** `YYYY-MM-DD`. */
  closingDate?: string
  /** Shown as the stage when the Converted status has no linked stage (e.g. "Converted To Opportunity"). */
  stageName?: string
}

export interface StatusChangeDialogProps {
  record: StatusRecordType
  /** e.g. the lead code and name, for the subtitle. */
  recordLabel: string
  currentStatusName: string
  /** Server statuses (fill values) in display order. */
  statuses: readonly StatusOption[]
  /** Currency of the record, shown with Order Value (e.g. "INR"). */
  currencyLabel?: string
  /**
   * Opportunity: Order Value / Order Date start as its opportunity value and expected closure date
   * (`YYYY-MM-DD`); the user can change them before submitting.
   */
  orderDefaults?: { orderValue?: number; orderDate?: string }
  /** Lead: a Converted status converts the lead (Opportunity Value and Expected Closure Date are asked for). */
  conversion?: ConversionDefaults
  changedBy: string
  /** Saves the change; a rejection (server error) keeps the dialog open with its message. */
  onSubmit: (change: StatusChangeSubmit) => Promise<void>
  onClose: () => void
}

/**
 * Change a lead's / opportunity's status: the new status, a remark (required when the status is set up that
 * way), and Order Value + Order Date for the Won status. Changed By and the date are set when it is saved.
 */
export default function StatusChangeDialog({
  record,
  recordLabel,
  currentStatusName,
  statuses,
  currencyLabel,
  orderDefaults,
  conversion,
  changedBy,
  onSubmit,
  onClose,
}: StatusChangeDialogProps) {
  const confirm = useConfirm()
  const pending = usePendingData()
  const isCurrent = (s: StatusOption) => s.name.trim().toLowerCase() === currentStatusName.trim().toLowerCase()
  // Every status from the fill values is listed; the current one is shown but cannot be picked.
  const choices = statuses.filter((s) => !isCurrent(s))
  const [statusNo, setStatusNo] = useState('')
  const [remark, setRemark] = useState('')
  const [orderValue, setOrderValue] = useState(() => (orderDefaults?.orderValue ? String(orderDefaults.orderValue) : ''))
  const [orderDate, setOrderDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(orderDefaults?.orderDate ?? '') ? orderDefaults!.orderDate! : ''))
  const [errors, setErrors] = useState<StatusChangeErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [openedAt] = useState(() => formatConversionStamp(new Date().toISOString()))

  const newStatus = choices.find((s) => String(s.no) === statusNo)
  const rule = statusRule(record, newStatus, pending)
  // Lead → Converted: the lead is converted to an opportunity (value, currency, expected closure date).
  const converting = Boolean(conversion) && record === 'Lead' && isConvertedStatus(newStatus)
  // The stage the record moves to with this status (its linked stage).
  const newStage = converting ? (newStatus?.stageName ?? conversion?.stageName ?? 'Converted to Opportunity') : newStatus?.stageName
  const { values: oppFill } = useOpportunityFillValues()
  const currencies = conversion ? (oppFill?.currencies ?? []) : []
  const [currencyNo, setCurrencyNo] = useState<number | undefined>(conversion?.currencyNo)
  useEffect(() => {
    if (!currencyNo && currencies[0]) setCurrencyNo(currencies[0].currencyNo)
  }, [currencies, currencyNo])
  const [dealValue, setDealValue] = useState(conversion?.value ? String(conversion.value) : '')
  const [closingDate, setClosingDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(conversion?.closingDate ?? '') ? conversion!.closingDate! : ''))
  const [conversionErrors, setConversionErrors] = useState<{ dealValue?: string; closingDate?: string }>({})

  /** The conversion details, or null (with the errors shown) when one is missing. */
  function conversionInput(): ConvertOpportunityInput | null {
    const value = Number(String(dealValue).replace(/[^\d.]/g, ''))
    const next: { dealValue?: string; closingDate?: string } = {}
    const picked = currencies.find((c) => c.currencyNo === currencyNo)
    if (!value || value <= 0) next.dealValue = 'Enter an opportunity value'
    else if (!picked) next.dealValue = 'Select a currency'
    if (!closingDate) next.closingDate = 'Enter an expected closure date'
    setConversionErrors(next)
    if (Object.keys(next).length || !picked) return null
    return {
      dealValue: value,
      valueCurrency: guessIsoCurrency({ currencyName: picked.currencyName, symbol: picked.symbol ?? '' }),
      currencyNo: picked.currencyNo,
      closingDate,
    }
  }

  function clear(key: keyof StatusChangeErrors) {
    setErrors(({ [key]: _cleared, ...rest }) => rest)
    setFormError('')
  }

  async function submit() {
    if (saving) return
    // Converting has no remark (the conversion API takes none).
    const next = validateStatusChange({ newStatus, currentStatusName, remark: converting ? 'x' : remark, orderValue, orderDate }, rule)
    setErrors(next)
    const converted = converting ? conversionInput() : undefined
    if (Object.keys(next).length || !newStatus || converted === null) return
    const noun = record === 'Lead' ? 'lead' : 'opportunity'
    const ok = converting
      ? await confirm({ title: 'Convert to Opportunity', message: 'Convert this lead to an opportunity?', confirmLabel: 'Convert' })
      : await confirm({ title: 'Change Status', message: `Change this ${noun}'s status from "${currentStatusName || '—'}" to "${newStatus.name}"?`, confirmLabel: 'Change Status' })
    if (!ok) return
    setSaving(true)
    setFormError('')
    try {
      await onSubmit({
        newStatus,
        remark: converting ? '' : remark.trim(),
        ...(rule.isWon ? { orderValue, orderDate } : {}),
        ...(converted ? { conversion: converted } : {}),
      })
      onClose()
    } catch (error) {
      setFormError(toApiError(error).message)
      setSaving(false)
    }
  }

  const statusOptions = statuses.map((s) => {
    if (isCurrent(s)) return { value: String(s.no), label: `${s.name} (current)`, disabled: true }
    const r = statusRule(record, s, pending)
    const notes = [r.isRemarkMandatory ? 'remark required' : '', r.isWon ? 'order details required' : ''].filter(Boolean)
    return { value: String(s.no), label: notes.length ? `${s.name}` : s.name }
  })

  return (
    <FormDrawer
      title="Change Status"
      subtitle={recordLabel}
      onClose={onClose}
      zClass="z-[90]"
      widthClass="w-[28rem]"
      icon={
        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={submit} disabled={saving || !choices.length}>
            {saving ? 'Saving…' : converting ? 'Convert to Opportunity' : 'Change Status'}
          </Button>
        </>
      )}
    >
      <FormGrid>
        <TextField fieldClassName="lg:col-span-2" label="Current Status" value={currentStatusName || '—'} readOnly disabled />
        <SelectField
          fieldClassName="lg:col-span-2"
          label="New Status"
          required
          preserveOrder
          placeholder={choices.length ? 'Select status' : 'No other status is set up'}
          error={errors.status}
          options={statusOptions}
          value={statusNo}
          onValueChange={(value) => {
            setStatusNo(value)
            clear('status')
            clear('remark')
            clear('orderValue')
            clear('orderDate')
            setConversionErrors({})
          }}
        />
        {newStage ? (
          <TextField
            fieldClassName="lg:col-span-2"
            label="Stage"
            value={newStage}
            readOnly
            disabled
            hint={converting ? 'The lead moves to this stage when it is converted' : 'Linked to this status — the stage changes with it'}
          />
        ) : null}
        {converting ? (
          <>
            <div className="lg:col-span-2">
              <CurrencyAmountField
                label="Opportunity Value"
                required
                error={conversionErrors.dealValue}
                amount={dealValue}
                onAmountChange={(value) => {
                  setDealValue(value)
                  setConversionErrors(({ dealValue: _cleared, ...rest }) => rest)
                }}
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
              error={conversionErrors.closingDate}
              value={closingDate}
              onValueChange={(value) => {
                setClosingDate(value)
                setConversionErrors(({ closingDate: _cleared, ...rest }) => rest)
              }}
            />
          </>
        ) : null}
        {converting ? null : (
          <TextAreaField
            fieldClassName="lg:col-span-2"
            label="Status Remark"
            required={rule.isRemarkMandatory}
            hint={rule.isRemarkMandatory ? undefined : 'Optional'}
            error={errors.remark}
            rows={3}
            maxLength={STATUS_REMARK_MAX}
            value={remark}
            onValueChange={(value) => {
              setRemark(value)
              clear('remark')
            }}
            placeholder="Reason for the status change…"
          />
        )}
        {rule.isWon ? (
          <>
            <TextField
              label={currencyLabel ? `Order Value (${currencyLabel})` : 'Order Value'}
              required
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              error={errors.orderValue}
              value={orderValue}
              onValueChange={(value) => {
                setOrderValue(value)
                clear('orderValue')
              }}
              placeholder="0.00"
            />
            <TextField
              label="Order Date"
              required
              type="date"
              error={errors.orderDate}
              value={orderDate}
              onValueChange={(value) => {
                setOrderDate(value)
                clear('orderDate')
              }}
            />
          </>
        ) : null}
        <TextField label="Changed By" value={changedBy} readOnly disabled />
        <TextField label="Change Date" value={openedAt} readOnly disabled hint="Set when saved" />
      </FormGrid>

      {isPendingApiMock() ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Demo mode: the status and its remark are saved on the server; order details and history are kept in this
          browser until the backend change-status API is available.
        </p>
      ) : null}

      {formError ? (
        <p className="mt-3 text-xs text-accent" role="alert">
          {formError}
        </p>
      ) : null}
    </FormDrawer>
  )
}
