import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, compareAlpha, TextInput } from '../ui'
import { matchesAny, personInitials } from '../utils/text'
import { PersonContactCard } from './PersonContactCard'

export interface SecondaryContactView {
  name: string
  email?: string
  phone?: string
  company?: string
  designation?: string
}

const MANY_CONTACTS = 5
const INLINE_NAMES = 1
/** Visible rows before the popover list scrolls. */
const LIST_VISIBLE_ROWS = 6
const LIST_ROW_HEIGHT = '2.5rem'

function matchesQuery(item: SecondaryContactView, query: string) {
  return matchesAny(
    [item.name, item.email, item.phone, item.designation, item.company],
    query,
  )
}

function isHoverCardTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-contact-hover-card]'))
}

function Face({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[9px] font-bold text-surface"
      aria-hidden="true"
    >
      {personInitials(name)}
    </span>
  )
}

function ContactName({ item, staticName = false }: { item: SecondaryContactView; staticName?: boolean }) {
  if (staticName) {
    return (
      <span className="inline-flex max-w-36 truncate text-xs font-semibold text-primary">{item.name}</span>
    )
  }
  return (
    <PersonContactCard
      name={item.name}
      email={item.email}
      phone={item.phone}
      company={item.company}
      designation={item.designation}
      primary={false}
    />
  )
}

export function SecondaryContactsMore({ items }: { items: SecondaryContactView[] }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const many = items.length > MANY_CONTACTS
  const collapsed = items.length > INLINE_NAMES
  const inline = collapsed ? items.slice(0, 1) : items
  const extra = collapsed ? items.length - 1 : 0

  const visible = useMemo(() => {
    const filtered = many ? items.filter((item) => matchesQuery(item, query)) : items
    return [...filtered].sort((left, right) => compareAlpha(left.name, right.name))
  }, [items, many, query])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const panel = panelRef.current
    const margin = 12
    const gap = 8
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    let left = trigger.right + gap
    if (left + width > window.innerWidth - margin) left = trigger.left - width - gap
    if (left < margin) left = margin
    let top = trigger.top
    if (top + height > window.innerHeight - margin) top = window.innerHeight - height - margin
    if (top < margin) top = margin
    panel.style.top = `${top}px`
    panel.style.left = `${left}px`
  }, [open, items.length, query, visible.length])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      if (isHoverCardTarget(event.target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onDismiss(event: Event) {
      if (panelRef.current?.contains(event.target as Node)) return
      if (isHoverCardTarget(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
    }
  }, [open])

  if (!items.length) return <span className="text-xs text-ink-faint">—</span>

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {inline.map((item, index) => (
        <span key={`${item.name}-${item.email}`} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? (
            <span className="shrink-0 text-ink-faint" aria-hidden="true">
              ·
            </span>
          ) : null}
          <ContactName item={item} staticName={open} />
        </span>
      ))}
      {extra > 0 ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex h-6 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border border-line bg-primary-soft px-2 text-[11px] font-bold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-surface active:bg-primary-hover active:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`Show all ${items.length} secondary contacts`}
            title={`${items.length} secondary contacts`}
            onClick={(event) => {
              event.stopPropagation()
              setOpen((prev) => !prev)
            }}
          >
            +{extra} more
          </button>
          {open
            ? createPortal(
                <div
                  ref={panelRef}
                  className={`fixed z-[80] max-w-[calc(100vw-1.5rem)] ${many ? 'w-72' : 'w-56'}`}
                >
                  <Card role="dialog" aria-label="Secondary contacts" className="overflow-hidden p-0 shadow-overlay">
                    <div className="border-b border-line px-3 py-2">
                      <p className="text-xs font-bold text-ink">Secondary contacts</p>
                      <p className="text-xs text-ink-faint">
                        {query.trim()
                          ? `${visible.length} of ${items.length} people`
                          : `${items.length} people on this lead`}
                      </p>
                      {many ? (
                        <div className="mt-2">
                          <TextInput
                            type="search"
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search name, email, phone"
                            aria-label="Search secondary contacts"
                            autoComplete="off"
                          />
                        </div>
                      ) : null}
                    </div>
                    {visible.length ? (
                      <ul
                        className="overflow-y-auto overscroll-contain py-1"
                        style={{ maxHeight: `calc(${LIST_VISIBLE_ROWS} * ${LIST_ROW_HEIGHT})` }}
                      >
                        {visible.map((item) => (
                          <li
                            key={`${item.name}-${item.email}`}
                            className="flex h-10 items-center gap-2 px-3 hover:bg-surface-hover"
                          >
                            <Face name={item.name} />
                            <PersonContactCard
                              name={item.name}
                              email={item.email}
                              phone={item.phone}
                              company={item.company}
                              designation={item.designation}
                              primary={false}
                              placement="end"
                              layer="overlay"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-6 text-center text-xs text-ink-faint">No contacts match this search.</p>
                    )}
                  </Card>
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
    </div>
  )
}
