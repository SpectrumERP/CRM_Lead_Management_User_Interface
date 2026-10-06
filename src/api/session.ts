import type { AuthUser } from '../auth/types'
import { cookieVault } from './cookieVault'

const COOKIE_NAME = 'fi-crm-session'
const TTL_MS = 8 * 60 * 60 * 1000

/** AES-GCM protects integrity, so a tampered cookie fails to decrypt and is dropped. */
interface StoredSession {
  user: AuthUser
  exp: number
}

let cachedUser: AuthUser | null = null
/** Epoch ms the session ends (already capped at the JWT expiry for Spectrum logins). */
let cachedExp: number | null = null

function isAuthUser(value: unknown): value is AuthUser {
  const user = value as AuthUser | null
  return !!user && typeof user.id === 'string' && typeof user.name === 'string' && typeof user.role === 'string'
}

/** `expiresAt` caps the session (e.g. at the JWT expiry); defaults to 8 hours. */
export async function createSession(user: AuthUser, expiresAt?: number): Promise<void> {
  cachedUser = user
  const exp = Math.min(Date.now() + TTL_MS, expiresAt ?? Infinity)
  cachedExp = exp
  const payload: StoredSession = { user, exp }
  await cookieVault.set(COOKIE_NAME, payload, (exp - Date.now()) / 1000)
}

export async function readSession(): Promise<AuthUser | null> {
  if (!cookieVault.available()) return cachedUser
  const stored = await cookieVault.get<StoredSession>(COOKIE_NAME)
  if (!stored) {
    cachedUser = null
    return null
  }
  if (!isAuthUser(stored.user) || typeof stored.exp !== 'number' || Date.now() > stored.exp) {
    clearSession()
    return null
  }
  cachedUser = stored.user
  cachedExp = stored.exp
  return stored.user
}

export function clearSession() {
  cachedUser = null
  cachedExp = null
  cookieVault.remove(COOKIE_NAME)
}

export function getSessionSync(): AuthUser | null {
  return cachedUser
}

/** When the current session ends (epoch ms), or null when signed out. */
export function getSessionExpiry(): number | null {
  return cachedUser ? cachedExp : null
}
