import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api as http, toApiError } from '../api'
import type { AuthUser } from './types'

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string }

interface AuthApi {
  user: AuthUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    http.auth.me().then((next) => {
      if (cancelled) return
      setUser(next)
      setReady(true)
    }).catch(() => {
      if (cancelled) return
      setUser(null)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const api = useMemo<AuthApi>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        try {
          const next = await http.auth.login(email, password)
          setUser(next)
          return { ok: true }
        } catch (error) {
          const apiError = toApiError(error)
          return { ok: false, message: apiError.message }
        }
      },
      logout: () => {
        http.auth.logout()
        setUser(null)
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
