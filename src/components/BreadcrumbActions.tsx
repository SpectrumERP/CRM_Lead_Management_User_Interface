import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** The slot at the right end of the header's breadcrumb line (null when the page has no breadcrumb). */
export const BreadcrumbActionsSlot = createContext<HTMLElement | null>(null)

/**
 * A form page's Cancel / Save buttons, shown at the right of the breadcrumb line so they stay in
 * view. Embedded forms (Quick Create drawer) and pages without a breadcrumb keep them in place.
 */
export function BreadcrumbActions({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const slot = useContext(BreadcrumbActionsSlot)
  if (inline || !slot) return <div className="flex flex-wrap items-center justify-between gap-2 pt-1">{children}</div>
  return createPortal(
    <div className="flex items-center gap-2" onClick={revealFirstError}>
      {children}
    </div>,
    slot,
  )
}

/** Save sits up here while the form scrolls below: a failed save brings its first invalid field into view. */
function revealFirstError() {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>('main [aria-invalid="true"]')
    if (!field) return
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // A search dropdown opens on focus — scroll to it only.
    if (!field.matches('[role="combobox"], [aria-haspopup]')) field.focus({ preventScroll: true })
  }, 60)
}
