import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Sticky list-page chrome with bottom border (Leads-style). */
  bordered?: boolean
  /**
   * Keep header (and right actions) visible while the page scrolls.
   * Defaults to true when `actions` or `bordered` is set.
   */
  sticky?: boolean
  /** Optional toolbar / filters rendered under the title row, inside the same chrome. */
  children?: ReactNode
  className?: string
}

/**
 * Shared list/detail page title row.
 * Use token classes only — do not restyle with inline hex.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  bordered,
  sticky,
  children,
  className = '',
}: PageHeaderProps) {
  const stick = sticky ?? Boolean(actions || bordered)

  const shell = [
    bordered ? 'page-gutter w-full border-b border-line pt-5' : '',
    stick
      ? 'sticky top-0 z-30 bg-surface/95 shadow-[0_1px_0_0_var(--color-line-subtle)] backdrop-blur-sm'
      : bordered
        ? 'bg-surface'
        : '',
    !bordered && stick ? 'pb-3' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shell.trim()}>
      <div
        className={`flex w-full flex-wrap items-start justify-between gap-3 ${children ? 'mb-4' : 'mb-0'}`}
      >
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
          {subtitle ? <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div> : null}
        </div>
        {actions ? (
          <div className="sticky top-3 z-30 flex shrink-0 flex-wrap items-center gap-2 self-start">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
