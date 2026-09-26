import { verifyLogin } from '../auth/users'
import type { AuthUser } from '../auth/types'
import { invalidCredentials, rateLimited } from './errors'
import { createSession, clearSession, readSession } from './session'

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

export async function login(email: string, password: string): Promise<AuthUser> {
  guardLogin(email)
  const user = await verifyLogin(email, password)
  if (!user) invalidCredentials()
  attempts.delete(email.trim().toLowerCase())
  await createSession(user)
  return user
}

export function logout() {
  clearSession()
}

export async function me(): Promise<AuthUser | null> {
  return readSession()
}

/** Test-only: clear rate-limit counters and the in-memory session. */
export function __resetAuthForTests() {
  attempts.clear()
  clearSession()
}
