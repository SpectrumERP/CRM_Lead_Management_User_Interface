import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface IconTooltipProps {
  label: string
  children: ReactNode
  className?: string
  /** Show only when the trigger (or a child) is visually truncated. */
  overflowOnly?: boolean
  /** `right`: beside the trigger, arrow pointing left (collapsed sidebar). Default: above, else below. */
  side?: 'top' | 'right'
}

function isOverflowing(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  return nodes.some((el) => el.scrollWidth - el.clientWidth > 1)
}

/** Only one tooltip on screen: opening one closes the one before (e.g. a sidebar item still focused). */
let closeOpenTip: (() => void) | null = null

/** Viewport-safe hover/focus label for icon-only actions and truncated text. */
export function IconTooltip({ label, children, className = '', overflowOnly = false, side = 'top' }: IconTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  function show() {
    if (!label) return
    const root = triggerRef.current
    if (overflowOnly && root && !isOverflowing(root)) return
    closeOpenTip?.()
    closeOpenTip = () => setOpen(false)
    setOpen(true)
  }

  function hide() {
    setOpen(false)
  }


  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const tip = tipRef.current
    const margin = 8
    // 10px clear of the trigger, leaving room for the arrow (as in Task Management).
    const gap = 10
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    if (side === 'right') {
      const centerY = trigger.top + trigger.height / 2
      const left = Math.min(trigger.right + gap, Math.max(margin, window.innerWidth - width - margin))
      let top = centerY - height / 2
      top = Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - height - margin))
      const arrowY = Math.min(Math.max(centerY - top, 12), Math.max(12, height - 12))
      tip.style.top = `${top}px`
      tip.style.left = `${left}px`
      tip.style.setProperty('--tip-arrow-y', `${arrowY}px`)
      tip.dataset.placement = 'right'
      return
    }
    const centerX = trigger.left + trigger.width / 2
    let left = centerX - width / 2
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width
    }
    if (left < margin) left = margin
    let top = trigger.top - gap - height
    let placement: 'top' | 'bottom' = 'top'
    if (top < margin) {
      top = trigger.bottom + gap
      placement = 'bottom'
    }
    // Arrow stays aimed at the trigger even when the bubble is pushed in from a screen edge.
    const arrowX = Math.min(Math.max(centerX - left, 14), Math.max(14, width - 14))
    tip.style.top = `${top}px`
    tip.style.left = `${left}px`
    tip.style.setProperty('--tip-arrow-x', `${arrowX}px`)
    tip.dataset.placement = placement
  }, [open, label, side])

  const wrap = overflowOnly || label.length > 42

  return (
    <span
      ref={triggerRef}
      className={`inline-flex min-w-0 ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
      // Keyboard focus only: a mouse click leaves focus on the button, which must not keep its tip open.
      onFocus={(event) => {
        if ((event.target as HTMLElement).matches?.(':focus-visible')) show()
      }}
      onBlur={hide}
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
