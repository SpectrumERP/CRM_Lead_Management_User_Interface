import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveError } from '../api/errorPolicy'
import { notifySessionExpired } from '../api/sessionExpiry'
import { useToast } from '../contexts/ToastContext'
import { paths } from './paths'

export type HandleResult = 'handled' | 'crash'

interface ErrorHandlerApi {
  handleError: (error: unknown) => HandleResult
  run: <T>(fn: () => T) => T | undefined
  runAsync: <T>(fn: () => Promise<T>) => Promise<T | undefined>
}

const ErrorHandlerContext = createContext<ErrorHandlerApi | null>(null)

export function ErrorHandlerProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast()
  const navigate = useNavigate()

  const handleError = useCallback(
    (error: unknown): HandleResult => {
      const action = resolveError(error)
      switch (action.type) {
        case 'sign_in':
          // Session gone: the "session expired" alert signs the user out (see sessionExpiry).
          notifySessionExpired('rejected')
          return 'handled'
        case 'forbidden':
          addToast('error', action.title, action.message)
          navigate(paths.forbidden, { replace: true })
          return 'handled'
        case 'toast':
          addToast(action.tone, action.title, action.message)
          return 'handled'
        case 'form':
          addToast('error', action.title, action.message)
          return 'handled'
        case 'crash':
          return 'crash'
        default: {
          const _never: never = action
          return _never
        }
      }
    },
    [addToast, navigate],
  )

  const run = useCallback(
    <T,>(fn: () => T) => {
      try {
        return fn()
      } catch (error) {
        if (handleError(error) === 'crash') throw error
        return undefined
      }
    },
    [handleError],
  )

  const runAsync = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      try {
        return await fn()
      } catch (error) {
        if (handleError(error) === 'crash') throw error
        return undefined
      }
    },
    [handleError],
  )

  const value = useMemo<ErrorHandlerApi>(() => ({ handleError, run, runAsync }), [handleError, run, runAsync])
  return <ErrorHandlerContext.Provider value={value}>{children}</ErrorHandlerContext.Provider>
}

export function useErrorHandler() {
  const ctx = useContext(ErrorHandlerContext)
  if (!ctx) throw new Error('useErrorHandler must be used within ErrorHandlerProvider')
  return ctx
}
