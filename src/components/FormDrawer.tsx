import { type ReactNode } from 'react'
import { Button } from '../ui'
import { useSheetClose } from './useSheetClose'

export interface FormDrawerProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode | ((requestClose: () => void) => ReactNode)
  footer?: ReactNode | ((requestClose: () => void) => ReactNode)
  /** Tailwind width class for the panel. Default matches Note drawer. */
  widthClass?: string
  icon?: ReactNode
  /** Stacking order — use higher for confirm/convert atop other sheets. */
  zClass?: string
}

const DEFAULT_ICON = (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
)

/**
 * Standard right-side form sheet used across the CRM.
 * Prefer this over centered modals for any create/edit/complete form.
 */
export default function FormDrawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = 'w-[26rem]',
  icon = DEFAULT_ICON,
  zClass = 'z-[60]',
}: FormDrawerProps) {
  const { closing, requestClose } = useSheetClose(onClose)

  return (
    <div
      className={`fixed inset-0 ${zClass} flex justify-end${closing ? ' is-sheet-closing' : ''}`}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="ui-scrim crm-sheet-scrim absolute inset-0 border-0 p-0"
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-drawer-title"
        className={`crm-sheet relative z-[1] flex h-full ${widthClass} max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-line bg-surface shadow-overlay sm:max-w-full`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/15 bg-primary-soft px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-surface shadow-sm"
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="min-w-0">
              <h2 id="form-drawer-title" className="font-display text-sm font-bold text-ink">
                {title}
              </h2>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-primary">{subtitle}</p> : null}
            </div>
          </div>
          <Button type="button" variant="icon" aria-label="Close" onClick={requestClose}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5">
          {typeof children === 'function' ? children(requestClose) : children}
        </div>

        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line-subtle bg-surface px-5 py-4">
            {typeof footer === 'function' ? footer(requestClose) : footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
