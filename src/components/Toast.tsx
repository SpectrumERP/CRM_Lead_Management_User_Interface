import { useEffect } from 'react'
import { Button } from '../ui'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  /** Where the stack sits. Login uses top-right; the rest of the app stays bottom-right. */
  placement?: 'bottom-right' | 'top-right'
}

const META: Record<ToastType, { wrap: string; iconWrap: string; icon: string }> = {
  success: { wrap: 'border-success-line', iconWrap: 'bg-success-soft text-success border-success-line', icon: '✓' },
  error: { wrap: 'border-accent-soft', iconWrap: 'bg-accent-soft text-accent border-accent-soft', icon: '✕' },
  info: { wrap: 'border-primary-soft', iconWrap: 'bg-primary-soft text-primary border-primary-soft', icon: 'i' },
  warning: { wrap: 'border-warning-line', iconWrap: 'bg-warning-soft text-warning border-warning-line', icon: '!' },
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const m = META[toast.type]
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="status"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl min-w-72 max-w-sm animate-[slideIn_0.2s_ease] bg-surface border shadow-overlay ${m.wrap}`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border ${m.iconWrap}`} aria-hidden="true">
        {m.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="ui-title text-sm">{toast.title}</p>
        {toast.message && <p className="ui-subtitle text-xs mt-0.5">{toast.message}</p>}
      </div>
      <Button type="button" variant="icon" onClick={onDismiss} aria-label="Dismiss notification" className="mt-0.5 w-5 h-5">
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  )
}

export default function ToastContainer({ toasts, onDismiss, placement = 'bottom-right' }: ToastProps) {
  if (toasts.length === 0) return null
  const place =
    placement === 'top-right'
      ? 'absolute top-4 right-4 z-[100] flex flex-col gap-2 max-sm:left-4 max-sm:right-4'
      : 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-sm:left-4 max-sm:right-4 max-sm:bottom-4'
  return (
    <div className={place}>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}
