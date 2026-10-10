import { useState } from 'react'
import { Button, FormGrid, SelectField, TextAreaField, TextField } from '../ui'
import { toApiError } from '../api/errors'
import { usePendingData, isPendingApiMock } from '../api/pendingApiStore'
import {
  STATUS_REMARK_MAX,
  statusRule,
  validateStatusChange,
  type StatusChangeErrors,
  type StatusOption,
  type StatusRecordType,
} from '../api/statusChange'
import { formatConversionStamp } from '../data/opportunities'
import { useConfirm } from '../contexts/ConfirmContext'
import FormDrawer from './FormDrawer'

export interface StatusChangeSubmit {
  newStatus: StatusOption
  remark: string
  /** Won only. */
  orderValue?: string
  /** Won only, `YYYY-MM-DD`. */
  orderDate?: string
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
  changedBy,
  onSubmit,
  onClose,
}: StatusChangeDialogProps) {
  const confirm = useConfirm()
  const pending = usePendingData()
  const choices = statuses.filter((s) => s.name.trim().toLowerCase() !== currentStatusName.trim().toLowerCase())
  const [statusNo, setStatusNo] = useState('')
  const [remark, setRemark] = useState('')
  const [orderValue, setOrderValue] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [errors, setErrors] = useState<StatusChangeErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [openedAt] = useState(() => formatConversionStamp(new Date().toISOString()))

  const newStatus = choices.find((s) => String(s.no) === statusNo)
  const rule = statusRule(record, newStatus, pending)

  function clear(key: keyof StatusChangeErrors) {
    setErrors(({ [key]: _cleared, ...rest }) => rest)
    setFormError('')
  }

  async function submit() {
    if (saving) return
    const next = validateStatusChange({ newStatus, currentStatusName, remark, orderValue, orderDate }, rule)
    setErrors(next)
    if (Object.keys(next).length || !newStatus) return
    const noun = record === 'Lead' ? 'lead' : 'opportunity'
    if (!(await confirm({ title: 'Change Status', message: `Change this ${noun}'s status from "${currentStatusName || '—'}" to "${newStatus.name}"?`, confirmLabel: 'Change Status' }))) return
    setSaving(true)
    setFormError('')
    try {
      await onSubmit({
        newStatus,
        remark: remark.trim(),
        ...(rule.isWon ? { orderValue, orderDate } : {}),
      })
      onClose()
    } catch (error) {
      setFormError(toApiError(error).message)
      setSaving(false)
    }
  }

  const statusOptions = choices.map((s) => {
    const r = statusRule(record, s, pending)
    const notes = [r.isRemarkMandatory ? 'remark required' : '', r.isWon ? 'order details required' : ''].filter(Boolean)
    return { value: String(s.no), label: notes.length ? `${s.name} (${notes.join(', ')})` : s.name }
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
            {saving ? 'Saving…' : 'Change Status'}
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
          }}
        />
        <TextAreaField
          fieldClassName="lg:col-span-2"
          label="Remark"
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
          Demo mode: the status is saved on the server; the remark, order details and history are kept in this browser
          until the backend change-status API is available.
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
