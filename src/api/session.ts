import { findUserById } from '../auth/users'
import type { AuthUser } from '../auth/types'
import { safeEqual, sha256Hex } from './sanitize'

const STORAGE_KEY = 'fi-crm-session'
const TTL_MS = 8 * 60 * 60 * 1000
/** Client stand-in for a server JWT signing key. Real auth must move to httpOnly cookies. */
const SESSION_SALT = 'fi-crm-session-v1'

interface StoredSession {
  sub: string
  exp: number
  nonce: string
  sig: string
}

let cachedUser: AuthUser | null = null

async function sign(sub: string, exp: number, nonce: string) {
  return sha256Hex(`${sub}.${exp}.${nonce}.${SESSION_SALT}`)
}

function randomNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function canUseSession() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export async function createSession(user: AuthUser): Promise<void> {
  cachedUser = user
  if (!canUseSession()) return
  const exp = Date.now() + TTL_MS
  const nonce = randomNonce()
  const sig = await sign(user.id, exp, nonce)
  const payload: StoredSession = { sub: user.id, exp, nonce, sig }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export async function readSession(): Promise<AuthUser | null> {
  if (!canUseSession()) return cachedUser
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedUser = null
      return null
    }
    const stored = JSON.parse(raw) as StoredSession
    if (!stored?.sub || !stored.exp || !stored.nonce || !stored.sig) {
      clearSession()
      return null
    }
    if (Date.now() > stored.exp) {
      clearSession()
      return null
    }
    const expected = await sign(stored.sub, stored.exp, stored.nonce)
    if (!safeEqual(stored.sig, expected)) {
      clearSession()
      return null
    }
    const user = findUserById(stored.sub)
    if (!user) {
      clearSession()
      return null
    }
    cachedUser = user
    return user
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  cachedUser = null
  if (!canUseSession()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

export function getSessionSync(): AuthUser | null {
  return cachedUser
}
