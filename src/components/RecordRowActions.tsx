import type { ReactNode } from 'react'
import { RowIconButton, RowIcons } from '../ui'

export interface RecordRowActionsProps {
  viewLabel?: string
  editLabel?: string
  deleteLabel?: string
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** Set to show Edit greyed out with this reason as its tooltip (e.g. a converted lead). */
  editDisabledReason?: string
  /** Set to show Delete greyed out with this reason as its tooltip (e.g. a converted lead). */
  deleteDisabledReason?: string
  /** Extra controls (e.g. RowQuickMenu) rendered between edit and delete. */
  children?: ReactNode
  className?: string
}

/**
 * Shared table ACTIONS cell: View / Edit / optional extras / Delete.
 * Pages pass labels + handlers only — keep CRM routing outside this component.
 */
export function RecordRowActions({
  viewLabel = 'View',
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  onView,
  onEdit,
  onDelete,
  editDisabledReason,
  deleteDisabledReason,
  children,
  className = '',
}: RecordRowActionsProps) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`.trim()}>
      {onView ? (
        <RowIconButton label={viewLabel} tone="primary" onClick={onView}>
          {RowIcons.view}
        </RowIconButton>
      ) : null}
      {onEdit ? (
        <RowIconButton
          label={editDisabledReason ?? editLabel}
          tone="warning"
          onClick={onEdit}
          disabled={Boolean(editDisabledReason)}
        >
          {RowIcons.edit}
        </RowIconButton>
      ) : null}
      {children}
      {onDelete ? (
        <RowIconButton
          label={deleteDisabledReason ?? deleteLabel}
          tone="danger"
          onClick={onDelete}
          disabled={Boolean(deleteDisabledReason)}
        >
          {RowIcons.delete}
        </RowIconButton>
      ) : null}
    </div>
  )
}
