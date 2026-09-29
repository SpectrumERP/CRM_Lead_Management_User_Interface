import { verifyLogin } from '../auth/users'
import type { AuthUser } from '../auth/types'
import { clearAuth, loadAuth } from './authStore'
import { usesSpectrumApi } from './config'
import { invalidCredentials, isApiError, rateLimited, type ApiError } from './errors'
import { createSession, clearSession, readSession } from './session'
import { spectrumLogin } from './spectrumAuth'

const WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

function guardLogin(email: string) {
  const key = email.trim().toLowerCase()
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || now > current.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  current.count += 1
  if (current.count > MAX_ATTEMPTS) rateLimited()
}

/** Spectrum API first (stores the JWT); falls back to the built-in demo accounts. */
export async function login(email: string, password: string): Promise<AuthUser> {
  guardLogin(email)
  let remoteError: ApiError | null = null
  if (usesSpectrumApi()) {
    try {
      const user = await spectrumLogin(email.trim(), password)
      attempts.delete(email.trim().toLowerCase())
      await createSession(user, (await loadAuth())?.expiresAt)
      return user
    } catch (error) {
      if (!isApiError(error)) throw error
      remoteError = error
    }
  }
  const user = await verifyLogin(email, password)
  if (!user) {
    // Surface outages (network/server) instead of a misleading "wrong password".
    if (remoteError && remoteError.status !== 401 && remoteError.status !== 400) throw remoteError
    invalidCredentials()
  }
  attempts.delete(email.trim().toLowerCase())
  await createSession(user)
  return user
}

export function logout() {
  clearSession()
  clearAuth()
}

export async function me(): Promise<AuthUser | null> {
  return readSession()
}

/** Test-only: clear rate-limit counters and the in-memory session. */
export function __resetAuthForTests() {
  attempts.clear()
  clearSession()
  clearAuth()
}
