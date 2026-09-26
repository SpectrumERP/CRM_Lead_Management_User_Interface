import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconTooltip } from '../ui'

export function RowQuickMenu({
  onAddActivity,
  onAddNote,
  onSendEmail,
}: {
  onAddActivity: () => void
  onAddNote: () => void
  onSendEmail: () => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const menu = menuRef.current
    const margin = 8
    const width = menu.offsetWidth
    const height = menu.offsetHeight
    let left = trigger.right - width
    if (left < margin) left = margin
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width
    let top = trigger.bottom + 6
    if (top + height > window.innerHeight - margin) top = trigger.top - height - 6
    if (top < margin) top = margin
    menu.style.top = `${top}px`
    menu.style.left = `${left}px`
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDismiss() {
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

  const items = [
    {
      label: 'Add Activity',
      onSelect: onAddActivity,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      ),
    },
    {
      label: 'Add Notes',
      onSelect: onAddNote,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      ),
    },
    {
      label: 'Send Email',
      onSelect: onSendEmail,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      ),
    },
  ]

  return (
    <>
      <IconTooltip label="Quick actions">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Quick actions"
          aria-haspopup="menu"
          aria-expanded={open}
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        </button>
      </IconTooltip>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Quick actions"
            className="fixed z-50 min-w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-overlay"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-primary" aria-hidden="true">
                  {item.icon}
                </svg>
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
