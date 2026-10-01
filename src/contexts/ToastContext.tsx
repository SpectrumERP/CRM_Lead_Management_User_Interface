import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import ToastContainer, { type ToastMessage, type ToastType } from '../components/Toast'

interface ToastApi {
  addToast: (type: ToastType, title: string, message?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, title, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/** Same as useToast, but a no-op outside the provider (components that may render in isolation). */
export function useOptionalToast(): ToastApi {
  return useContext(ToastContext) ?? { addToast: () => {} }
}
