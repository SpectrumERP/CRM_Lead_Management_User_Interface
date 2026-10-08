import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

export interface FixedMenuOptions {
  /** Menu width from the trigger's width (default: the same). E.g. a wide multi-column lookup. */
  width?: (triggerWidth: number) => number
  /** Tallest the menu may be (default 288px); always capped to the room on screen. */
  maxHeight?: number
  /** Take the menu's width and left edge from this element instead of the trigger (e.g. the form row). */
  span?: () => HTMLElement | null
}

/**
 * Positions a portaled menu under (or above) a trigger so parent overflow cannot clip it, and keeps it
 * inside the viewport: a menu that would run off the right side lines up with the trigger's right edge,
 * and it opens upwards when there is more room above.
 */
export function useFixedMenu(open: boolean, triggerRef: RefObject<HTMLElement | null>, options: FixedMenuOptions = {}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const optionsRef = useRef(options)
  optionsRef.current = options

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return
    }

    function place() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const gutter = 8
      const wanted = optionsRef.current.maxHeight ?? 288
      const below = window.innerHeight - rect.bottom - gutter - 4
      const above = rect.top - gutter - 4
      const openUp = below < Math.min(wanted, 200) && above > below
      const maxH = Math.max(120, Math.min(wanted, openUp ? above : below))
      const spanRect = optionsRef.current.span?.()?.getBoundingClientRect()
      const baseWidth = spanRect ? spanRect.width : rect.width
      const width = Math.min(optionsRef.current.width?.(baseWidth) ?? baseWidth, window.innerWidth - gutter * 2)
      const fitsLeftAligned = rect.left + width <= window.innerWidth - gutter
      const preferred = spanRect ? spanRect.left : fitsLeftAligned ? rect.left : rect.right - width
      setStyle({
        position: 'fixed',
        left: Math.max(gutter, Math.min(preferred, window.innerWidth - width - gutter)),
        width,
        zIndex: 80,
        maxHeight: maxH,
        visibility: 'visible',
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
          : { top: rect.bottom + 4, bottom: 'auto' }),
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, triggerRef])

  return style
}
