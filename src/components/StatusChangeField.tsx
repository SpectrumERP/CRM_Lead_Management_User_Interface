import { useState } from 'react'
import type { StatusOption, StatusRecordType } from '../api/statusChange'
import { useAuth } from '../auth/AuthContext'
import { Button, Field, TextInput } from '../ui'
import StatusChangeDialog, { type StatusChangeSubmit } from './StatusChangeDialog'

/**
 * A lead's / opportunity's status on an edit form: shown read-only, changed with the same Change Status
 * drawer as the view pages (fill-values statuses, remark when the status requires one), saved straight away.
 */
export default function StatusChangeField({
  record,
  label,
  value,
  statuses,
  recordLabel,
  currencyLabel,
  orderDefaults,
  disabledReason,
  onChange,
}: {
  record: StatusRecordType
  label: string
  /** Current status name. */
  value: string
  statuses: readonly StatusOption[]
  /** e.g. the lead code and name, for the drawer subtitle. */
  recordLabel: string
  currencyLabel?: string
  /** Opportunity: Order Value / Order Date start as these (see StatusChangeDialog). */
  orderDefaults?: { orderValue?: number; orderDate?: string }
  /** Why the status cannot change here (e.g. a locked lead); hides Change Status and shows as the hint. */
  disabledReason?: string
  /** Saves the change; a rejection (server error) keeps the drawer open with its message. */
  onChange: (change: StatusChangeSubmit) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const changedBy = useAuth().user?.name ?? ''
  return (
    <>
      <Field label={label} hint={disabledReason}>
        <div className="flex items-center gap-2">
          <TextInput className="min-w-0 flex-1" value={value || '—'} readOnly disabled aria-label={label} />
          {disabledReason ? null : (
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => setOpen(true)}>
              Change Status
            </Button>
          )}
        </div>
      </Field>
      {open ? (
        <StatusChangeDialog
          record={record}
          recordLabel={recordLabel}
          currentStatusName={value}
          statuses={statuses}
          currencyLabel={currencyLabel}
          orderDefaults={orderDefaults}
          changedBy={changedBy}
          onClose={() => setOpen(false)}
          onSubmit={onChange}
        />
      ) : null}
    </>
  )
}
