import { useState, type ReactNode } from 'react'
import { Button, TextArea } from '../ui'
import FormDrawer from './FormDrawer'
import { FIELD_LIMITS } from '../constants/fieldLimits'
import { useConfirm } from '../contexts/ConfirmContext'

export interface OutcomeDialogProps {
  title: string
  summary: ReactNode
  label: string
  placeholder?: string
  confirmLabel?: string
  onConfirm: (outcome: string) => void
  onClose: () => void
}

/** Shared “mark complete / capture outcome” sheet used by Activities and Meetings. */
export default function OutcomeDialog({
  title,
  summary,
  label,
  placeholder = 'What was the result?',
  confirmLabel = 'Mark Complete',
  onConfirm,
  onClose,
}: OutcomeDialogProps) {
  const confirm = useConfirm()
  const [outcome, setOutcome] = useState('')
  const [err, setErr] = useState('')

  async function submit() {
    if (!outcome.trim()) {
      setErr(`${label} is required`)
      return
    }
    if (!(await confirm({ title, message: 'Save this outcome and mark it complete?', confirmLabel }))) return
    onConfirm(outcome.trim())
  }

  return (
    <FormDrawer
      title={title}
      subtitle="Capture the result before closing"
      onClose={onClose}
      zClass="z-[90]"
      widthClass="w-[26rem]"
      icon={
        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="solid"
            className="!bg-success hover:!bg-success-strong"
            onClick={submit}
          >
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-line-strong bg-primary-soft px-3 py-2.5">{summary}</div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-soft" htmlFor="outcome-dialog-field">
            {label} <span className="text-accent">*</span>
          </label>
          <TextArea
            maxLength={FIELD_LIMITS.activityNotesOutcome}
            id="outcome-dialog-field"
            rows={3}
            value={outcome}
            invalid={Boolean(err)}
            autoFocus
            placeholder={placeholder}
            onValueChange={(value) => {
              setOutcome(value)
              setErr('')
            }}
          />
          {err ? <p className="mt-1 text-xs text-accent">{err}</p> : null}
        </div>
      </div>
    </FormDrawer>
  )
}
