import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * App-wide confirmation dialog (the same one used for deletes).
 * `await confirm({...})` resolves true on Confirm, false on Cancel / Escape / backdrop.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    setOptions(null)
    resolve?.(ok)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <ConfirmDialog
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel ?? 'Save'}
          cancelLabel={options.cancelLabel}
          danger={options.danger}
          zClass="z-[95]"
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  )
}

/** Outside the provider (e.g. isolated component tests) every confirm passes straight through. */
const passThrough: ConfirmFn = () => Promise.resolve(true)

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? passThrough
}

/** Standard wording for a save / update confirmation. */
export function saveConfirm(subject: string, isUpdate = false): ConfirmOptions {
  return isUpdate
    ? { title: `Update ${subject}`, message: `Save the changes to this ${subject.toLowerCase()}?`, confirmLabel: 'Update' }
    : { title: `Save ${subject}`, message: `Save this ${subject.toLowerCase()}?`, confirmLabel: 'Save' }
}
