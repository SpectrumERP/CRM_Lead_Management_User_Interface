/** Cookie and channel names shared with Spectrum ERP and Task Management for single sign-on. */
export const sessionContract = {
  authCookie: 'fi-crm-auth',
  sessionCookie: 'fi-crm-session',
  channel: 'fi-crm-session',
  logoutEventCookie: 'spectrum-auth-event',
  logoutStorageKey: 'spectrum.auth.logout',
  logoutBaselineKey: 'spectrum.auth.logout.baseline',
} as const

function eventCookie(value: string, maxAge: number) {
  if (typeof document === 'undefined') return
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  const domain = String(import.meta.env.VITE_COOKIE_DOMAIN ?? '').trim()
  const scope = domain ? `; Domain=${domain}` : ''
  document.cookie = `${sessionContract.logoutEventCookie}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Strict${scope}${secure}`
}

export function readLogoutSignal(): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${sessionContract.logoutEventCookie}=`
  const part = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix))
  return part ? part.slice(prefix.length) : null
}

export function publishLogoutSignal(): string {
  const nonce = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  const value = `logout:${Date.now()}:${nonce}`
  eventCookie(value, 30 * 24 * 60 * 60)
  try {
    localStorage.setItem(sessionContract.logoutStorageKey, `${Date.now()}:${Math.random().toString(36).slice(2)}`)
  } catch {
    // BroadcastChannel and the shared cookie remain available when storage is blocked.
  }
  return value
}

export function clearLogoutSignal() {
  eventCookie('', 0)
  if (String(import.meta.env.VITE_COOKIE_DOMAIN ?? '').trim()) {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${sessionContract.logoutEventCookie}=; Path=/; Max-Age=0; SameSite=Strict${secure}`
  }
  try {
    localStorage.removeItem(sessionContract.logoutStorageKey)
    sessionStorage.setItem(sessionContract.logoutBaselineKey, readLogoutSignal() ?? '')
  } catch {
    // The signal cookie remains the cross-origin fallback.
  }
}
