import type { CSSProperties, ReactNode } from 'react'

export type CountBadgeSize = 'sm' | 'md' | 'lg'
export type CountBadgeTone =
  | 'accent'
  | 'primary'
  | 'primary-soft'
  | 'warning'
  | 'warning-soft'
  | 'muted'
  | 'surface'

const SIZE: Record<CountBadgeSize, string> = {
  sm: 'size-3.5 text-[8px]',
  md: 'size-5 text-[10px]',
  lg: 'size-6 text-[11px]',
}

/** Multi-char values (e.g. 9+, 12) stay circular with a slightly tighter type size. */
const SIZE_WIDE: Record<CountBadgeSize, string> = {
  sm: 'size-4 text-[7px]',
  md: 'size-5 text-[9px]',
  lg: 'size-6 text-[10px]',
}

/** Four digits and more (e.g. 3292) do not fit a circle: a pill as tall as the circle, at least as wide. */
const SIZE_PILL: Record<CountBadgeSize, string> = {
  sm: 'h-4 min-w-4 px-1 text-[7px]',
  md: 'h-5 min-w-5 px-1.5 text-[9px]',
  lg: 'h-6 min-w-6 px-2 text-[10px]',
}

const TONE: Record<CountBadgeTone, string> = {
  accent: 'bg-accent text-white',
  primary: 'bg-primary text-white',
  'primary-soft': 'bg-primary-soft text-primary',
  warning: 'bg-warning text-white',
  'warning-soft': 'bg-warning-soft text-warning',
  muted: 'bg-surface-hover text-ink-soft',
  surface: 'bg-surface text-ink-muted ring-1 ring-line',
}

export interface CountBadgeProps {
  value: ReactNode
  size?: CountBadgeSize
  tone?: CountBadgeTone
  className?: string
  style?: CSSProperties
  /** Optional accessible label (defaults to the value). */
  'aria-label'?: string
}

/**
 * Circular numeric badge with optically centered digits.
 * Prefer this over ad-hoc `rounded-full px-*` count chips.
 */
export function CountBadge({
  value,
  size = 'md',
  tone = 'muted',
  className = '',
  style,
  'aria-label': ariaLabel,
}: CountBadgeProps) {
  const text = value == null ? '' : String(value)
  const box = text.length > 3 ? SIZE_PILL[size] : text.length > 1 ? SIZE_WIDE[size] : SIZE[size]

  return (
    <span
      aria-label={ariaLabel ?? (text || undefined)}
      style={style}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold leading-none tabular-nums ${box} ${TONE[tone]} ${className}`.trim()}
    >
      {value}
    </span>
  )
}
