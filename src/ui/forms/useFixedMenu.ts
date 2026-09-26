import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

/** Positions a portaled menu under (or above) a trigger so parent overflow cannot clip it. */
export function useFixedMenu(open: boolean, triggerRef: RefObject<HTMLElement | null>) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

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
      const maxH = Math.min(288, window.innerHeight - gutter * 2)
      const below = window.innerHeight - rect.bottom - gutter
      const openUp = below < 200 && rect.top > below
      setStyle({
        position: 'fixed',
        left: Math.max(gutter, Math.min(rect.left, window.innerWidth - rect.width - gutter)),
        width: rect.width,
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
