import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOptionalToast } from '../contexts/ToastContext'
import { RowIconButton } from '../ui'
import {
  canNativeShare,
  shareAttachmentViaEmail,
  shareAttachmentViaWhatsApp,
  shareContactNative,
  shareContactViaEmail,
  shareContactViaWhatsApp,
  type ShareAttachmentInfo,
  type ShareContactInfo,
  type ShareNote,
} from '../utils/businessEntityShare'

type Props = ({ mode: 'contact'; contact: ShareContactInfo } | ({ mode: 'attachment' } & ShareAttachmentInfo)) & {
  /** Show "Share" next to the icon. */
  withLabel?: boolean
}

const ICONS = {
  share: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  whatsapp: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  more: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
}

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/** Share a contact or an attachment by WhatsApp, email or the device share sheet. */
export function BusinessEntityShareMenu(props: Props) {
  const toast = useOptionalToast()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const menu = menuRef.current
    const margin = 8
    let left = Math.min(Math.max(trigger.right - menu.offsetWidth, margin), window.innerWidth - margin - menu.offsetWidth)
    let top = trigger.bottom + 6
    if (top + menu.offsetHeight > window.innerHeight - margin) top = trigger.top - menu.offsetHeight - 6
    left = Math.max(left, margin)
    menu.style.top = `${Math.max(top, margin)}px`
    menu.style.left = `${left}px`
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  async function run(action: () => ShareNote | null | Promise<ShareNote | null>) {
    setOpen(false)
    if (busy) return
    setBusy(true)
    try {
      const note = await action()
      if (note) toast.addToast(note.type, note.title, note.message)
    } finally {
      setBusy(false)
    }
  }

  const items: { label: string; icon: string; tone: string; action: () => ShareNote | null | Promise<ShareNote | null> }[] =
    props.mode === 'contact'
      ? [
          { label: 'WhatsApp', icon: ICONS.whatsapp, tone: 'text-success', action: () => shareContactViaWhatsApp(props.contact) },
          { label: 'Email', icon: ICONS.email, tone: 'text-primary', action: () => shareContactViaEmail(props.contact) },
          ...(canNativeShare()
            ? [{ label: 'More…', icon: ICONS.more, tone: 'text-ink-muted', action: () => shareContactNative(props.contact) }]
            : []),
        ]
      : [
          { label: 'WhatsApp', icon: ICONS.whatsapp, tone: 'text-success', action: () => shareAttachmentViaWhatsApp(props) },
          { label: 'Email', icon: ICONS.email, tone: 'text-primary', action: () => shareAttachmentViaEmail(props) },
        ]

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        {props.withLabel ? (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            <Icon d={ICONS.share} />
            {busy ? 'Sharing…' : 'Share'}
          </button>
        ) : (
          <RowIconButton
            label={busy ? 'Sharing…' : 'Share'}
            tone="primary"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.share} />
            </svg>
          </RowIconButton>
        )}
      </span>
      {open &&
        createPortal(
          <div ref={menuRef} role="menu" aria-label="Share"
            className="fixed z-50 min-w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-overlay">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                onClick={(e) => { e.stopPropagation(); void run(item.action) }}
              >
                <Icon d={item.icon} className={item.tone} />
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
