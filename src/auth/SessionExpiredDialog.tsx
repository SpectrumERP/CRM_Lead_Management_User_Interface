import { useEffect, useRef } from 'react'
import { Button, Card } from '../ui'
import type { SessionEndReason } from '../api/sessionExpiry'

const COPY: Record<SessionEndReason, { title: string; message: string }> = {
  expired: {
    title: 'Session expired',
    message: 'Your session has expired for your security. Please sign in again to continue.',
  },
  rejected: {
    title: 'Session expired',
    message: 'Your session is no longer valid. Please sign in again to continue.',
  },
  'other-tab': {
    title: 'Signed out',
    message: 'You were signed out in another tab. Please sign in again to continue.',
  },
}

/**
 * Blocking alert shown when the session ends. It cannot be dismissed (no backdrop click, no Esc):
 * the only way on is "Sign in again", which signs the user out and opens the login page.
 */
export default function SessionExpiredDialog({ reason, onSignIn }: { reason: SessionEndReason; onSignIn: () => void }) {
  const copy = COPY[reason]
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const focusButton = () => actionsRef.current?.querySelector('button')?.focus()
    focusButton()
    // Keep keyboard focus inside the alert.
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault()
        focusButton()
      }
      // Nothing behind the alert (drawers, menus) reacts to Esc while it is open.
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="ui-scrim fixed inset-0 z-[200] flex items-center justify-center px-4">
      <Card
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-message"
        className="w-[23rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-overlay animate-[scaleIn_0.16s_ease]"
      >
        <div className="flex">
          <div className="w-1 shrink-0 bg-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="session-expired-title" className="ui-title text-sm leading-5">{copy.title}</h2>
                <p id="session-expired-message" className="mt-1 text-xs leading-5 text-ink-soft">{copy.message}</p>
              </div>
            </div>
            <div ref={actionsRef} className="mt-4 flex justify-end">
              <Button variant="solid" onClick={onSignIn}>
                Sign in again
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
