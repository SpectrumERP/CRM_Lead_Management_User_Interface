import type { ReactNode } from 'react'

export type StatTone = 'primary' | 'success' | 'warning' | 'accent' | 'purple' | 'muted' | 'ink'

const TONE: Record<StatTone, string> = {
  primary: 'border-line-strong bg-primary-soft text-primary',
  success: 'border-success-line bg-success-soft text-success',
  warning: 'border-warning-line bg-warning-soft text-warning',
  accent: 'border-accent/20 bg-accent-soft text-accent',
  purple: 'border-purple-line bg-purple-soft text-purple',
  muted: 'border-line bg-surface-hover text-ink-soft',
  ink: 'border-line bg-surface-hover text-ink',
}

export interface StatPillProps {
  label: string
  value: ReactNode
  tone?: StatTone
  className?: string
}

/** Compact metric chip used on list page headers. */
export function StatPill({ label, value, tone = 'primary', className = '' }: StatPillProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 ${TONE[tone]} ${className}`.trim()}
    >
      <span className="font-display text-lg font-bold leading-none">{value}</span>
      <span className="text-xs font-semibold opacity-90">{label}</span>
    </div>
  )
}

export interface StatPillRowProps {
  children: ReactNode
  className?: string
}

export function StatPillRow({ children, className = '' }: StatPillRowProps) {
  return <div className={`flex flex-wrap gap-3 ${className}`.trim()}>{children}</div>
}
