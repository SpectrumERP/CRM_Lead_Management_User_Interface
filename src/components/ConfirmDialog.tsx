import { useEffect } from 'react'
import { Button, Card } from '../ui'

export interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Stacking layer; the save confirm sits above other dialogs. */
  zClass?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  zClass = 'z-[90]',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={`ui-scrim fixed inset-0 ${zClass} flex items-center justify-center px-4`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-[21rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-overlay animate-[scaleIn_0.16s_ease]"
      >
        <div className="flex">
          <div className={`w-1 shrink-0 ${danger ? 'bg-accent' : 'bg-primary'}`} aria-hidden="true" />

          <div className="min-w-0 flex-1 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  danger ? 'bg-accent-soft text-accent' : 'bg-primary-soft text-primary'
                }`}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  {danger
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                </svg>
              </div>

              <div className="min-w-0 flex-1 pr-7">
                <h3 id="confirm-dialog-title" className="ui-title text-sm leading-5">{title}</h3>
                <p id="confirm-dialog-message" className="mt-1 text-xs leading-5 text-ink-soft">
                  {message}
                </p>
              </div>

              <div className="absolute right-1.5 top-1.5">
                <Button type="button" variant="icon" onClick={onCancel} aria-label="Close">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
              <Button variant={danger ? 'danger' : 'solid'} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
