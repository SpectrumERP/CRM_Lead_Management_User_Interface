import type { ReactNode } from 'react'

export interface DetailFieldProps {
  label: string
  value?: ReactNode
  className?: string
}

/** Read-only label/value pair for detail overview cards. */
export function DetailField({ label, value, className = '' }: DetailFieldProps) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className="text-[10px] font-bold tracking-wider text-ink-faint">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-ink">{value || '—'}</p>
    </div>
  )
}
