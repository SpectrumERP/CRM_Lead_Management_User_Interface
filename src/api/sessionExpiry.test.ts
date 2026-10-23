import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests, loadAuth, saveAuth } from './authStore'
import { http } from './http'
import { clearSession, createSession, getSessionSync } from './session'
import { __resetSessionExpiryForTests, isSessionEnded, notifySessionExpired, onSessionExpired, resetSessionExpiry } from './sessionExpiry'

const spectrumUser = { id: 'SPX-1', name: 'EDP TEMP', email: '', role: 'Admin' as const, jobTitle: 'Administrator', initials: 'ET' }

function stubCookies() {
  const jar = new Map<string, string>()
  vi.stubGlobal('document', {
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    },
    set cookie(text: string) {
      const [pair, ...attributes] = text.split(';')
      const separator = pair!.indexOf('=')
      const name = pair!.slice(0, separator).trim()
      if (attributes.some((attribute) => /max-age=0\b/i.test(attribute.trim()))) jar.delete(name)
      else jar.set(name, pair!.slice(separator + 1))
    },
  })
}

async function signIn(expiresAt: number) {
  await saveAuth({
    token: 'header.payload.sig',
    expiresAt,
    companies: [],
    user: { LoginNo: 1, LoginID: 'edp', EmpNo: null, UserType: '1', Email: null, PhoneNo: null, PrintingName: 'EDP TEMP', LastLoginCompanyNo: null, LastLoginModule: null },
  })
  await createSession(spectrumUser, expiresAt)
}

describe('session expiry', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    __resetSessionExpiryForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
    clearSession()
    __resetSessionExpiryForTests()
  })

  it('ends the session once: wipes the token and session, then tells the listeners', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    notifySessionExpired('rejected')
    notifySessionExpired('expired')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('rejected')
    expect(await loadAuth()).toBeNull()
    expect(getSessionSync()).toBeNull()
    expect(isSessionEnded()).toBe(true)
    // A new sign-in starts over.
    resetSessionExpiry()
    expect(isSessionEnded()).toBe(false)
  })

  it('never sends an expired token: the request is stopped and the session ends', async () => {
    await signIn(Date.now() - 1_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('a 401 from the server ends the session', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }))
    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('rejected')
    expect(await loadAuth()).toBeNull()
  })

  it('a 403 does not end an authenticated session', async () => {
    stubCookies()
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }))

    await expect(http.get('/api/crm/leads/search-data')).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(listener).not.toHaveBeenCalled()
    expect(await loadAuth()).not.toBeNull()
  })

  it('ends the session when a remote origin clears the shared auth cookie', async () => {
    stubCookies()
    await signIn(Date.now() + 60_000)
    vi.useFakeTimers()
    const listener = vi.fn()
    const unsubscribe = onSessionExpired(listener)
    document.cookie = 'fi-crm-auth=; Max-Age=0; Path=/'

    await vi.advanceTimersByTimeAsync(5_000)

    expect(listener).toHaveBeenCalledWith('other-tab')
    expect(isSessionEnded()).toBe(true)
    unsubscribe()
    vi.useRealTimers()
  })

  it('ends the session when a remote origin publishes an explicit logout signal', async () => {
    stubCookies()
    await signIn(Date.now() + 60_000)
    vi.useFakeTimers()
    const listener = vi.fn()
    const unsubscribe = onSessionExpired(listener)
    document.cookie = 'spectrum-auth-event=logout:remote:1; Path=/; Max-Age=60'

    await vi.advanceTimersByTimeAsync(5_000)

    expect(listener).toHaveBeenCalledWith('other-tab')
    expect(isSessionEnded()).toBe(true)
    unsubscribe()
    vi.useRealTimers()
  })

  it('a valid token is sent as a bearer token and nothing ends', async () => {
    await signIn(Date.now() + 60_000)
    const listener = vi.fn()
    onSessionExpired(listener)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))
    await http.get('/api/crm/leads/search-data')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer header.payload.sig')
    expect(listener).not.toHaveBeenCalled()
  })
})
