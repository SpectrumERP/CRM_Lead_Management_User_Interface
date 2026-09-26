import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconTooltip } from './IconTooltip'

export type RowIconTone = 'default' | 'primary' | 'warning' | 'danger'

export interface RowIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  tone?: RowIconTone
  children: ReactNode
}

const TONE: Record<RowIconTone, string> = {
  default: 'hover:bg-surface-hover hover:text-ink',
  primary: 'hover:bg-primary-soft hover:text-primary',
  warning: 'hover:bg-warning-soft hover:text-warning',
  danger: 'hover:bg-accent-soft hover:text-accent',
}

/**
 * Compact table-row icon control (View / Edit / Delete).
 * Tokens only — no business logic.
 */
export function RowIconButton({
  label,
  tone = 'default',
  className = '',
  children,
  type = 'button',
  ...props
}: RowIconButtonProps) {
  return (
    <IconTooltip label={label}>
      <button
        type={type}
        aria-label={label}
        className={`flex h-6 w-6 items-center justify-center rounded text-ink-faint transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40 ${TONE[tone]} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    </IconTooltip>
  )
}

export const RowIcons = {
  view: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  ),
  edit: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  ),
  delete: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
} as const
