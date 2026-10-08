/** Layout pieces of the Business Entity screens, matching the Task Management master screens. */
import { useEffect, useId, useState, type ReactNode } from 'react'

/** Outline icon paths (24 × 24, stroke) used across the entity screens. */
export const ICON = {
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  note: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  paperclip: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
  idCard: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
  camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  plus: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x: 'M6 18L18 6M6 6l12 12',
  save: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  chevronDown: 'M19 9l-7 7-7-7',
  chevronRight: 'M9 5l7 7-7 7',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  mapPin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  layers: 'M12 2l9 5-9 5-9-5 9-5zm-9 10l9 5 9-5m-18 5l9 5 9-5',
  rename: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5-9 9H7v-5l9-9z',
  scan: 'M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2m0 10v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2m4-9h8m-8 4h8m-8 4h5',
} as const

export function Icon({ d, size = 14, className = '', strokeWidth = 2 }: { d: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/** Count chip next to a section title. */
export function CountChip({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-soft px-1.5 text-[10px] font-semibold tabular-nums text-primary">
      {value}
    </span>
  )
}

/**
 * Card with an icon header (title, optional count and description, right-side action). Collapsible
 * sections start closed and open by themselves once `autoOpen` turns true (data or an error).
 */
export function EntitySection({
  icon,
  title,
  description,
  action,
  children,
  collapsible = false,
  autoOpen = false,
  count,
  bodyClassName = '',
}: {
  icon: string
  title: ReactNode
  description?: string
  action?: ReactNode
  children?: ReactNode
  collapsible?: boolean
  autoOpen?: boolean
  count?: number
  bodyClassName?: string
}) {
  const [open, setOpen] = useState(!collapsible || autoOpen)
  const bodyId = useId()
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])
  const isOpen = !collapsible || open

  const heading = (
    <>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon d={icon} size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ink">
          {title}
          {count != null ? <CountChip value={count} /> : null}
        </h2>
        {description ? <p className="mt-0.5 truncate text-[11px] font-medium text-ink-faint">{description}</p> : null}
      </div>
    </>
  )

  return (
    <section className="overflow-visible rounded-lg border border-line bg-surface shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)]">
      <div className={`flex items-center justify-between gap-3 rounded-t-lg bg-surface-muted px-4 py-3 ${isOpen ? 'border-b border-line' : 'rounded-b-lg'}`}>
        {collapsible ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={isOpen} aria-controls={bodyId}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary">
            <Icon d={isOpen ? ICON.chevronDown : ICON.chevronRight} size={15} className="shrink-0 text-ink-faint" />
            {heading}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">{heading}</div>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div id={bodyId} hidden={!isOpen}>
        {children != null ? <div className={`p-4 sm:p-5 ${bodyClassName}`.trim()}>{children}</div> : null}
      </div>
    </section>
  )
}

/** Small uppercase label with a rule, grouping fields inside a section. */
export function Subheading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`.trim()}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/** Primary (filled) small button used in section headers and dialogs. */
export function SolidButton({ children, onClick, disabled, type = 'button', className = '' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-surface shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}>
      {children}
    </button>
  )
}

/** Outline button (Cancel, icon buttons in headers). */
export function OutlineButton({ children, onClick, disabled, title, className = '', active, iconOnly }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; className?: string; active?: boolean
  /** Square 32 px button holding just an icon. */
  iconOnly?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-surface text-xs font-semibold transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40 ${iconOnly ? 'w-8' : 'px-3'} ${
        active ? 'border-primary/40 text-primary' : 'border-line-strong text-ink-soft'
      } ${className}`.trim()}>
      {children}
    </button>
  )
}

/** "Business Entities › Business Entity › New" with actions on the right (top of the form and list). */
export function BreadcrumbBar({ items, actions }: { items: { label: string; onClick?: () => void }[]; actions?: ReactNode }) {
  return (
    <div className="page-gutter sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/95 py-2.5 backdrop-blur-sm">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <span key={item.label + i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? <Icon d={ICON.chevronRight} size={13} className="shrink-0 text-ink-faint" /> : null}
              {item.onClick && !last ? (
                <button type="button" onClick={item.onClick} className="truncate font-medium text-ink-muted hover:text-primary">{item.label}</button>
              ) : (
                <span className={`truncate ${last ? 'font-semibold text-ink' : 'font-medium text-ink-muted'}`}>{item.label}</span>
              )}
            </span>
          )
        })}
      </nav>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
