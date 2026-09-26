import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface IconTooltipProps {
  label: string
  children: ReactNode
  className?: string
  /** Show only when the trigger (or a child) is visually truncated. */
  overflowOnly?: boolean
}

function isOverflowing(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  return nodes.some((el) => el.scrollWidth - el.clientWidth > 1)
}

/** Viewport-safe hover/focus label for icon-only actions and truncated text. */
export function IconTooltip({ label, children, className = '', overflowOnly = false }: IconTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  function show() {
    const root = triggerRef.current
    if (overflowOnly && root && !isOverflowing(root)) return
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const tip = tipRef.current
    const margin = 8
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    let left = trigger.left + trigger.width / 2 - width / 2
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width
    }
    if (left < margin) left = margin
    let top = trigger.top - 6 - height
    if (top < margin) top = trigger.bottom + 6
    tip.style.top = `${top}px`
    tip.style.left = `${left}px`
  }, [open, label])

  const wrap = overflowOnly || label.length > 28

  return (
    <span
      ref={triggerRef}
      className={`inline-flex min-w-0 ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            className={`icon-tip-bubble${wrap ? ' icon-tip-bubble-wrap' : ''}`}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}
