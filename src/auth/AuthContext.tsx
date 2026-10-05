import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api as http, toApiError } from '../api'
import { getSessionExpiry } from '../api/session'
import {
  broadcastLogout,
  notifySessionExpired,
  onSessionExpired,
  resetSessionExpiry,
  type SessionEndReason,
} from '../api/sessionExpiry'
import SessionExpiredDialog from './SessionExpiredDialog'
import type { AuthUser } from './types'

/** End the session slightly early so no request goes out with a token about to expire. */
const EXPIRY_SKEW_MS = 15_000
/** Safety net: timers are throttled in background tabs, so the expiry is also re-checked regularly. */
const CHECK_EVERY_MS = 60_000
/** setTimeout cannot wait longer than this. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

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
  // Set when the session ends while the app is open: the alert is shown until "Sign in again".
  const [ended, setEnded] = useState<SessionEndReason | null>(null)

  // Any trigger (timer, expired token, 401, another tab) ends the session through one signal.
  useEffect(() => onSessionExpired((reason) => setEnded(reason)), [])

  // Proactive check against the token / session expiry while signed in.
  useEffect(() => {
    if (!user) return
    let timer: number | undefined
    const check = () => {
      const exp = getSessionExpiry()
      if (exp !== null && Date.now() >= exp - EXPIRY_SKEW_MS) notifySessionExpired('expired')
    }
    const schedule = () => {
      window.clearTimeout(timer)
      const exp = getSessionExpiry()
      if (exp === null) return
      timer = window.setTimeout(check, Math.min(Math.max(0, exp - EXPIRY_SKEW_MS - Date.now()), MAX_TIMEOUT_MS))
    }
    // Returning to a tab that slept past the expiry ends it at once.
    const onWake = () => {
      if (document.visibilityState === 'visible') {
        check()
        schedule()
      }
    }
    schedule()
    const interval = window.setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [user])

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
          resetSessionExpiry()
          setEnded(null)
          setUser(next)
          return { ok: true }
        } catch (error) {
          const apiError = toApiError(error)
          return { ok: false, message: apiError.message }
        }
      },
      logout: () => {
        http.auth.logout()
        broadcastLogout()
        setUser(null)
      },
    }),
    [user, ready],
  )

  return (
    <AuthContext.Provider value={api}>
      {children}
      {ended ? (
        <SessionExpiredDialog
          reason={ended}
          onSignIn={() => {
            // Storage was wiped when the session ended; dropping the user sends the guard to the
            // login page, which returns here after signing in.
            http.auth.logout()
            setEnded(null)
            setUser(null)
          }}
        />
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
