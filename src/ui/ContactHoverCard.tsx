import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { personInitials } from '../utils/text'
import { Card } from './Card'

export interface ContactHoverCardProps {
  name: string
  email?: string
  phone?: string
  company?: string
  designation?: string
  primary?: boolean
  /** `end` opens beside the name so a parent popover is not covered. */
  placement?: 'below' | 'end'
  /** `overlay` sits above other popovers. */
  layer?: 'base' | 'overlay'
}

function ActionLink({
  href,
  label,
  value,
  icon,
}: {
  href: string
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <a
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-hover px-2 py-1.5 text-left no-underline transition-colors hover:bg-primary-soft active:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        <span className="block truncate text-xs font-semibold text-primary">{value}</span>
      </span>
    </a>
  )
}

/** Name trigger + hover/focus card for email and phone. No CRM/API calls. */
export function ContactHoverCard({
  name,
  email = '',
  phone = '',
  company = '',
  designation,
  primary = true,
  placement = 'below',
  layer = 'base',
}: ContactHoverCardProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number>(0)
  const [open, setOpen] = useState(false)

  function showCard() {
    window.clearTimeout(hideTimer.current)
    setOpen(true)
  }

  function scheduleHide() {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setOpen(false), 160)
  }

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  useEffect(() => {
    if (!open) return
    function onDismiss(event: Event) {
      if (cardRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !cardRef.current || !triggerRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const width = cardRef.current.offsetWidth
    const height = cardRef.current.offsetHeight
    const gap = 8
    const margin = 12
    let top = placement === 'end' ? trigger.top : trigger.bottom + gap
    let left = placement === 'end' ? trigger.right + gap : trigger.left
    if (placement === 'end' && left + width > window.innerWidth - margin) {
      left = trigger.left - width - gap
    }
    if (top + height > window.innerHeight - margin) {
      top = placement === 'end' ? window.innerHeight - height - margin : trigger.top - height - gap
    }
    if (top < margin) top = margin
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin
    if (left < margin) left = margin
    cardRef.current.style.top = `${top}px`
    cardRef.current.style.left = `${left}px`
  }, [open, name, email, placement])

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="inline-flex max-w-44 cursor-pointer items-center gap-1 rounded-md text-left text-xs font-semibold text-primary underline decoration-dotted decoration-primary/50 underline-offset-2 transition-colors hover:decoration-solid active:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${name} — hover or focus for contact details`}
        onMouseEnter={showCard}
        onMouseLeave={scheduleHide}
        onFocus={showCard}
        onBlur={scheduleHide}
      >
        <span className="min-w-0 truncate">{name}</span>
        <svg
          width="11"
          height="11"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          className="shrink-0 text-primary/70"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              ref={cardRef}
              data-contact-hover-card=""
              className={`fixed w-64 max-w-[calc(100vw-1.5rem)] ${layer === 'overlay' ? 'z-[90]' : 'z-50'}`}
              onMouseEnter={showCard}
              onMouseLeave={scheduleHide}
            >
              <Card
                role="dialog"
                aria-label={`${name} contact details`}
                className="hover-card-in overflow-hidden shadow-overlay"
              >
                <div className="flex items-center gap-2.5 px-3 pt-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[11px] font-bold text-surface" aria-hidden="true">
                    {personInitials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-bold text-ink">{name}</p>
                      {primary ? (
                        <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-px text-[9px] font-bold text-warning">Primary</span>
                      ) : null}
                    </div>
                    {designation ? (
                      <p className="truncate text-[11px] font-semibold text-primary">{designation}</p>
                    ) : null}
                    {company ? <p className="truncate text-[11px] text-ink-muted">{company}</p> : null}
                  </div>
                </div>
                <div className="space-y-1.5 px-3 py-2.5">
                  {email ? (
                    <ActionLink
                      href={`mailto:${email}`}
                      label="Email"
                      value={email}
                      icon={(
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    />
                  ) : null}
                  {phone ? (
                    <ActionLink
                      href={`tel:${phone.replace(/\s/g, '')}`}
                      label="Phone"
                      value={phone}
                      icon={(
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                    />
                  ) : null}
                </div>
              </Card>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
