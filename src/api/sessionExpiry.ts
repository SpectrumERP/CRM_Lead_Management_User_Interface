/**
 * One place that ends an expired session. Every trigger calls `notifySessionExpired`:
 *   - the token's `exp` passing (timer in AuthProvider, re-checked on focus / visibility),
 *   - a request about to go out with an expired token (http request interceptor),
 *   - the server answering 401 (http response interceptor),
 *   - another tab of the app expiring or signing out (BroadcastChannel).
 * It runs once per session: the stored token and session are wiped at once (so nothing else is sent
 * with them), then the listeners show the "session expired" alert and sign the user out.
 */
import { clearAuth } from './authStore'
import { clearSession } from './session'
import { sessionContract } from '../app/microfrontends'

export type SessionEndReason = 'expired' | 'rejected' | 'other-tab'

type Listener = (reason: SessionEndReason) => void

const listeners = new Set<Listener>()
let ended = false

const channel: BroadcastChannel | null =
  // Shared with the remote apps: a sign-out / expiry in either reaches the other's open tabs.
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(sessionContract.channel) : null

channel?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
  if (event.data?.type === 'expired' || event.data?.type === 'logout') end('other-tab', false)
})

function end(reason: SessionEndReason, broadcast: boolean) {
  if (ended) return
  ended = true
  clearAuth()
  clearSession()
  if (broadcast) channel?.postMessage({ type: 'expired' })
  for (const listener of listeners) listener(reason)
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
  return () => {
    listeners.delete(listener)
  }
}

/** A new sign-in starts a fresh session. */
export function resetSessionExpiry() {
  ended = false
}

/** A deliberate sign-out: other open tabs of the app sign out too. */
export function broadcastLogout() {
  channel?.postMessage({ type: 'logout' })
}

/** Test-only. */
export function __resetSessionExpiryForTests() {
  ended = false
  listeners.clear()
}
