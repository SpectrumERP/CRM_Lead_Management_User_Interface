/**
 * One place that ends an expired session. Every trigger calls `notifySessionExpired`:
 *   - the token's `exp` passing (timer in AuthProvider, re-checked on focus / visibility),
 *   - a request about to go out with an expired token (http request interceptor),
 *   - the server answering 401 (http response interceptor),
 *   - another tab expiring or signing out (BroadcastChannel), or another origin removing the shared cookie.
 * It runs once per session: the stored token and session are wiped at once (so nothing else is sent
 * with them), then the listeners show the "session expired" alert and sign the user out.
 */
import { clearAuth } from './authStore'
import { cookieVault } from './cookieVault'
import { clearSession } from './session'
import { sessionContract } from './sessionContract'

export type SessionEndReason = 'expired' | 'rejected' | 'other-tab'

type Listener = (reason: SessionEndReason) => void

const listeners = new Set<Listener>()
let ended = false
let sharedSessionInterval: ReturnType<typeof setInterval> | null = null
let sawSharedSession = false

const channel: BroadcastChannel | null =
  // Shared with the remote apps: a sign-out / expiry in either reaches the other's open tabs.
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(sessionContract.channel) : null

channel?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
  if (event.data?.type === 'expired' || event.data?.type === 'logout') end('other-tab', false)
})

function end(reason: SessionEndReason, broadcast: boolean) {
  if (ended) return
  ended = true
  if (sharedSessionInterval !== null) clearInterval(sharedSessionInterval)
  sharedSessionInterval = null
  sawSharedSession = false
  clearAuth()
  clearSession()
  if (broadcast) channel?.postMessage({ type: 'expired' })
  for (const listener of listeners) listener(reason)
}

function checkSharedSession() {
  if (ended) return
  if (cookieVault.has(sessionContract.authCookie)) sawSharedSession = true
  else if (sawSharedSession) end('other-tab', true)
}

function startSharedSessionMonitor() {
  if (sharedSessionInterval !== null || ended || !cookieVault.available()) return
  checkSharedSession()
  if (!ended) sharedSessionInterval = setInterval(checkSharedSession, 5_000)
}

/** The session is over (expired or rejected): wipe it and tell the app — once. */
export function notifySessionExpired(reason: SessionEndReason = 'expired') {
  end(reason, true)
}

/** True once the current session has been ended (until the next sign-in). */
export function isSessionEnded() {
  return ended
}

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  startSharedSessionMonitor()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      if (sharedSessionInterval !== null) clearInterval(sharedSessionInterval)
      sharedSessionInterval = null
      sawSharedSession = false
    }
  }
}

/** A new sign-in starts a fresh session. */
export function resetSessionExpiry() {
  ended = false
  startSharedSessionMonitor()
}

/** A deliberate sign-out: other open tabs of the app sign out too. */
export function broadcastLogout() {
  channel?.postMessage({ type: 'logout' })
}

/** Test-only. */
export function __resetSessionExpiryForTests() {
  if (sharedSessionInterval !== null) clearInterval(sharedSessionInterval)
  sharedSessionInterval = null
  sawSharedSession = false
  ended = false
  listeners.clear()
}
