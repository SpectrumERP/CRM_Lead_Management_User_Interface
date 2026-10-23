import { Button } from './Button'
import { ContactHoverCard, type ContactHoverCardProps } from './ContactHoverCard'
import { IconTooltip } from './IconTooltip'

export interface TagProps {
  label: string
  title?: string
  onRemove?: () => void
  removeLabel?: string
  /** A person: hovering the label shows their contact card (name, designation, email, phone) instead of `title`. */
  contact?: Omit<ContactHoverCardProps, 'children'>
}

/** Compact removable chip for multi-select values. */
export function Tag({ label, title, onRemove, removeLabel, contact }: TagProps) {
  const chip = (
    <span
      className={`inline-flex max-w-full items-center gap-0.5 rounded-lg border border-primary bg-primary-soft py-1 pl-2.5 text-xs font-semibold text-primary ${onRemove ? "pr-1" : "pr-2.5"}`}
    >
      {contact ? (
        <ContactHoverCard {...contact}>
          <span className="block min-w-0 truncate">{label}</span>
        </ContactHoverCard>
      ) : (
        <span className="min-w-0 truncate">{label}</span>
      )}
      {onRemove ? (
        <Button
          variant="icon"
          aria-label={removeLabel ?? `Remove ${label}`}
          className="!h-5 !w-5 shrink-0"
          onClick={onRemove}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      ) : null}
    </span>
  )
  if (contact) return chip
  return (
    <IconTooltip label={title ?? label} className="max-w-full">
      {chip}
    </IconTooltip>
  )
}
