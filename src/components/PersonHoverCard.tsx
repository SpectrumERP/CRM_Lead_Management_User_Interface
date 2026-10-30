import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  knownPerson,
  loadEmployeePhoto,
  loadPersonProfile,
  personKey,
  stripSalutation,
  type PersonContact,
  type PersonProfile,
  type PersonRef,
} from '../api/people'
import { taskAppUrl } from '../app/paths'
import { Card, Spinner } from '../ui'

/** Hover this long before the card opens, so moving the mouse across a list doesn't flash cards. */
const OPEN_DELAY_MS = 400
/** Grace period to move from the name onto the card. */
const CLOSE_DELAY_MS = 200

// Only one card is open at a time, across every list and panel.
let openCardId: string | null = null
const listeners = new Set<() => void>()
function setOpenCardId(id: string | null) {
  if (openCardId === id) return
  openCardId = id
  listeners.forEach((listener) => listener())
}
function subscribeOpenCard(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const getOpenCardId = () => openCardId

type LoadState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; profile: PersonProfile | null }
  | { key: string; status: 'error' }

/** Loads the person's details the first time the card opens (cached for the session). */
function usePersonProfile(person: PersonRef, enabled: boolean): LoadState {
  const key = personKey(person)
  const [state, setState] = useState<LoadState>({ key: '', status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadPersonProfile(person).then(
      (profile) => {
        if (!cancelled) setState({ key, status: 'ready', profile })
      },
      () => {
        if (!cancelled) setState({ key, status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
    // `key` identifies the person; the object itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return state.key === key ? state : { key, status: 'loading' }
}

/** First + last name initials: "Rahul Kumar Sharma" → "RS". */
function initials(name: string) {
  const parts = stripSalutation(name).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0]![0]}${parts.length > 1 ? parts[parts.length - 1]![0] : ''}`.toUpperCase()
}

function Avatar({ name, empNo }: { name: string; empNo?: number }) {
  const [photo, setPhoto] = useState<{ empNo: number; src: string | null } | null>(null)
  const [broken, setBroken] = useState<string | null>(null)

  useEffect(() => {
    if (!empNo) return
    let cancelled = false
    void loadEmployeePhoto(empNo).then((src) => {
      if (!cancelled) setPhoto({ empNo, src })
    })
    return () => {
      cancelled = true
    }
  }, [empNo])

  const src = photo && photo.empNo === empNo ? photo.src : null
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-sm font-bold text-surface ring-2 ring-primary/25"
      aria-hidden="true"
    >
      {src && src !== broken ? (
        <img src={src} alt="" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(src)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}

const ICONS = {
  designation: 'M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM10 5h4v2h-4V5z',
  department: 'M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
}

function ProfileRow({ icon, label, value, href }: { icon: keyof typeof ICONS; label: string; value: string; href?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon]} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold leading-none text-ink-muted">{label}</p>
        {href ? (
          <a href={href} className="break-words text-xs font-semibold leading-snug text-primary no-underline hover:underline">
            {value}
          </a>
        ) : (
          <p className="break-words text-xs font-semibold leading-snug text-ink">{value}</p>
        )}
      </div>
    </div>
  )
}

function CardBody({ person, state }: { person: PersonRef; state: LoadState }) {
  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-ink-muted">
        <Spinner label="Loading profile" />
        Loading profile
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="px-4 py-5 pr-10">
        <p className="text-xs font-bold text-ink">Couldn’t load profile</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">Hover again to retry.</p>
      </div>
    )
  }
  const profile = state.profile
  const name = profile?.name || person.name || 'User'
  const hasRows = Boolean(profile && (profile.designation || profile.department || profile.phone || profile.email))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-primary-soft px-4 py-3.5 pr-11">
        <Avatar name={name} empNo={profile?.empNo} />
        <h4 className="min-w-0 flex-1 break-words text-sm font-bold leading-snug text-ink">{name}</h4>
      </div>
      {hasRows && profile ? (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          <ProfileRow icon="designation" label="Designation" value={profile.designation} />
          <ProfileRow icon="department" label="Department" value={profile.department} />
          <ProfileRow icon="phone" label="Phone No." value={profile.phone} href={`tel:${profile.phone.split('·')[0]!.replace(/\s/g, '')}`} />
          <ProfileRow icon="email" label="Email" value={profile.email} href={`mailto:${profile.email}`} />
        </div>
      ) : (
        <p className="px-4 py-3 text-[11px] font-medium text-ink-muted">No other details available</p>
      )}
      {profile?.loginNo ? (
        <div className="shrink-0 border-t border-line px-3 py-2.5">
          <a
            href={`${taskAppUrl}users/${profile.loginNo}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-soft px-3 py-2 text-[11px] font-bold text-primary no-underline transition-colors hover:bg-primary hover:text-surface"
          >
            View full profile
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M10 14L20 4M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
            </svg>
          </a>
        </div>
      ) : null}
    </div>
  )
}

export interface PersonHoverCardProps {
  /** Display name as the screen shows it. Empty renders nothing. */
  name: string | null | undefined
  /** Known ids skip the lookup by name. */
  loginNo?: number
  empNo?: number
  /** The row's own email / phone for the person (when the screen has the raw API user object). */
  contact?: PersonContact
  /** Classes for the name text (defaults keep the surrounding text style). */
  className?: string
  /** Custom trigger content (e.g. an avatar + name) in place of the plain name. */
  children?: ReactNode
}

/**
 * A user's / employee's name that opens their profile card (designation, department, phone, email,
 * photo) on hover, click, tap or Enter — the same card Task Management shows.
 */
export function PersonHoverCard({ name, loginNo, empNo, contact, className = '', children }: PersonHoverCardProps) {
  const instanceId = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number>(0)
  const closeTimer = useRef<number>(0)
  /** A click keeps a card hover opened; only a second click (or one on a click-opened card) closes it. */
  const openedByClick = useRef(false)
  const isOpen = useSyncExternalStore(subscribeOpenCard, getOpenCardId, () => null) === instanceId
  const text = (name ?? '').trim()
  // What lists / records sent for this person: their login no, and email / mobile no for the card.
  const known = knownPerson(text, loginNo)
  const person: PersonRef = {
    name: text,
    loginNo: loginNo || known?.loginNo || undefined,
    empNo,
    contact: {
      email: contact?.email?.trim() || known?.contact.email,
      phone: contact?.phone?.trim() || known?.contact.phone,
    },
  }
  const state = usePersonProfile(person, isOpen)

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }
  const open = () => {
    clearTimers()
    openedByClick.current = false
    setOpenCardId(instanceId)
  }
  const close = () => {
    clearTimers()
    // Only the open card may clear — moving between two names must not close the new one.
    if (getOpenCardId() === instanceId) setOpenCardId(null)
  }
  const scheduleOpen = () => {
    window.clearTimeout(closeTimer.current)
    if (isOpen) return
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(open, OPEN_DELAY_MS)
  }
  const scheduleClose = () => {
    clearTimers()
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY_MS)
  }

  useEffect(
    () => () => {
      clearTimers()
      if (getOpenCardId() === instanceId) setOpenCardId(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (!isOpen) return
    function onOutside(event: Event) {
      const target = event.target as Node
      if (cardRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('scroll', onOutside, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('scroll', onOutside, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Below the name; above it, or beside it, when that keeps the whole card on screen.
  useLayoutEffect(() => {
    if (!isOpen || !cardRef.current || !triggerRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const width = cardRef.current.offsetWidth
    const height = cardRef.current.offsetHeight
    const gap = 8
    const margin = 12
    let top = trigger.bottom + gap
    let left = trigger.left
    if (top + height > window.innerHeight - margin) {
      if (trigger.top - height - gap >= margin) top = trigger.top - height - gap
      else if (trigger.right + gap + width <= window.innerWidth - margin) {
        left = trigger.right + gap
        top = window.innerHeight - height - margin
      } else top = window.innerHeight - height - margin
    }
    top = Math.max(margin, top)
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    cardRef.current.style.top = `${top}px`
    cardRef.current.style.left = `${left}px`
  }, [isOpen, state.status])

  if (!text) return children ? <>{children}</> : null

  const toggle = () => {
    if (isOpen && openedByClick.current) return close()
    open()
    openedByClick.current = true
  }

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${text} — profile`}
        className={`inline-flex min-w-0 max-w-full cursor-pointer rounded decoration-dotted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`.trim()}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') scheduleOpen()
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') scheduleClose()
        }}
        onClick={(e) => {
          // The name often sits in a clickable row or link: open the profile instead.
          e.stopPropagation()
          e.preventDefault()
          toggle()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            e.preventDefault()
            toggle()
          }
        }}
      >
        {children ?? <span className="min-w-0 truncate">{text}</span>}
      </span>
      {isOpen
        ? createPortal(
            <div
              ref={cardRef}
              className="fixed z-[96] w-[320px] max-w-[calc(100vw-1.5rem)] sm:w-[340px]"
              onPointerEnter={() => window.clearTimeout(closeTimer.current)}
              onPointerLeave={(e) => {
                if (e.pointerType !== 'touch') scheduleClose()
              }}
              // Portalled, but React still bubbles events to the row the name sits in.
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Card
                role="dialog"
                aria-label={`${text} profile`}
                className="hover-card-in relative flex max-h-[min(28rem,calc(100dvh-5.5rem))] flex-col overflow-hidden shadow-overlay"
              >
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close profile"
                  className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
                <CardBody person={person} state={state} />
              </Card>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** A user object exactly as an API row sends it (`leadOwner`, `assignTo`): its name with the profile card. */
export function ApiUserName({
  user,
  className,
}: {
  user: { loginNo?: number; loginId?: string | null; printingName?: string | null; email?: string | null; mobileNo?: string | null } | null | undefined
  className?: string
}) {
  const name = user?.printingName?.trim() || user?.loginId?.trim() || ''
  return (
    <PersonHoverCard
      name={name}
      loginNo={user?.loginNo}
      contact={{ email: user?.email ?? undefined, phone: user?.mobileNo ?? undefined }}
      className={className}
    />
  )
}
